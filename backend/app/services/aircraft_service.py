"""
Aircraft service - poll OpenSky or mock, publish to Redis, cache latest.
Redis is optional: if unavailable, publish/get no-op and WebSocket uses REST fallback.
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import redis

from app.core.config import settings
from app.services.adapters.opensky import fetch_states as fetch_opensky
from app.services.adapters.mock_aircraft import generate_mock_aircraft

logger = logging.getLogger(__name__)

REDIS_CHANNEL = "aircraft_updates"
REDIS_KEY_LATEST = "aircraft:latest"

_redis_available: Optional[bool] = None


def _get_redis() -> Optional[redis.Redis]:
    """Return Redis client or None if Redis is not available (log once)."""
    global _redis_available
    if _redis_available is False:
        return None
    try:
        r = redis.from_url(settings.redis_url, decode_responses=True)
        r.ping()
        _redis_available = True
        return r
    except Exception as e:
        if _redis_available is None:
            logger.info("Redis not available (%s); live aircraft updates disabled. Set REDIS_URL to enable.", e)
        _redis_available = False
        return None


def _states_to_json(states: List[dict]) -> str:
    """Serialize for WebSocket/Redis."""
    return json.dumps({
        "type": "aircraft_update",
        "data": states,
        "ts": datetime.utcnow().isoformat() + "Z",
    })


def fetch_aircraft() -> List[dict]:
    """Fetch aircraft from OpenSky or mock based on config."""
    if settings.use_mock_opensky:
        return generate_mock_aircraft()
    return fetch_opensky(
        username=settings.opensky_username,
        password=settings.opensky_password,
    )


def publish_aircraft(states: List[dict]) -> None:
    """Publish aircraft states to Redis channel and update cache (no-op if Redis unavailable)."""
    r = _get_redis()
    if r is None:
        return
    try:
        payload = _states_to_json(states)
        r.publish(REDIS_CHANNEL, payload)
        r.set(REDIS_KEY_LATEST, payload, ex=60)
        logger.debug("Published %d aircraft", len(states))
    except Exception as e:
        logger.debug("Redis publish failed: %s", e)


def get_latest_aircraft() -> List[dict]:
    """Get latest aircraft from Redis cache (empty list if Redis unavailable)."""
    r = _get_redis()
    if r is None:
        return []
    try:
        raw = r.get(REDIS_KEY_LATEST)
        if raw:
            data = json.loads(raw)
            return data.get("data", [])
    except Exception:
        pass
    return []
