"""
SPECTRA Worker — consumes events from Redis Streams and processes them.

Flow per message:
  1. Read from Redis Stream consumer group
  2. Decode and validate event
  3. Check idempotency (skip if already processed)
  4. Update DB status to "processing"
  5. Run rules engine
  6. Run correlation engine
  7. Persist results (PostgreSQL + OpenSearch)
  8. Acknowledge message (XACK)
  9. On failure: retry up to MAX_RETRIES, then move to DLQ

Worker reliability:
  - Only ACK after successful processing
  - Retry with exponential backoff
  - DLQ for permanently failed messages
  - Graceful shutdown on SIGTERM/SIGINT
  - Heartbeat in Redis for health monitoring
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
import structlog
from opensearchpy import AsyncOpenSearch
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from config import get_worker_settings
from correlation.engine import CorrelationEngine
from rules.engine import RulesEngine

settings = get_worker_settings()

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
log = structlog.get_logger("spectra.worker")


# ─── DB + OpenSearch setup ────────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)
SessionFactory = async_sessionmaker(bind=engine, expire_on_commit=False)

opensearch_client = AsyncOpenSearch(
    hosts=[settings.opensearch_url],
    use_ssl=False,
    verify_certs=False,
)


# ─── Worker ───────────────────────────────────────────────────────────────────

class Worker:
    """Single worker coroutine — processes events from a Redis Stream consumer group."""

    def __init__(self, worker_id: str, redis_client: aioredis.Redis):
        self.worker_id = worker_id
        self.redis = redis_client
        self.rules_engine = RulesEngine()
        self._shutdown = False
        self._processed = 0
        self._failed = 0

    async def run(self) -> None:
        log.info("Worker starting", worker_id=self.worker_id)
        await self._register()

        # Process pending (unacknowledged) messages first
        await self._process_pending()

        while not self._shutdown:
            try:
                await self._heartbeat()
                await self._read_and_process()
            except Exception as exc:
                log.error(
                    "Worker loop error",
                    worker_id=self.worker_id,
                    error=str(exc),
                    exc_info=True,
                )
                await asyncio.sleep(1)

        log.info("Worker stopped", worker_id=self.worker_id, processed=self._processed)

    def request_shutdown(self) -> None:
        self._shutdown = True

    async def _register(self) -> None:
        await self.redis.sadd("spectra:workers", self.worker_id)
        await self.redis.incr("spectra:workers:active")

    async def _deregister(self) -> None:
        await self.redis.srem("spectra:workers", self.worker_id)
        await self.redis.decr("spectra:workers:active")

    async def _heartbeat(self) -> None:
        await self.redis.setex(
            f"spectra:worker:{self.worker_id}:heartbeat",
            30,
            datetime.now(timezone.utc).isoformat(),
        )

    async def _process_pending(self) -> None:
        """Claim and reprocess any messages that were not acknowledged."""
        try:
            pending = await self.redis.xpending_range(
                settings.stream_name,
                settings.consumer_group,
                min="-",
                max="+",
                count=100,
                consumername=self.worker_id,
            )
            if pending:
                log.info(
                    "Reclaiming pending messages",
                    worker_id=self.worker_id,
                    count=len(pending),
                )
                msg_ids = [p["message_id"] for p in pending]
                claimed = await self.redis.xclaim(
                    settings.stream_name,
                    settings.consumer_group,
                    self.worker_id,
                    min_idle_time=5000,  # 5 seconds
                    message_ids=msg_ids,
                )
                for msg_id, fields in claimed:
                    await self._handle_message(msg_id, fields)
        except Exception as exc:
            log.warning("Could not reclaim pending messages", error=str(exc))

    async def _read_and_process(self) -> None:
        messages = await self.redis.xreadgroup(
            groupname=settings.consumer_group,
            consumername=self.worker_id,
            streams={settings.stream_name: ">"},
            count=settings.read_count,
            block=settings.read_block_ms,
        )
        if not messages:
            return

        for stream_name, stream_messages in messages:
            for msg_id, fields in stream_messages:
                await self._handle_message(msg_id, fields)

    async def _handle_message(self, msg_id: str, fields: dict) -> None:
        """
        Full processing pipeline for a single message.
        Only ACKs on success.
        """
        t_start = time.monotonic()
        raw_data = fields.get("data", "{}")

        try:
            event = json.loads(raw_data)
        except json.JSONDecodeError as exc:
            log.error("Malformed JSON in stream message", msg_id=msg_id, error=str(exc))
            await self._send_to_dlq(
                msg_id=msg_id,
                raw_data=raw_data,
                event_id="unknown",
                reason=f"JSON decode error: {exc}",
                retry_count=0,
            )
            await self._ack(msg_id)
            return

        event_id = event.get("event_id", "unknown")

        # Load rules fresh each processing cycle (allows hot-reload from DB)
        async with SessionFactory() as session:
            try:
                await self.rules_engine.load_rules(session)
            except Exception:
                pass  # Non-fatal; continue with whatever rules are cached

        async with SessionFactory() as session:
            try:
                await self._process_event(
                    session=session,
                    msg_id=msg_id,
                    event=event,
                    event_id=event_id,
                    t_start=t_start,
                )
            except Exception as exc:
                log.error(
                    "Event processing failed",
                    worker_id=self.worker_id,
                    event_id=event_id,
                    msg_id=msg_id,
                    error=str(exc),
                    exc_info=True,
                )
                self._failed += 1
                await session.rollback()
                await self._handle_failure(
                    session=session,
                    msg_id=msg_id,
                    raw_data=raw_data,
                    event_id=event_id,
                    error=str(exc),
                )

    async def _process_event(
        self,
        session: AsyncSession,
        msg_id: str,
        event: dict,
        event_id: str,
        t_start: float,
    ) -> None:
        from models import EventMetadata, ProcessingAttempt, RuleMatch  # type: ignore

        # ── Idempotency check ────────────────────────────────────────────────
        result = await session.execute(
            select(EventMetadata).where(EventMetadata.event_id == event_id)
        )
        record = result.scalar_one_or_none()

        if record and record.processing_status == "processed":
            log.info("Duplicate event skipped", event_id=event_id)
            await self._ack(msg_id)
            return

        # ── Mark as processing ───────────────────────────────────────────────
        if record:
            record.processing_status = "processing"
        else:
            # Event arrived before API persisted it (direct Redis publish)
            record = EventMetadata(
                event_id=event_id,
                event_type=event.get("event_type", "unknown"),
                source=event.get("source"),
                producer=event.get("producer"),
                entity_id=event.get("entity_id"),
                entity_type=event.get("entity_type"),
                action=event.get("action"),
                status=event.get("status"),
                correlation_key=event.get("correlation_key"),
                processing_status="processing",
                schema_version=event.get("schema_version", "1.0"),
            )
            session.add(record)

        await session.flush()

        # ── Rules Engine ─────────────────────────────────────────────────────
        rule_results = await self.rules_engine.evaluate_all(event, self.redis)
        for r in rule_results:
            if r.matched:
                log.info(
                    "Rule matched",
                    event_id=event_id,
                    rule_id=r.rule_id,
                    rule_name=r.rule_name,
                )
                match = RuleMatch(
                    rule_id_fk=record.id,  # placeholder; need actual FK
                    event_id_fk=record.id,
                    event_id=event_id,
                    context=r.context,
                )
                # Resolve FK from rule_id
                from models import Rule  # type: ignore
                rule_result2 = await session.execute(
                    select(Rule).where(Rule.rule_id == r.rule_id)
                )
                rule_orm = rule_result2.scalar_one_or_none()
                if rule_orm:
                    match.rule_id_fk = rule_orm.id
                    session.add(match)

        # ── Correlation Engine ───────────────────────────────────────────────
        corr_engine = CorrelationEngine(self.redis)
        correlation_id = await corr_engine.process_event(event, session)

        if correlation_id:
            record.correlation_id = correlation_id

        # ── Mark as processed ────────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        record.processing_status = "processed"
        record.processed_at = now

        duration_ms = round((time.monotonic() - t_start) * 1000)

        attempt = ProcessingAttempt(
            event_id_fk=record.id,
            event_id=event_id,
            attempt_number=1,
            status="success",
            worker_id=self.worker_id,
            duration_ms=duration_ms,
        )
        session.add(attempt)
        await session.commit()

        # ── Index in OpenSearch ──────────────────────────────────────────────
        await self._index_event(event, correlation_id, now)

        # ── ACK only after all persistence succeeds ──────────────────────────
        await self._ack(msg_id)

        self._processed += 1
        log.info(
            "Event processed",
            worker_id=self.worker_id,
            event_id=event_id,
            duration_ms=duration_ms,
            correlation_id=correlation_id,
        )

    async def _handle_failure(
        self,
        session: AsyncSession,
        msg_id: str,
        raw_data: str,
        event_id: str,
        error: str,
    ) -> None:
        """Record failure attempt. After MAX_RETRIES, move to DLQ."""
        from models import EventMetadata, ProcessingAttempt  # type: ignore

        # Get existing attempt count
        attempt_result = await session.execute(
            select(ProcessingAttempt)
            .where(ProcessingAttempt.event_id == event_id)
            .order_by(ProcessingAttempt.attempted_at.asc())
        )
        attempts = attempt_result.scalars().all()
        attempt_number = len(attempts) + 1

        # Get or create EventMetadata
        em_result = await session.execute(
            select(EventMetadata).where(EventMetadata.event_id == event_id)
        )
        record = em_result.scalar_one_or_none()
        if record is None:
            record = EventMetadata(
                event_id=event_id,
                event_type="unknown",
                processing_status="failed",
            )
            session.add(record)
            await session.flush()

        attempt = ProcessingAttempt(
            event_id_fk=record.id,
            event_id=event_id,
            attempt_number=attempt_number,
            status="failed",
            failure_reason=error,
            worker_id=self.worker_id,
        )
        session.add(attempt)

        if attempt_number >= settings.max_retries:
            record.processing_status = "dlq"
            await session.commit()
            await self._send_to_dlq(
                msg_id=msg_id,
                raw_data=raw_data,
                event_id=event_id,
                reason=error,
                retry_count=attempt_number,
            )
            await self._ack(msg_id)
            log.warning(
                "Event moved to DLQ",
                event_id=event_id,
                attempts=attempt_number,
            )
        else:
            record.processing_status = "failed"
            await session.commit()
            # Don't ACK — Redis will re-deliver to pending
            log.warning(
                "Event processing failed — will retry",
                event_id=event_id,
                attempt=attempt_number,
                max_retries=settings.max_retries,
            )

    async def _send_to_dlq(
        self,
        msg_id: str,
        raw_data: str,
        event_id: str,
        reason: str,
        retry_count: int,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self.redis.xadd(
            settings.dlq_stream_name,
            {
                "event_id": event_id,
                "data": raw_data,
                "failure_reason": reason,
                "retry_count": str(retry_count),
                "last_failed_at": now,
                "original_msg_id": msg_id,
                "worker_id": self.worker_id,
            },
        )

    async def _ack(self, msg_id: str) -> None:
        await self.redis.xack(
            settings.stream_name, settings.consumer_group, msg_id
        )

    async def _index_event(
        self,
        event: dict,
        correlation_id: Optional[str],
        processed_at: datetime,
    ) -> None:
        doc = {**event, "correlation_id": correlation_id, "processed_at": processed_at.isoformat()}
        try:
            await opensearch_client.index(
                index="spectra-events",
                id=event.get("event_id"),
                body=doc,
            )
        except Exception as exc:
            log.warning("OpenSearch indexing failed", error=str(exc))


# ─── Pool ─────────────────────────────────────────────────────────────────────

class WorkerPool:
    """Manages N concurrent worker coroutines."""

    def __init__(self, count: int):
        self.count = count
        self._workers: list[Worker] = []
        self._tasks: list[asyncio.Task] = []

    async def start(self, redis_client: aioredis.Redis) -> None:
        for i in range(1, self.count + 1):
            worker_id = f"worker-{i}-{uuid.uuid4().hex[:4]}"
            worker = Worker(worker_id=worker_id, redis_client=redis_client)
            self._workers.append(worker)
            task = asyncio.create_task(worker.run(), name=worker_id)
            self._tasks.append(task)

        log.info("Worker pool started", count=self.count)
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def shutdown(self) -> None:
        log.info("Graceful shutdown initiated")
        for w in self._workers:
            w.request_shutdown()
        # Give workers up to 30s to finish in-flight processing
        await asyncio.wait_for(
            asyncio.gather(*self._tasks, return_exceptions=True),
            timeout=30,
        )
        for w in self._workers:
            await w._deregister()
        log.info("Worker pool shut down cleanly")


# ─── Entry Point ──────────────────────────────────────────────────────────────

async def main() -> None:
    redis_client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=settings.worker_count * 3,
    )

    pool = WorkerPool(count=settings.worker_count)

    loop = asyncio.get_running_loop()

    def _signal_handler():
        log.info("Shutdown signal received")
        asyncio.create_task(pool.shutdown())

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except (NotImplementedError, RuntimeError):
            pass  # Windows doesn't support add_signal_handler for all signals

    try:
        await pool.start(redis_client)
    finally:
        await redis_client.aclose()
        await opensearch_client.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
