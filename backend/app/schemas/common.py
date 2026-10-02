"""
Pydantic schemas for correlations, rules, processing status, and system health.
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


# ─── Correlations ─────────────────────────────────────────────────────────────

class CorrelationResponse(BaseModel):
    correlation_id: str
    correlation_key: str
    entity_id: Optional[str]
    entity_type: Optional[str]
    event_ids: list[str]
    event_count: int
    status: str
    pattern_matched: Optional[str]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedCorrelations(BaseModel):
    items: list[CorrelationResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ─── Rules ────────────────────────────────────────────────────────────────────

class RuleCreate(BaseModel):
    rule_id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None
    rule_type: str = Field(..., description="e.g. 'threshold', 'sequence', 'status'")
    enabled: bool = True
    configuration: dict[str, Any] = Field(default_factory=dict)


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    configuration: Optional[dict[str, Any]] = None


class RuleResponse(BaseModel):
    id: str
    rule_id: str
    name: str
    description: Optional[str]
    rule_type: str
    enabled: bool
    configuration: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Processing Status ────────────────────────────────────────────────────────

class WorkerStatus(BaseModel):
    worker_id: str
    status: str
    events_processed: int
    last_heartbeat: Optional[str]


class ProcessingStatusResponse(BaseModel):
    active_workers: int
    queued_events: int
    processed_events: int
    failed_events: int
    dlq_count: int
    stream_length: int
    pending_messages: int


class DLQEntry(BaseModel):
    message_id: str
    event_id: Optional[str]
    failure_reason: Optional[str]
    retry_count: int
    first_failed_at: Optional[str]
    last_failed_at: Optional[str]
    original_data: Optional[dict]


# ─── System Health ────────────────────────────────────────────────────────────

class ServiceHealth(BaseModel):
    status: str  # "healthy" | "degraded" | "unhealthy"
    latency_ms: Optional[float] = None
    details: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    services: dict[str, ServiceHealth]


# ─── Error ────────────────────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: Optional[str] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
