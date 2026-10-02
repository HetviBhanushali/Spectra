"""
Pydantic schemas for event ingestion, validation, and API responses.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


def _default_event_id() -> str:
    return f"evt_{uuid.uuid4().hex[:12]}"


class EventCreate(BaseModel):
    """Schema for inbound event payloads (POST /api/events)."""

    event_id: Optional[str] = Field(
        default_factory=_default_event_id,
        description="Unique event identifier. Auto-generated if not provided.",
        examples=["evt_abc123def456"],
    )
    event_type: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Dot-separated event type (e.g. 'resource.accessed')",
        examples=["resource.accessed"],
    )
    timestamp: Optional[datetime] = Field(
        default=None,
        description="ISO-8601 timestamp. Defaults to now if omitted.",
    )
    source: Optional[str] = Field(
        default="unknown",
        max_length=128,
        description="System or component that produced the event",
    )
    producer: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Specific service or process within the source",
    )
    entity_id: Optional[str] = Field(
        default=None,
        max_length=256,
        description="Identifier of the primary entity involved",
    )
    entity_type: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Type of entity (e.g. 'user', 'resource', 'job')",
    )
    action: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Action performed (e.g. 'read', 'write', 'delete')",
    )
    status: Optional[str] = Field(
        default="success",
        max_length=64,
        description="Outcome status (e.g. 'success', 'failure', 'pending')",
    )
    metadata: Optional[dict[str, Any]] = Field(
        default_factory=dict,
        description="Arbitrary key-value pairs for additional context",
    )
    correlation_key: Optional[str] = Field(
        default=None,
        max_length=256,
        description="Key used to group related events (e.g. user ID, session ID)",
    )
    schema_version: str = Field(default="1.0", max_length=16)

    @field_validator("event_type")
    @classmethod
    def event_type_format(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("event_type cannot be blank")
        return v

    @model_validator(mode="after")
    def set_defaults(self) -> "EventCreate":
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)
        if self.correlation_key is None and self.entity_id is not None:
            self.correlation_key = self.entity_id
        return self


class EventQueued(BaseModel):
    """Response returned immediately after accepting an event."""

    event_id: str
    status: str = "queued"
    stream_id: Optional[str] = None


class EventResponse(BaseModel):
    """Full event representation for API reads."""

    event_id: str
    event_type: str
    timestamp: Optional[datetime]
    source: Optional[str]
    producer: Optional[str]
    entity_id: Optional[str]
    entity_type: Optional[str]
    action: Optional[str]
    status: Optional[str]
    metadata: Optional[dict[str, Any]]
    correlation_key: Optional[str]
    correlation_id: Optional[str]
    schema_version: str
    processing_status: str
    ingested_at: datetime
    processed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PaginatedEvents(BaseModel):
    items: list[EventResponse]
    total: int
    page: int
    page_size: int
    pages: int
