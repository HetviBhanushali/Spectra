"""
OpenSearch client initialization and index management.
"""

from opensearchpy import AsyncOpenSearch

from app.core.config import get_settings

settings = get_settings()

_client: AsyncOpenSearch | None = None

INDEX_NAME = "spectra-events"

INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "event_id": {"type": "keyword"},
            "event_type": {"type": "keyword"},
            "timestamp": {"type": "date"},
            "source": {"type": "keyword"},
            "producer": {"type": "keyword"},
            "entity_id": {"type": "keyword"},
            "entity_type": {"type": "keyword"},
            "action": {"type": "keyword"},
            "status": {"type": "keyword"},
            "correlation_key": {"type": "keyword"},
            "correlation_id": {"type": "keyword"},
            "schema_version": {"type": "keyword"},
            "metadata": {"type": "object", "dynamic": True},
            "processed_at": {"type": "date"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}


def get_opensearch_client() -> AsyncOpenSearch:
    global _client
    if _client is None:
        _client = AsyncOpenSearch(
            hosts=[settings.opensearch_url],
            use_ssl=False,
            verify_certs=False,
        )
    return _client


async def close_opensearch() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


async def ensure_index() -> None:
    """Create the events index if it does not already exist."""
    client = get_opensearch_client()
    exists = await client.indices.exists(index=INDEX_NAME)
    if not exists:
        await client.indices.create(index=INDEX_NAME, body=INDEX_MAPPING)


async def index_event(event_doc: dict) -> None:
    """Index a single processed event document."""
    client = get_opensearch_client()
    await client.index(
        index=INDEX_NAME,
        id=event_doc["event_id"],
        body=event_doc,
    )


async def search_events(query: dict) -> dict:
    """Execute an arbitrary OpenSearch query and return raw results."""
    client = get_opensearch_client()
    return await client.search(index=INDEX_NAME, body=query)
