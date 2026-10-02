"""
SPECTRA Event Simulator

Usage:
  python main.py                         # Run all scenarios once
  python main.py --count 1000            # Generate 1000 random events
  python main.py --scenario normal_workflow  # Run a specific scenario
  python main.py --count 100 --delay 0.01    # 100 events with 10ms delay between

Environment variables:
  BACKEND_URL — defaults to http://localhost:8000
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time

import httpx
import structlog

# Add simulator package to path
sys.path.insert(0, os.path.dirname(__file__))

from generators.generator import (  # type: ignore
    generate_random_event,
    generate_scenario_events,
)
from scenarios.scenarios import SCENARIOS  # type: ignore

log = structlog.get_logger("spectra.simulator")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
EVENTS_ENDPOINT = f"{BACKEND_URL}/api/events"

# Default credentials — seeded by the API on first startup
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"


async def get_token(client: httpx.AsyncClient) -> str | None:
    """Authenticate and return a Bearer token."""
    try:
        resp = await client.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"username": DEFAULT_USERNAME, "password": DEFAULT_PASSWORD},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()["access_token"]
        log.warning("Auth failed", status=resp.status_code, body=resp.text)
    except Exception as exc:
        log.warning("Could not authenticate", error=str(exc))
    return None


async def send_event(
    client: httpx.AsyncClient,
    event: dict,
    token: str | None,
) -> bool:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = await client.post(
            EVENTS_ENDPOINT,
            json=event,
            headers=headers,
            timeout=10,
        )
        if resp.status_code in (200, 202):
            return True
        log.warning("Event rejected", status=resp.status_code, event_type=event.get("event_type"))
        return False
    except Exception as exc:
        log.error("Failed to send event", error=str(exc))
        return False


async def run_scenarios(
    client: httpx.AsyncClient,
    token: str | None,
    delay: float = 0.05,
) -> dict:
    stats = {"sent": 0, "failed": 0}
    for name, steps in SCENARIOS.items():
        events = generate_scenario_events(name, steps)
        log.info("Running scenario", scenario=name, events=len(events))
        for evt in events:
            ok = await send_event(client, evt, token)
            if ok:
                stats["sent"] += 1
            else:
                stats["failed"] += 1
            await asyncio.sleep(delay)
    return stats


async def run_load(
    client: httpx.AsyncClient,
    token: str | None,
    count: int,
    delay: float,
) -> dict:
    stats = {"sent": 0, "failed": 0}
    t_start = time.monotonic()

    for i in range(count):
        evt = generate_random_event()
        ok = await send_event(client, evt, token)
        if ok:
            stats["sent"] += 1
        else:
            stats["failed"] += 1

        if delay > 0:
            await asyncio.sleep(delay)

        if (i + 1) % 100 == 0:
            elapsed = time.monotonic() - t_start
            throughput = (i + 1) / elapsed if elapsed > 0 else 0
            log.info(
                "Progress",
                sent=i + 1,
                total=count,
                throughput_per_s=round(throughput, 1),
            )

    elapsed = time.monotonic() - t_start
    stats["elapsed_s"] = round(elapsed, 2)
    stats["throughput"] = round(stats["sent"] / elapsed, 1) if elapsed > 0 else 0
    return stats


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="SPECTRA event simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--count",
        type=int,
        default=None,
        help="Number of random events to generate. If omitted, runs all scenarios.",
    )
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()),
        default=None,
        help="Run a specific scenario only.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.02,
        help="Delay between events in seconds (default: 0.02)",
    )
    args = parser.parse_args()

    async with httpx.AsyncClient() as client:
        # Wait for backend to be reachable
        for attempt in range(10):
            try:
                resp = await client.get(f"{BACKEND_URL}/health", timeout=5)
                if resp.status_code == 200:
                    log.info("Backend reachable", url=BACKEND_URL)
                    break
            except Exception:
                pass
            log.info("Waiting for backend...", attempt=attempt + 1)
            await asyncio.sleep(3)
        else:
            log.error("Backend not reachable after retries", url=BACKEND_URL)
            sys.exit(1)

        token = await get_token(client)

        if args.count:
            log.info("Starting load generation", count=args.count, delay=args.delay)
            stats = await run_load(client, token, args.count, args.delay)
        elif args.scenario:
            steps = SCENARIOS[args.scenario]
            events = generate_scenario_events(args.scenario, steps)
            stats = {"sent": 0, "failed": 0}
            for evt in events:
                ok = await send_event(client, evt, token)
                stats["sent" if ok else "failed"] += 1
                await asyncio.sleep(args.delay)
        else:
            log.info("Running all scenarios")
            stats = await run_scenarios(client, token, delay=args.delay)

    log.info("Simulation complete", **stats)


if __name__ == "__main__":
    asyncio.run(main())
