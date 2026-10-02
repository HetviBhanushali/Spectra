"""
SQLAlchemy ORM models for SPECTRA.

Tables:
  - users               Application users with RBAC roles
  - events_metadata     Record of every ingested event
  - correlations        Correlation groups spanning multiple events
  - rules               Configurable processing rules
  - rule_matches        Which rules fired against which events
  - processing_attempts Retry/failure history per event
  - audit_logs          Admin-level audit trail
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("ADMIN", "OPERATOR", "VIEWER", name="user_role"),
        nullable=False,
        default="VIEWER",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EventMetadata(Base):
    """Lightweight record for every ingested event — full event is in OpenSearch."""

    __tablename__ = "events_metadata"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    event_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    source: Mapped[str] = mapped_column(String(128), nullable=True)
    producer: Mapped[str] = mapped_column(String(128), nullable=True)
    entity_id: Mapped[str] = mapped_column(String(256), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(128), nullable=True)
    action: Mapped[str] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=True)
    correlation_key: Mapped[str] = mapped_column(String(256), nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(128), nullable=True)
    processing_status: Mapped[str] = mapped_column(
        Enum("queued", "processing", "processed", "failed", "dlq",
             name="processing_status"),
        default="queued",
        nullable=False,
    )
    event_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    schema_version: Mapped[str] = mapped_column(String(16), default="1.0")

    processing_attempts: Mapped[list["ProcessingAttempt"]] = relationship(
        "ProcessingAttempt", back_populates="event", cascade="all, delete-orphan"
    )
    rule_matches: Mapped[list["RuleMatch"]] = relationship(
        "RuleMatch", back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_events_metadata_event_id", "event_id"),
        Index("ix_events_metadata_correlation_key", "correlation_key"),
        Index("ix_events_metadata_entity_id", "entity_id"),
        Index("ix_events_metadata_processing_status", "processing_status"),
    )


class Correlation(Base):
    __tablename__ = "correlations"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    correlation_id: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False
    )
    correlation_key: Mapped[str] = mapped_column(String(256), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(256), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(128), nullable=True)
    event_ids: Mapped[list] = mapped_column(JSON, default=list)
    event_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        Enum("active", "completed", "expired", name="correlation_status"),
        default="active",
    )
    pattern_matched: Mapped[str] = mapped_column(String(128), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_correlations_correlation_key", "correlation_key"),
        Index("ix_correlations_entity_id", "entity_id"),
    )


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    rule_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    rule_type: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    configuration: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    rule_matches: Mapped[list["RuleMatch"]] = relationship(
        "RuleMatch", back_populates="rule", cascade="all, delete-orphan"
    )


class RuleMatch(Base):
    __tablename__ = "rule_matches"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    rule_id_fk: Mapped[str] = mapped_column(
        ForeignKey("rules.id"), nullable=False
    )
    event_id_fk: Mapped[str] = mapped_column(
        ForeignKey("events_metadata.id"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    context: Mapped[dict] = mapped_column(JSON, default=dict)

    rule: Mapped["Rule"] = relationship("Rule", back_populates="rule_matches")
    event: Mapped["EventMetadata"] = relationship(
        "EventMetadata", back_populates="rule_matches"
    )


class ProcessingAttempt(Base):
    __tablename__ = "processing_attempts"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    event_id_fk: Mapped[str] = mapped_column(
        ForeignKey("events_metadata.id"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("success", "failed", "dlq", name="attempt_status"),
        nullable=False,
    )
    failure_reason: Mapped[str] = mapped_column(Text, nullable=True)
    worker_id: Mapped[str] = mapped_column(String(64), nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    event: Mapped["EventMetadata"] = relationship(
        "EventMetadata", back_populates="processing_attempts"
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    actor_id: Mapped[str] = mapped_column(String(128), nullable=True)
    actor_username: Mapped[str] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[str] = mapped_column(String(128), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
