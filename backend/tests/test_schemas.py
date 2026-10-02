"""
Tests for event schema validation and serialization.
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.schemas.events import EventCreate, EventQueued, EventResponse


def test_valid_event_creation():
    event = EventCreate(
        event_type="order.placed",
        entity_id="order_123",
        entity_type="order",
        action="create",
        status="success",
        metadata={"total": 99.99},
    )
    assert event.event_id.startswith("evt_")
    assert event.event_type == "order.placed"
    assert event.correlation_key == "order_123"  # Defaulted to entity_id
    assert event.timestamp is not None
    assert event.schema_version == "1.0"


def test_event_missing_type_fails():
    with pytest.raises(ValidationError):
        EventCreate(event_type="")


def test_event_whitespace_stripped():
    event = EventCreate(event_type="   user.signup   ")
    assert event.event_type == "user.signup"


def test_explicit_correlation_key():
    event = EventCreate(
        event_type="auth.login",
        entity_id="user_1",
        correlation_key="session_xyz",
    )
    assert event.correlation_key == "session_xyz"


def test_event_queued_schema():
    queued = EventQueued(event_id="evt_test", status="queued", stream_id="1710000000000-0")
    assert queued.event_id == "evt_test"
    assert queued.status == "queued"
    assert queued.stream_id == "1710000000000-0"
