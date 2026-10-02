"""
Event scenarios for the SPECTRA simulator.

Each scenario is a list of partial event dicts.
The generator fills in timestamps, event IDs, and metadata.
"""

from typing import Any

# Each item in a scenario is a dict of overrides to apply to the base event.
# The generator will fill in missing fields automatically.

SCENARIOS: dict[str, list[dict[str, Any]]] = {
    "normal_workflow": [
        {"event_type": "job.started", "action": "start", "status": "success"},
        {"event_type": "resource.accessed", "action": "read", "status": "success"},
        {"event_type": "resource.updated", "action": "write", "status": "success"},
        {"event_type": "job.completed", "action": "complete", "status": "success"},
    ],
    "failed_workflow": [
        {"event_type": "job.started", "action": "start", "status": "success"},
        {"event_type": "resource.accessed", "action": "read", "status": "success"},
        {"event_type": "request.failed", "action": "read", "status": "failure"},
        {"event_type": "request.failed", "action": "read", "status": "failure"},
        {"event_type": "job.failed", "action": "complete", "status": "failure"},
    ],
    "suspicious_sequence": [
        {"event_type": "user.login", "action": "authenticate", "status": "success"},
        {"event_type": "resource.accessed", "action": "read", "status": "success"},
        {"event_type": "permission.changed", "action": "modify", "status": "success"},
        {"event_type": "credential.created", "action": "create", "status": "success"},
    ],
    "payment_flow": [
        {"event_type": "user.login", "action": "authenticate", "status": "success"},
        {"event_type": "payment.created", "action": "create", "status": "pending"},
        {"event_type": "payment.created", "action": "process", "status": "success"},
        {"event_type": "user.logout", "action": "logout", "status": "success"},
    ],
    "file_download": [
        {"event_type": "user.login", "action": "authenticate", "status": "success"},
        {"event_type": "resource.accessed", "action": "read", "status": "success"},
        {"event_type": "file.downloaded", "action": "download", "status": "success"},
    ],
    "repeated_failures": [
        {"event_type": "request.failed", "action": "execute", "status": "failure"},
        {"event_type": "request.failed", "action": "execute", "status": "failure"},
        {"event_type": "request.failed", "action": "execute", "status": "failure"},
        {"event_type": "request.failed", "action": "execute", "status": "failure"},
        {"event_type": "request.failed", "action": "execute", "status": "failure"},
        {"event_type": "request.completed", "action": "execute", "status": "success"},
    ],
}

RANDOM_EVENT_TYPES = [
    "user.login",
    "user.logout",
    "resource.accessed",
    "resource.created",
    "resource.updated",
    "resource.deleted",
    "file.downloaded",
    "file.uploaded",
    "permission.changed",
    "credential.created",
    "job.started",
    "job.completed",
    "job.failed",
    "payment.created",
    "request.failed",
    "request.completed",
    "config.changed",
    "service.restarted",
]
