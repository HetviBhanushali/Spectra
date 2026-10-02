"""
POST /api/events  — Accept and queue an event
GET  /api/events  — List events with filtering/pagination
GET  /api/events/{event_id} — Get a single event
"""

import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import Pagination, get_current_user
from app.core.database import get_db
from app.core.redis import publish_event
from app.models import EventMetadata
from app.schemas.events import (
    EventCreate,
    EventQueued,
    EventResponse,
    PaginatedEvents,
)

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post(
    "",
    response_model=EventQueued,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest an event",
    description=(
        "Validates the event, assigns/verifies an event ID, "
        "publishes it to Redis Streams, and returns an acknowledgement. "
        "Processing happens asynchronously in the worker pool."
    ),
)
async def create_event(
    event: EventCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    request_id = request.headers.get("X-Request-Id", str(uuid.uuid4())[:8])

    # Check idempotency — don't re-queue already known events
    existing = await db.execute(
        select(EventMetadata).where(EventMetadata.event_id == event.event_id)
    )
    if existing.scalar_one_or_none():
        return EventQueued(event_id=event.event_id, status="already_queued")

    # Persist lightweight metadata record immediately
    record = EventMetadata(
        event_id=event.event_id,
        event_type=event.event_type,
        source=event.source,
        producer=event.producer,
        entity_id=event.entity_id,
        entity_type=event.entity_type,
        action=event.action,
        status=event.status,
        correlation_key=event.correlation_key,
        processing_status="queued",
        event_timestamp=event.timestamp,
        schema_version=event.schema_version,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Publish to Redis Streams
    payload = event.model_dump(mode="json")
    stream_id = await publish_event(payload)

    return EventQueued(event_id=event.event_id, status="queued", stream_id=stream_id)


@router.get(
    "",
    response_model=PaginatedEvents,
    summary="List events",
)
async def list_events(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    source: Optional[str] = Query(None),
    producer: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    processing_status: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    query = select(EventMetadata)
    if event_type:
        query = query.where(EventMetadata.event_type == event_type)
    if source:
        query = query.where(EventMetadata.source == source)
    if producer:
        query = query.where(EventMetadata.producer == producer)
    if entity_id:
        query = query.where(EventMetadata.entity_id == entity_id)
    if processing_status:
        query = query.where(EventMetadata.processing_status == processing_status)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = (
        query.order_by(EventMetadata.ingested_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedEvents(
        items=[EventResponse.model_validate(i) for i in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=max(1, math.ceil(total / pagination.page_size)),
    )


@router.get(
    "/search",
    response_model=list[dict],
    summary="Search events using OpenSearch with DB fallback",
)
async def search_events_endpoint(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    try:
        from app.core.opensearch import search_events
        os_query = {
            "size": limit,
            "query": {
                "multi_match": {
                    "query": q,
                    "fields": [
                        "event_type^3",
                        "entity_id^3",
                        "action^2",
                        "source",
                        "producer",
                        "status",
                        "correlation_key",
                    ],
                    "fuzziness": "AUTO",
                }
            },
        }
        res = await search_events(os_query)
        hits = res.get("hits", {}).get("hits", [])
        if hits:
            return [hit["_source"] for hit in hits]
    except Exception:
        pass

    fallback_query = (
        select(EventMetadata)
        .where(
            or_(
                EventMetadata.event_id.ilike(f"%{q}%"),
                EventMetadata.event_type.ilike(f"%{q}%"),
                EventMetadata.entity_id.ilike(f"%{q}%"),
                EventMetadata.action.ilike(f"%{q}%"),
                EventMetadata.source.ilike(f"%{q}%"),
                EventMetadata.correlation_key.ilike(f"%{q}%"),
            )
        )
        .order_by(EventMetadata.ingested_at.desc())
        .limit(limit)
    )
    result = await db.execute(fallback_query)
    records = result.scalars().all()
    return [EventResponse.model_validate(r).model_dump() for r in records]


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get event by ID",
)
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.execute(
        select(EventMetadata).where(EventMetadata.event_id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "EVENT_NOT_FOUND",
                "message": f"Event {event_id} was not found",
            },
        )
    return EventResponse.model_validate(event)
