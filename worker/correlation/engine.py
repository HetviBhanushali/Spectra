"""
Correlation Engine — groups related events by correlation_key and time window.

Design:
  - Uses Redis hashes to accumulate active correlations (fast, ephemeral)
  - Flushes completed correlations to PostgreSQL and OpenSearch
  - A correlation is "active" if it received an event within the window
  - Pattern detection runs over the accumulated event_types sequence
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis

from config import get_worker_settings

settings = get_worker_settings()

# Patterns: name → required sequence (order matters, non-contiguous)
KNOWN_PATTERNS: dict[str, list[str]] = {
    "suspicious_sequence": [
        "user.login",
        "resource.accessed",
        "permission.changed",
    ],
    "failed_workflow": [
        "job.started",
        "request.failed",
        "job.failed",
    ],
    "normal_workflow": [
        "job.started",
        "resource.accessed",
        "job.completed",
    ],
    "credential_abuse": [
        "user.login",
        "permission.changed",
        "credential.created",
    ],
}


def _is_subsequence(needle: list[str], haystack: list[str]) -> bool:
    it = iter(haystack)
    return all(item in it for item in needle)


def _detect_pattern(event_types: list[str]) -> Optional[str]:
    for pattern_name, sequence in KNOWN_PATTERNS.items():
        if _is_subsequence(sequence, event_types):
            return pattern_name
    return None


class CorrelationEngine:
    """
    Core correlation logic. Called per-event from the worker.

    Redis data structures:
      spectra:corr:{key}:meta  — Hash with correlation metadata
      spectra:corr:{key}:events — List of event IDs
      spectra:corr:{key}:types  — List of event types (for pattern detection)
    """

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.window = settings.correlation_window_seconds

    def _keys(self, correlation_key: str) -> tuple[str, str, str]:
        base = f"spectra:corr:{correlation_key}"
        return f"{base}:meta", f"{base}:events", f"{base}:types"

    async def process_event(
        self,
        event: dict,
        db_session,
    ) -> Optional[str]:
        """
        Correlate an event. Returns correlation_id if one was found/created.
        """
        correlation_key = event.get("correlation_key") or event.get("entity_id")
        if not correlation_key:
            return None

        meta_key, events_key, types_key = self._keys(correlation_key)
        event_id = event.get("event_id", "")
        event_type = event.get("event_type", "")
        now = datetime.now(timezone.utc)

        # Check if an active correlation exists
        corr_id_bytes = await self.redis.hget(meta_key, "correlation_id")

        if corr_id_bytes:
            correlation_id = corr_id_bytes
            # Extend TTL — still active
            await self.redis.expire(meta_key, self.window)
            await self.redis.expire(events_key, self.window)
            await self.redis.expire(types_key, self.window)
        else:
            # Start a new correlation
            correlation_id = f"corr_{uuid.uuid4().hex[:12]}"
            await self.redis.hset(
                meta_key,
                mapping={
                    "correlation_id": correlation_id,
                    "correlation_key": correlation_key,
                    "entity_id": event.get("entity_id", ""),
                    "entity_type": event.get("entity_type", ""),
                    "started_at": now.isoformat(),
                },
            )
            await self.redis.expire(meta_key, self.window)
            await self.redis.expire(events_key, self.window)
            await self.redis.expire(types_key, self.window)

        # Append event to the correlation
        await self.redis.rpush(events_key, event_id)
        await self.redis.rpush(types_key, event_type)

        # Detect patterns
        event_types = await self.redis.lrange(types_key, 0, -1)
        pattern = _detect_pattern(event_types)

        # Persist/update in PostgreSQL
        await self._upsert_correlation(
            db_session=db_session,
            correlation_id=correlation_id,
            correlation_key=correlation_key,
            entity_id=event.get("entity_id"),
            entity_type=event.get("entity_type"),
            event_id=event_id,
            event_types=event_types,
            pattern=pattern,
            started_at=now,
        )

        return correlation_id

    async def _upsert_correlation(
        self,
        db_session,
        correlation_id: str,
        correlation_key: str,
        entity_id: Optional[str],
        entity_type: Optional[str],
        event_id: str,
        event_types: list[str],
        pattern: Optional[str],
        started_at: datetime,
    ) -> None:
        from sqlalchemy import select
        from models import Correlation  # type: ignore

        result = await db_session.execute(
            select(Correlation).where(Correlation.correlation_id == correlation_id)
        )
        corr = result.scalar_one_or_none()

        # Fetch the current event list from Redis for accuracy
        meta_key, events_key, _ = self._keys(correlation_key)
        all_event_ids = await self.redis.lrange(events_key, 0, -1)
        started_str = await self.redis.hget(meta_key, "started_at")
        actual_started = (
            datetime.fromisoformat(started_str) if started_str else started_at
        )

        if corr is None:
            corr = Correlation(
                correlation_id=correlation_id,
                correlation_key=correlation_key,
                entity_id=entity_id,
                entity_type=entity_type,
                event_ids=all_event_ids,
                event_count=len(all_event_ids),
                status="active",
                pattern_matched=pattern,
                started_at=actual_started,
            )
            db_session.add(corr)
        else:
            corr.event_ids = all_event_ids
            corr.event_count = len(all_event_ids)
            corr.updated_at = datetime.now(timezone.utc)
            if pattern:
                corr.pattern_matched = pattern
