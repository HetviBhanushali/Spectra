"""
GET /health — Liveness (are we running?)
GET /ready  — Readiness (are dependencies up?)
"""

import time
from fastapi import APIRouter
from app.core.config import get_settings
from app.schemas.common import HealthResponse, ServiceHealth

router = APIRouter(tags=["system"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health():
    return HealthResponse(
        status="healthy",
        services={
            "api": ServiceHealth(status="healthy"),
        },
    )


@router.get("/ready", response_model=HealthResponse, summary="Readiness check")
async def ready():
    services: dict[str, ServiceHealth] = {}
    overall = "healthy"

    # ─── PostgreSQL ───────────────────────────────────────────────────────
    try:
        from app.core.database import engine
        t0 = time.monotonic()
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        services["postgres"] = ServiceHealth(
            status="healthy", latency_ms=round((time.monotonic() - t0) * 1000, 2)
        )
    except Exception as exc:
        services["postgres"] = ServiceHealth(status="unhealthy", details=str(exc))
        overall = "degraded"

    # ─── Redis ────────────────────────────────────────────────────────────
    try:
        from app.core.redis import get_redis
        t0 = time.monotonic()
        client = await get_redis()
        await client.ping()
        services["redis"] = ServiceHealth(
            status="healthy", latency_ms=round((time.monotonic() - t0) * 1000, 2)
        )
    except Exception as exc:
        services["redis"] = ServiceHealth(status="unhealthy", details=str(exc))
        overall = "degraded"

    # ─── OpenSearch ───────────────────────────────────────────────────────
    try:
        from app.core.opensearch import get_opensearch_client
        t0 = time.monotonic()
        os_client = get_opensearch_client()
        await os_client.ping()
        services["opensearch"] = ServiceHealth(
            status="healthy", latency_ms=round((time.monotonic() - t0) * 1000, 2)
        )
    except Exception as exc:
        services["opensearch"] = ServiceHealth(status="unhealthy", details=str(exc))
        overall = "degraded"

    return HealthResponse(status=overall, services=services)
