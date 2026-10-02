"""
Worker configuration — mirrors backend settings for shared infrastructure.
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    log_level: str = "INFO"

    database_url: str = (
        "postgresql+asyncpg://spectra:spectrapass@localhost:5432/spectra"
    )
    redis_url: str = "redis://localhost:6379"
    opensearch_url: str = "http://opensearch:9200"

    worker_count: int = 3
    stream_name: str = "spectra-events"
    consumer_group: str = "spectra-workers"
    max_retries: int = 3
    dlq_stream_name: str = "spectra-events-dlq"

    # How long to block waiting for new messages (ms)
    read_block_ms: int = 2000
    # How many messages to read per batch
    read_count: int = 10
    # Window for time-based correlation (seconds)
    correlation_window_seconds: int = 300


@lru_cache
def get_worker_settings() -> WorkerSettings:
    return WorkerSettings()
