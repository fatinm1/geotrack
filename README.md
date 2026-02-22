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

## How to Extend

- **Add more states' cameras:** Implement a new adapter in `services/adapters/` and wire it to a refresh job.
- **Add satellite imagery:** Add a MapLibre raster source with WMS/WMTS tiles (e.g., Sentinel) in the frontend map config.
- **Add real segmentation model:** Replace the mock detector in `workers/detector.py` with a YOLO/DeepLab-style model; keep the same output schema (vehicle_count, congestion_score).

## Next Steps

1. Enable real OpenSky: set `USE_MOCK_OPENSKY=false` and optionally add credentials.
2. Enable detections: set `DETECTIONS_ENABLED=true` and optionally plug a real model.
3. Configure MD CHART feed URL if using real Maryland cameras.
