"""
GET /api/processing/status   — Aggregate worker/stream metrics
GET /api/processing/failures — Recent failed events
GET /api/processing/dlq      — Dead-letter queue entries
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.models import EventMetadata, ProcessingAttempt
from app.schemas.common import DLQEntry, ProcessingStatusResponse

settings = get_settings()
router = APIRouter(prefix="/api/processing", tags=["processing"])


@router.get("/status", response_model=ProcessingStatusResponse)
async def processing_status(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    client = await get_redis()

    # Stream stats
    stream_info = await client.xinfo_stream(settings.stream_name)
    stream_length = stream_info.get("length", 0)

    # Pending messages in consumer group
    try:
        pending_info = await client.xpending(
            settings.stream_name, settings.consumer_group
        )
        pending_messages = pending_info.get("pending", 0)
    except Exception:
        pending_messages = 0

    # DLQ count
    try:
        dlq_length = await client.xlen(settings.dlq_stream_name)
    except Exception:
        dlq_length = 0

    # DB counts
    queued_count = await db.execute(
        select(func.count()).where(EventMetadata.processing_status == "queued")
    )
    processed_count = await db.execute(
        select(func.count()).where(EventMetadata.processing_status == "processed")
    )
    failed_count = await db.execute(
        select(func.count()).where(EventMetadata.processing_status.in_(["failed", "dlq"]))
    )

    return ProcessingStatusResponse(
        active_workers=int(
            await client.get("spectra:workers:active") or 0
        ),
        queued_events=queued_count.scalar_one(),
        processed_events=processed_count.scalar_one(),
        failed_events=failed_count.scalar_one(),
        dlq_count=dlq_length,
        stream_length=stream_length,
        pending_messages=pending_messages,
    )


@router.get("/failures", response_model=list[dict])
async def list_failures(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.execute(
        select(ProcessingAttempt)
        .where(ProcessingAttempt.status == "failed")
        .order_by(ProcessingAttempt.attempted_at.desc())
        .limit(limit)
    )
    attempts = result.scalars().all()
    return [
        {
            "event_id": a.event_id,
            "attempt_number": a.attempt_number,
            "failure_reason": a.failure_reason,
            "worker_id": a.worker_id,
            "attempted_at": a.attempted_at.isoformat() if a.attempted_at else None,
        }
        for a in attempts
    ]


@router.get("/dlq", response_model=list[DLQEntry])
async def list_dlq(
    count: int = Query(50, ge=1, le=200),
    _user=Depends(get_current_user),
):
    client = await get_redis()
    try:
        messages = await client.xrange(settings.dlq_stream_name, count=count)
    except Exception:
        return []

    entries = []
    for msg_id, fields in messages:
        try:
            original = json.loads(fields.get("data", "{}"))
        except json.JSONDecodeError:
            original = {}
        entries.append(
            DLQEntry(
                message_id=msg_id,
                event_id=fields.get("event_id"),
                failure_reason=fields.get("failure_reason"),
                retry_count=int(fields.get("retry_count", 0)),
                first_failed_at=fields.get("first_failed_at"),
                last_failed_at=fields.get("last_failed_at"),
                original_data=original,
            )
        )
    return entries
