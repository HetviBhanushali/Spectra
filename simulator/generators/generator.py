"""
Event generator — creates normalized event payloads from scenario templates.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


ENTITY_IDS = [f"user-{i:03d}" for i in range(1, 21)] + [
    f"service-{i:03d}" for i in range(1, 6)
]

PRODUCERS = [
    "api-gateway",
    "auth-service",
    "job-runner",
    "file-service",
    "payment-service",
    "config-service",
    "simulator",
]


def generate_event(
    overrides: dict[str, Any],
    entity_id: Optional[str] = None,
    producer: Optional[str] = None,
) -> dict[str, Any]:
    """Build a complete normalized event from optional overrides."""
    chosen_entity = entity_id or random.choice(ENTITY_IDS)
    event = {
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "event_type": overrides.get("event_type", "generic.event"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": overrides.get("source", "simulator"),
        "producer": producer or random.choice(PRODUCERS),
        "entity_id": chosen_entity,
        "entity_type": _infer_entity_type(chosen_entity),
        "action": overrides.get("action", "unknown"),
        "status": overrides.get("status", "success"),
        "metadata": overrides.get("metadata", _random_metadata()),
        "correlation_key": chosen_entity,
        "schema_version": "1.0",
    }
    return event


def generate_scenario_events(
    scenario_name: str,
    steps: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Generate a full sequence of events for a scenario, sharing entity_id."""
    entity_id = random.choice(ENTITY_IDS)
    producer = random.choice(PRODUCERS)
    events = []
    for step in steps:
        events.append(generate_event(step, entity_id=entity_id, producer=producer))
    return events


def generate_random_event() -> dict[str, Any]:
    from scenarios.scenarios import RANDOM_EVENT_TYPES  # type: ignore

    event_type = random.choice(RANDOM_EVENT_TYPES)
    status = random.choices(
        ["success", "failure", "pending"],
        weights=[75, 20, 5],
    )[0]
    return generate_event({"event_type": event_type, "status": status})


def _infer_entity_type(entity_id: str) -> str:
    if entity_id.startswith("user-"):
        return "user"
    if entity_id.startswith("service-"):
        return "service"
    return "entity"


def _random_metadata() -> dict[str, Any]:
    return {
        "source_ip": f"10.0.{random.randint(0, 10)}.{random.randint(1, 254)}",
        "region": random.choice(["us-east-1", "eu-west-1", "ap-south-1"]),
        "latency_ms": random.randint(5, 2000),
    }
