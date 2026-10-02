"""
Rules Engine — evaluates configurable rules against processed events.

Rules are loaded from the database. Each rule has a type and configuration.
The engine is stateless per-event; state (for sequence/threshold rules) is
tracked in Redis using sorted sets and counters.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import redis.asyncio as aioredis

from config import get_worker_settings

settings = get_worker_settings()


@dataclass
class RuleResult:
    rule_id: str
    rule_name: str
    matched: bool
    context: dict[str, Any] = field(default_factory=dict)


class BaseRule(ABC):
    """Every rule implements evaluate() against a normalized event dict."""

    def __init__(self, rule_id: str, name: str, configuration: dict[str, Any]):
        self.rule_id = rule_id
        self.name = name
        self.configuration = configuration

    @abstractmethod
    async def evaluate(
        self,
        event: dict[str, Any],
        redis_client: aioredis.Redis,
    ) -> RuleResult:
        ...


class ThresholdRule(BaseRule):
    """
    Fires when the count of a specific event_type for an entity_id
    exceeds a threshold within a time window.

    Configuration keys:
      event_type    — e.g. "request.failed"
      threshold     — integer, e.g. 5
      window_seconds — integer, e.g. 300
    """

    async def evaluate(
        self, event: dict, redis_client: aioredis.Redis
    ) -> RuleResult:
        target_type = self.configuration.get("event_type", "")
        threshold = int(self.configuration.get("threshold", 5))
        window = int(self.configuration.get("window_seconds", 300))
        entity_id = event.get("entity_id", "unknown")

        if event.get("event_type") != target_type:
            return RuleResult(rule_id=self.rule_id, rule_name=self.name, matched=False)

        now = datetime.now(timezone.utc).timestamp()
        key = f"spectra:rule:{self.rule_id}:{entity_id}"

        # Add current event timestamp to a sorted set; score = timestamp
        await redis_client.zadd(key, {str(now): now})
        # Remove entries outside the window
        await redis_client.zremrangebyscore(key, "-inf", now - window)
        await redis_client.expire(key, window * 2)
        count = await redis_client.zcard(key)

        matched = count >= threshold
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            matched=matched,
            context={"count": count, "threshold": threshold, "window_seconds": window},
        )


class StatusRule(BaseRule):
    """
    Fires when an event has a specific status value.

    Configuration keys:
      status — e.g. "failure"
    """

    async def evaluate(
        self, event: dict, redis_client: aioredis.Redis
    ) -> RuleResult:
        target_status = self.configuration.get("status", "failure")
        matched = event.get("status") == target_status
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            matched=matched,
            context={"event_status": event.get("status"), "target": target_status},
        )


class SequenceRule(BaseRule):
    """
    Detects a sequence of event_types for the same correlation_key within a window.

    Configuration keys:
      sequence       — list of event_type strings in order, e.g. ["user.login", "permission.changed"]
      window_seconds — integer
    """

    async def evaluate(
        self, event: dict, redis_client: aioredis.Redis
    ) -> RuleResult:
        sequence: list[str] = self.configuration.get("sequence", [])
        window = int(self.configuration.get("window_seconds", 300))
        correlation_key = event.get("correlation_key") or event.get("entity_id", "")

        if not sequence or not correlation_key:
            return RuleResult(rule_id=self.rule_id, rule_name=self.name, matched=False)

        history_key = f"spectra:seq:{self.rule_id}:{correlation_key}"

        # Append current event type to the history list
        await redis_client.rpush(history_key, event.get("event_type", ""))
        await redis_client.expire(history_key, window)

        history = await redis_client.lrange(history_key, 0, -1)

        # Check if sequence is a sub-sequence of history
        matched = _is_subsequence(sequence, history)

        if matched:
            # Reset after match so it doesn't keep firing
            await redis_client.delete(history_key)

        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.name,
            matched=matched,
            context={"sequence": sequence, "history": history[-10:]},
        )


def _is_subsequence(needle: list[str], haystack: list[str]) -> bool:
    """Return True if needle appears as a (possibly non-contiguous) subsequence in haystack."""
    it = iter(haystack)
    return all(item in it for item in needle)


# ─── Registry ─────────────────────────────────────────────────────────────────

RULE_TYPE_MAP: dict[str, type[BaseRule]] = {
    "threshold": ThresholdRule,
    "status": StatusRule,
    "sequence": SequenceRule,
}


class RulesEngine:
    """Loads enabled rules from DB and evaluates them against an event."""

    def __init__(self):
        self._rules: list[BaseRule] = []

    async def load_rules(self, db_session) -> None:
        from sqlalchemy import select
        # Import model dynamically to avoid circular deps
        from models import Rule  # type: ignore

        result = await db_session.execute(
            select(Rule).where(Rule.enabled == True)  # noqa: E712
        )
        db_rules = result.scalars().all()

        self._rules = []
        for r in db_rules:
            rule_class = RULE_TYPE_MAP.get(r.rule_type)
            if rule_class:
                self._rules.append(
                    rule_class(
                        rule_id=r.rule_id,
                        name=r.name,
                        configuration=r.configuration or {},
                    )
                )

    async def evaluate_all(
        self, event: dict, redis_client: aioredis.Redis
    ) -> list[RuleResult]:
        results = []
        for rule in self._rules:
            try:
                result = await rule.evaluate(event, redis_client)
                results.append(result)
            except Exception as exc:
                # A broken rule must not block event processing
                results.append(
                    RuleResult(
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        matched=False,
                        context={"error": str(exc)},
                    )
                )
        return results
