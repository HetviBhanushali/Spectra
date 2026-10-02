# SPECTRA

> **An event processing and correlation platform built for reliable, scalable backend systems.**

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![Redis Streams](https://img.shields.io/badge/Redis-Streams%207.2-DC382D.svg)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org)
[![OpenSearch](https://img.shields.io/badge/OpenSearch-2.13-005FD3.svg)](https://opensearch.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docker.com)

---

## Architecture Overview

SPECTRA is a distributed event processing platform designed to ingest high-throughput event streams, evaluate pattern-matching rules, correlate multi-step workflows across time windows, handle transient failures with dead-letter queue (DLQ) guarantees, and expose unified telemetry through both an asynchronous REST API and a real-time web console.

```
                              ┌───────────────────────────────────────────────┐
                              │               SPECTRA Platform                │
                              └───────────────────────────────────────────────┘

  [ Clients / SDKs ]
  [ Event Simulator ]
          │
          ▼  POST /api/events (HTTP/JSON)
  ┌─────────────────────────────────┐
  │         FastAPI Backend         │ ◄─── OpenSearch Full-Text Queries
  │  - Schema Validation (Pydantic) │ ◄─── PostgreSQL Metadata & History
  │  - Idempotency Gate (Dedup)     │
  │  - Auth (JWT / RBAC)            │
  └───────────────┬─────────────────┘
                  │  XADD (Append)
                  ▼
  ┌─────────────────────────────────┐
  │       Redis Streams (7.2)       │
  │  Stream: spectra-events         │
  │  Group:  spectra-workers        │
  └───────────────┬─────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
  ┌───────────────┐   ┌───────────────┐
  │ Worker Pod 1  │   │ Worker Pod N  │
  │ (AsyncIO Pool)│   │ (AsyncIO Pool)│
  └───────┬───────┘   └───────┬───────┘
          │                   │
          ├───────────────────┴────────────────────┐
          ▼                                        ▼
  ┌─────────────────────────┐            ┌─────────────────────────┐
  │   Rules Engine Studio   │            │   Correlation Engine    │
  │ - Sliding Window Count  │            │ - Subsequence Matching  │
  │ - Attribute Thresholds  │            │ - Temporal Grouping     │
  │ - Redis Sorted Sets     │            │ - Confidence Scoring    │
  └───────────┬─────────────┘            └───────────┬─────────────┘
              │                                      │
              └──────────────────┬───────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       ┌───────────────────┐           ┌───────────────────┐
       │ PostgreSQL 16 DB  │           │   OpenSearch 2.13 │
       │ (ACID & Metadata) │           │ (Full-Text Index) │
       └───────────────────┘           └───────────────────┘
                 ▲                               ▲
                 │                               │
                 └───────────────┬───────────────┘
                                 │
                     ┌───────────────────────┐
                     │   React Web Console   │
                     │ (Vite + Nginx Engine) │
                     └───────────────────────┘
```

---

## Key Engineering Highlights

### 1. Reliable Asynchronous Ingestion & Idempotency
- Events are validated synchronously using Pydantic v2 schemas and assigned a unique `event_id`.
- The backend checks for duplicate events (`event_id` uniqueness) before appending to **Redis Streams** via `XADD`.
- Upon successful enqueue, the API immediately acknowledges with `HTTP 202 Accepted` and the assigned Redis stream ID.

### 2. Distributed Worker Pool & Consumer Groups
- Dedicated Python worker processes join the Redis consumer group `spectra-workers`.
- Events are consumed using `XREADGROUP` with automatic pending message re-delivery (`XPENDING` / `XCLAIM`) upon worker crash recovery.
- Strict **At-Least-Once Delivery**: Messages are only acknowledged (`XACK`) after all database transactions and OpenSearch indices commit successfully.

### 3. Fault Tolerance & Dead-Letter Queue (DLQ)
- Each event processing attempt is logged in PostgreSQL with duration and worker diagnostics.
- Transient errors undergo automatic retries with exponential backoff.
- Messages exceeding `MAX_RETRIES=3` are moved to the Dead-Letter Queue stream (`spectra-dlq`) with failure reasoning, preventing poisoned pills from blocking stream throughput.

### 4. Sliding-Window Rules & Correlation Engine
- **Rules Engine**: Evaluates threshold breaches and anomaly patterns across configurable sliding time windows using Redis Sorted Sets (`ZADD`, `ZREMRANGEBYSCORE`).
- **Correlation Engine**: Detects distributed multi-event sequences (e.g. `cart.added` &rarr; `checkout.initiated` &rarr; `payment.failed` &rarr; `payment.retry`) and groups them into correlation clusters with computed confidence scores.

### 5. Multi-Engine Persistence & Search
- **PostgreSQL 16**: Relational storage for users, rules, event metadata, processing attempts, and correlation records with Alembic migrations.
- **OpenSearch 2.13**: Full-text fuzzy search across raw payloads, metadata JSON attributes, entity IDs, and actions, with automatic fallback to relational query scanning.

### 6. Modern Web Dashboard
- Built with React 19, TypeScript, and Vite.
- Real-time telemetry: Live ingestion velocity area chart, event status donut distribution, stream depth, active worker count, and infrastructure status.
- Interactive Simulator Sandbox: Run pre-configured scenarios (E-Commerce Order Flow, Payment Decline & Retry, Brute-Force Anomaly Attack) or trigger custom concurrent bursts directly from the UI.

---

## Directory Structure

```
Spectra/
├── docker-compose.yml       # Production-ready multi-container orchestration
├── .env.example             # Configuration defaults
├── backend/                 # FastAPI REST API
│   ├── app/
│   │   ├── api/             # Routes: events, processing, correlations, rules, auth, health
│   │   ├── core/            # Config, DB, Redis, OpenSearch, Logging
│   │   ├── models/          # SQLAlchemy async models
│   │   ├── schemas/         # Pydantic validation models
│   │   └── services/        # Business logic & authentication
│   ├── migrations/          # Alembic database migrations
│   ├── tests/               # Pytest automated test suite
│   └── Dockerfile
├── worker/                  # Background stream consumer & correlation worker
│   ├── consumers/           # Redis consumer group handler
│   ├── correlation/         # Subsequence pattern detection & cluster engine
│   ├── rules/               # Sliding window and threshold rules
│   ├── main.py              # Worker pool supervisor & lifecycle
│   └── Dockerfile
├── simulator/               # Event scenario load generator & stress testing
│   ├── generators/          # Event generator & schema normalization
│   ├── scenarios/           # Pre-packaged multi-event sequences
│   ├── main.py              # CLI scenario & load runner
│   └── Dockerfile
└── frontend/                # React Vite Dashboard
    ├── src/
    │   ├── components/      # Dashboard, Explorer, Modal, Rules, DLQ, Simulator
    │   ├── api.ts           # Axios client with auto-auth and types
    │   ├── index.css        # Glassmorphic dark mode styling tokens
    │   └── App.tsx          # Root tab navigation and telemetry polling
    ├── nginx.conf           # SPA production reverse proxy
    └── Dockerfile
```

---

## Quickstart with Docker Compose

### Prerequisites
- Docker Engine 24+ and Docker Compose v2+

### 1. Launch Platform
```bash
# Clone the repository
git clone https://github.com/HetviBhanushali/Spectra.git
cd Spectra

# Copy environment template
cp .env.example .env

# Build and start all services
docker compose up -d --build
```

### 2. Verify Running Containers
```bash
docker compose ps
```
The following services will be running:
| Service | Internal Port | Host Port | Purpose |
|---|---|---|---|
| `spectra-frontend` | 80 | `http://localhost:3000` | Web Console & Simulator |
| `spectra-backend` | 8000 | `http://localhost:8000` | FastAPI REST API & Swagger |
| `spectra-worker` | - | - | Background stream workers (x3) |
| `spectra-postgres` | 5432 | `localhost:5432` | PostgreSQL 16 DB |
| `spectra-redis` | 6379 | `localhost:6379` | Redis Streams message bus |
| `spectra-opensearch`| 9200 | `localhost:9200` | OpenSearch 2.13 search engine |

### 3. Open Web Interfaces
- **Web Console**: [http://localhost:3000](http://localhost:3000)
- **API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## Running Event Simulations

### Option A: From Web Console
1. Open [http://localhost:3000](http://localhost:3000).
2. Click **Simulator Sandbox** in the top right corner.
3. Choose a scenario:
   - **E-Commerce Flow**: Ingests sequential order lifecycle events.
   - **Payment Decline**: Triggers retries and failure states.
   - **Brute-Force Attack**: Fires rapid failed authentications to trigger correlation rules.
   - **+10 / +25 Events**: Pushes concurrent bursts to observe queue throughput.

### Option B: From Command Line
Run the simulator container directly via Docker:
```bash
# Run all pre-packaged scenarios
docker compose run --rm simulator

# Generate 500 random events
docker compose run --rm simulator python main.py --count 500 --rate 50

# Run specific scenario
docker compose run --rm simulator python main.py --scenario suspicious_auth
```

---

## Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/events` | Ingest and enqueue event payload (`HTTP 202`) |
| `GET` | `/api/events` | Paginated event list with filters |
| `GET` | `/api/events/search?q={query}` | OpenSearch full-text query with DB fallback |
| `GET` | `/api/events/{event_id}` | Retrieve single event detail |
| `GET` | `/api/processing/status` | Real-time worker, queue, and DLQ metrics |
| `GET` | `/api/processing/failures` | List recent worker execution failure attempts |
| `GET` | `/api/processing/dlq` | Inspect dead-letter queue records |
| `GET` | `/api/correlations` | List active and historical correlation clusters |
| `GET` | `/api/rules` | List evaluated rules and sliding window thresholds |
| `PATCH`| `/api/rules/{rule_id}` | Enable or disable specific correlation rule |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token |
| `GET` | `/health` | Deep health check (DB, Redis, OpenSearch) |

---

## Testing

Run unit tests inside the backend container or locally:

```bash
cd backend
pytest -v
```

Tests cover:
- Pydantic schema validation & default assignments
- Password hashing & JWT token expiration / tampering verification
- Sequence subsequence pattern detection algorithms
- Sliding window and threshold rules logic

---

## License

MIT License. Designed and built for robust distributed systems engineering.
