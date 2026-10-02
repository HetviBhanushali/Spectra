"""
SPECTRA — FastAPI application entry point.

Startup sequence:
  1. Configure logging
  2. Run Alembic migrations (handled by Docker CMD)
  3. Ensure Redis consumer group exists
  4. Ensure OpenSearch index exists
  5. Seed default admin user if none exists
"""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, correlations, events, health, processing, rules
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.opensearch import close_opensearch, ensure_index
from app.core.redis import close_redis, ensure_consumer_group

settings = get_settings()
configure_logging()
logger = get_logger("spectra.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("SPECTRA starting up", environment=settings.environment)

    # Ensure Redis consumer group
    await ensure_consumer_group()
    logger.info("Redis consumer group ready", group=settings.consumer_group)

    # Ensure OpenSearch index
    await ensure_index()
    logger.info("OpenSearch index ready")

    # Seed default admin user
    await _seed_admin()

    logger.info("SPECTRA ready")
    yield

    # Cleanup
    await close_redis()
    await close_opensearch()
    logger.info("SPECTRA shut down cleanly")


async def _seed_admin() -> None:
    """Create a default admin user if no users exist."""
    from sqlalchemy import select, func
    from app.core.database import AsyncSessionLocal
    from app.models import User
    from app.services.auth_service import hash_password

    async with AsyncSessionLocal() as session:
        count_result = await session.execute(select(func.count()).select_from(User))
        count = count_result.scalar_one()
        if count == 0:
            admin = User(
                username="admin",
                email="admin@spectra.local",
                hashed_password=hash_password("admin123"),
                role="ADMIN",
            )
            session.add(admin)
            await session.commit()
            logger.info(
                "Default admin user created",
                username="admin",
                note="Change the password immediately in production",
            )


app = FastAPI(
    title="SPECTRA",
    description=(
        "An event processing and correlation platform built for "
        "reliable, scalable backend systems."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request ID Middleware ─────────────────────────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id", str(uuid.uuid4())[:8])
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


# ─── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("X-Request-Id", "unknown")
    logger.error(
        "Unhandled exception",
        path=str(request.url),
        method=request.method,
        request_id=request_id,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "request_id": request_id,
            }
        },
    )


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(correlations.router)
app.include_router(rules.router)
app.include_router(processing.router)
