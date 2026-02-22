"""
Background aircraft poller - fetches from OpenSky/mock and publishes to Redis.
"""
import asyncio
import logging

from app.core.config import settings
from app.services.aircraft_service import fetch_aircraft, publish_aircraft

logger = logging.getLogger(__name__)


async def poll_loop():
    """Poll aircraft at configured interval and publish to Redis."""
    interval = max(1, settings.opensky_poll_seconds)
    logger.info("Aircraft poller started, interval=%ds", interval)
    while True:
        try:
            states = fetch_aircraft()
            publish_aircraft(states)
        except Exception as e:
            logger.warning("Aircraft poll error: %s", e)
        await asyncio.sleep(interval)
