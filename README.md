# GeoTrack - Geospatial Tracking MVP

A web application for live aircraft positions (ADS-B via OpenSky), Maryland DOT traffic cameras, and safe computer vision analytics (vehicle counts + congestion scores).

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│  Next.js    │◀────│  FastAPI    │◀────│  + PostGIS  │
│  MapLibre   │     │  WebSockets │     └─────────────┘
└─────────────┘     └──────┬──────┘
       │                   │
       │                   │ pub/sub
       │                   ▼
       │            ┌─────────────┐
       └───────────▶│    Redis    │◀──── RQ Worker (detections)
                    └─────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) Node.js 18+ and Python 3.11 for local dev without Docker

### Run Locally with Docker

1. **Clone and enter the project:**
   ```bash
   cd geotrack
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env if needed (defaults work for MVP with mock data)
   ```

3. **Build and run:**
   ```bash
   docker compose up --build
   ```

4. **Expected URLs (once containers are up):**
   - **Frontend:** http://localhost:3000
   - **Backend API:** http://localhost:8000
   - **API Docs:** http://localhost:8000/docs
   - **Health check:** http://localhost:8000/health

5. **First-time setup:**
   - Backend runs migrations automatically on startup.
   - To manually run migrations: `docker compose exec backend alembic upgrade head`
   - To refresh cameras from MD CHART: `curl -X POST http://localhost:8000/api/cameras/refresh`
   - To trigger detection run: `curl -X POST http://localhost:8000/api/detections/run`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://geotrack:geotrack@postgres:5432/geotrack | Postgres connection |
| REDIS_URL | redis://redis:6379/0 | Redis connection |
| USE_MOCK_OPENSKY | false | Use OpenSky API (real); set true for mock |
| USE_MOCK_DETECTOR | true | Use mock detector vs real CV model |
| DETECTIONS_ENABLED | false | Enable detection worker jobs |
| OPENSKY_POLL_SECONDS | 5 | Poll interval for aircraft |
| DETECTION_INTERVAL_SECONDS | 20 | Detection job interval per camera |

## Project Structure

```
geotrack/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── core/      # Config, dependencies
│   │   ├── db/        # Database session, base
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic, adapters
│   │   ├── workers/   # RQ worker + jobs
│   │   └── utils/     # Helpers
│   ├── alembic/       # Migrations
│   └── tests/
├── frontend/          # Next.js App Router
│   ├── app/
│   ├── components/
│   └── lib/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Deploy on Railway

Deploy the app (frontend + backend in one service) and PostgreSQL (separate service) on [Railway](https://railway.app).

**Required files (must be committed and pushed):** root `Dockerfile`, `Caddyfile`, `scripts/start.sh`, and `railway.toml`. If Railway reports "Script start.sh not found" or uses Railpack instead of Docker, ensure these files are in your repo and on the branch Railway deploys from.

### 1. Create a project and add PostgreSQL

1. In [Railway](https://railway.app), create a new project.
2. Add a **PostgreSQL** service (e.g. “Add PostgreSQL” from the dashboard).
3. In the Postgres service, open **Variables** and copy the `DATABASE_URL` (or note the reference, e.g. `${{Postgres.DATABASE_URL}}`).

### 2. Deploy the app (frontend + backend)

1. Add a new service: **Deploy from GitHub repo** (or “Empty service” and connect repo later).
2. Select this repository. Railway will detect the **root Dockerfile** and build the image.
3. In the app service **Variables**, set:
   - **DATABASE_URL** – **Required.** Use the Postgres service URL: in the Postgres service open **Variables** and copy `DATABASE_URL`, or in the app service add a variable and reference it (e.g. `${{Postgres.DATABASE_URL}}`). If this is missing or wrong, migrations will fail and the deploy will error.
   - **PORT** – Railway sets this automatically; do not override.
   - Optional: **REDIS_URL** – if you add a Redis service for live WebSocket updates and detection jobs; without it the app still runs (aircraft list via REST, no live push).
   - Optional: **NEXT_PUBLIC_API_URL** and **NEXT_PUBLIC_WS_URL** – leave unset for same-origin (recommended); or set to the app’s public URL.
4. Deploy. The root Dockerfile runs migrations on startup (with retries), then serves the app behind Caddy on `PORT`.

### 3. (Optional) Redis

For live aircraft/camera updates and detection jobs, add a **Redis** service in Railway and set **REDIS_URL** in the app service (e.g. `${{Redis.REDIS_URL}}`). Without Redis, WebSocket and RQ features may be limited.

### Summary

| Service   | Role                          |
|----------|--------------------------------|
| **App**  | Frontend + Backend (one container, Caddy on `PORT`) |
| **Postgres** | Database (`DATABASE_URL`)   |

## How to Extend

- **Add more states' cameras:** Implement a new adapter in `services/adapters/` and wire it to a refresh job.
- **Add satellite imagery:** Add a MapLibre raster source with WMS/WMTS tiles (e.g., Sentinel) in the frontend map config.
- **Add real segmentation model:** Replace the mock detector in `workers/detector.py` with a YOLO/DeepLab-style model; keep the same output schema (vehicle_count, congestion_score).

## Next Steps

1. Enable real OpenSky: set `USE_MOCK_OPENSKY=false` and optionally add credentials.
2. Enable detections: set `DETECTIONS_ENABLED=true` and optionally plug a real model.
3. Configure MD CHART feed URL if using real Maryland cameras.
