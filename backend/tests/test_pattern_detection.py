"""
Tests for event sequence matching and correlation pattern detection.
"""

def is_subsequence(needle: list[str], haystack: list[str]) -> bool:
    it = iter(haystack)
    return all(item in it for item in needle)


def detect_pattern(event_types: list[str], patterns: dict[str, list[str]]) -> str | None:
    for pattern_name, sequence in patterns.items():
        if is_subsequence(sequence, event_types):
            return pattern_name
    return None


PATTERNS = {
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
}


def test_exact_sequence_match():
    stream = ["job.started", "resource.accessed", "job.completed"]
    assert detect_pattern(stream, PATTERNS) == "normal_workflow"


def test_interleaved_events_matching():
    # Intermediate noise events shouldn't break subsequence matching
    stream = [
        "job.started",
        "heartbeat.sent",
        "metric.logged",
        "request.failed",
        "cache.flushed",
        "job.failed",
    ]
    assert detect_pattern(stream, PATTERNS) == "failed_workflow"


def test_partial_sequence_no_match():
    stream = ["user.login", "resource.accessed"]
    assert detect_pattern(stream, PATTERNS) is None


def test_out_of_order_no_match():
    # Pattern requires order to matter
    stream = ["job.completed", "resource.accessed", "job.started"]
    assert detect_pattern(stream, PATTERNS) is None
