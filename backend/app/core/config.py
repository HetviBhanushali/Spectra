"""
Application configuration using Pydantic Settings.
All values are loaded from environment variables or .env file.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Application ──────────────────────────────────────────────────────────
    environment: str = "development"
    log_level: str = "INFO"

    # ─── PostgreSQL ───────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://spectra:spectrapass@localhost:5432/spectra"
    )

    # ─── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"

    # ─── OpenSearch ───────────────────────────────────────────────────────────
    opensearch_url: str = "http://localhost:9200"

    # ─── JWT ──────────────────────────────────────────────────────────────────
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # ─── Redis Streams ────────────────────────────────────────────────────────
    stream_name: str = "spectra-events"
    consumer_group: str = "spectra-workers"
    max_retries: int = 3
    dlq_stream_name: str = "spectra-events-dlq"

    # ─── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
