"""Initial schema — all SPECTRA tables.

Revision ID: 0001
Revises: 
Create Date: 2026-10-01
"""

from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────────
    op.execute("CREATE TYPE user_role AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER')")
    op.execute(
        "CREATE TYPE processing_status AS ENUM "
        "('queued', 'processing', 'processed', 'failed', 'dlq')"
    )
    op.execute(
        "CREATE TYPE correlation_status AS ENUM ('active', 'completed', 'expired')"
    )
    op.execute(
        "CREATE TYPE attempt_status AS ENUM ('success', 'failed', 'dlq')"
    )

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(256), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(256), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM("ADMIN", "OPERATOR", "VIEWER", name="user_role", create_type=False),
            nullable=False,
            server_default="VIEWER",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # ── events_metadata ────────────────────────────────────────────────────────
    op.create_table(
        "events_metadata",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(128), nullable=False, unique=True),
        sa.Column("event_type", sa.String(128), nullable=False),
        sa.Column("source", sa.String(128), nullable=True),
        sa.Column("producer", sa.String(128), nullable=True),
        sa.Column("entity_id", sa.String(256), nullable=True),
        sa.Column("entity_type", sa.String(128), nullable=True),
        sa.Column("action", sa.String(128), nullable=True),
        sa.Column("status", sa.String(64), nullable=True),
        sa.Column("correlation_key", sa.String(256), nullable=True),
        sa.Column("correlation_id", sa.String(128), nullable=True),
        sa.Column(
            "processing_status",
            postgresql.ENUM(
                "queued", "processing", "processed", "failed", "dlq",
                name="processing_status",
                create_type=False,
            ),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("event_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("schema_version", sa.String(16), server_default="1.0"),
    )
    op.create_index("ix_events_metadata_event_id", "events_metadata", ["event_id"])
    op.create_index(
        "ix_events_metadata_correlation_key", "events_metadata", ["correlation_key"]
    )
    op.create_index(
        "ix_events_metadata_entity_id", "events_metadata", ["entity_id"]
    )
    op.create_index(
        "ix_events_metadata_processing_status",
        "events_metadata",
        ["processing_status"],
    )

    # ── correlations ───────────────────────────────────────────────────────────
    op.create_table(
        "correlations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("correlation_id", sa.String(128), nullable=False, unique=True),
        sa.Column("correlation_key", sa.String(256), nullable=False),
        sa.Column("entity_id", sa.String(256), nullable=True),
        sa.Column("entity_type", sa.String(128), nullable=True),
        sa.Column("event_ids", sa.JSON, nullable=True),
        sa.Column("event_count", sa.Integer, server_default="0"),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active", "completed", "expired",
                name="correlation_status",
                create_type=False,
            ),
            server_default="active",
        ),
        sa.Column("pattern_matched", sa.String(128), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_correlations_correlation_key", "correlations", ["correlation_key"]
    )
    op.create_index("ix_correlations_entity_id", "correlations", ["entity_id"])

    # ── rules ──────────────────────────────────────────────────────────────────
    op.create_table(
        "rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("rule_id", sa.String(128), nullable=False, unique=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("rule_type", sa.String(64), nullable=False),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("configuration", sa.JSON, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # ── rule_matches ───────────────────────────────────────────────────────────
    op.create_table(
        "rule_matches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "rule_id_fk",
            sa.String(36),
            sa.ForeignKey("rules.id"),
            nullable=False,
        ),
        sa.Column(
            "event_id_fk",
            sa.String(36),
            sa.ForeignKey("events_metadata.id"),
            nullable=False,
        ),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column(
            "matched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("context", sa.JSON, nullable=True),
    )

    # ── processing_attempts ────────────────────────────────────────────────────
    op.create_table(
        "processing_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "event_id_fk",
            sa.String(36),
            sa.ForeignKey("events_metadata.id"),
            nullable=False,
        ),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("attempt_number", sa.Integer, nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "success", "failed", "dlq",
                name="attempt_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("failure_reason", sa.Text, nullable=True),
        sa.Column("worker_id", sa.String(64), nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column(
            "attempted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # ── audit_logs ─────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(128), nullable=True),
        sa.Column("actor_username", sa.String(64), nullable=True),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_id", sa.String(128), nullable=True),
        sa.Column("details", sa.JSON, nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("processing_attempts")
    op.drop_table("rule_matches")
    op.drop_table("rules")
    op.drop_table("correlations")
    op.drop_table("events_metadata")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS attempt_status")
    op.execute("DROP TYPE IF EXISTS correlation_status")
    op.execute("DROP TYPE IF EXISTS processing_status")
    op.execute("DROP TYPE IF EXISTS user_role")
