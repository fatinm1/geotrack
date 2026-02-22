"""
GeoTrack FastAPI Application
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, cameras, aircraft, detections
from app.api.ws import router as ws_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle - run migrations, start aircraft poller."""
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logger.info("Migrations applied")
    except Exception as e:
        logger.warning("Migrations skipped: %s", e)

    # Start aircraft background poller
    import asyncio
    from app.services.aircraft_poller import poll_loop
    _poller_task = asyncio.create_task(poll_loop())

    yield

    _poller_task.cancel()


app = FastAPI(
    title="GeoTrack API",
    description="Geospatial tracking: aircraft, traffic cameras, vision analytics",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(cameras.router, prefix="/api", tags=["cameras"])
app.include_router(aircraft.router, prefix="/api", tags=["aircraft"])
app.include_router(detections.router, prefix="/api", tags=["detections"])
app.include_router(ws_router, tags=["websocket"])


@app.get("/")
async def root():
    return {"service": "GeoTrack", "docs": "/docs"}
