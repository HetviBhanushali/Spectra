"""
Redis connection pool and helper for stream operations.
"""

from typing import Optional
import redis.asyncio as aioredis

from app.core.config import get_settings

settings = get_settings()

_redis_pool: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Return the shared Redis connection pool (creates it on first call)."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _redis_pool


async def close_redis() -> None:
    """Close the Redis connection pool on shutdown."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None


async def publish_event(payload: dict) -> str:
    """
    Publish a normalized event to the Redis stream.

    Returns the Redis Stream message ID (e.g. '1700000000000-0').
    We store the raw JSON string so workers can decode independently.
    """
    import json

    client = await get_redis()
    msg_id = await client.xadd(
        settings.stream_name,
        {"data": json.dumps(payload)},
    )
    return msg_id


async def ensure_consumer_group() -> None:
    """
    Create the consumer group if it does not already exist.
    Called during application startup.
    """
    client = await get_redis()
    try:
        await client.xgroup_create(
            settings.stream_name,
            settings.consumer_group,
            id="0",
            mkstream=True,
        )
    except Exception as exc:
        # BUSYGROUP means the group already exists — safe to ignore
        if "BUSYGROUP" not in str(exc):
            raise
