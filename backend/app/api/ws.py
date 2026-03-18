"""
WebSocket routes - aircraft real-time stream.
"""
import asyncio
import json
import logging
import threading
from typing import Optional, Set

from fastapi import APIRouter, WebSocket

from app.core.config import settings
from app.services.aircraft_service import get_latest_aircraft, REDIS_CHANNEL, _get_redis

router = APIRouter()
logger = logging.getLogger(__name__)

# Connected WebSocket clients
_connections: Set[WebSocket] = set()


def _redis_listener():
    """Background thread: subscribe to Redis and broadcast to WebSocket clients (no-op if Redis unavailable)."""
    try:
        r = _get_redis()
        if r is None:
            return
        pubsub = r.pubsub()
        pubsub.subscribe(REDIS_CHANNEL)
        for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = message.get("data")
            if not data or not _loop:
                continue
            # Broadcast to all connected clients
            dead = set()
            for ws in list(_connections):
                try:
                    future = asyncio.run_coroutine_threadsafe(ws.send_text(str(data)), _loop)
                    future.result(timeout=2)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                _connections.discard(ws)
    except Exception as e:
        logger.warning("Redis listener error: %s", e)


_loop: Optional[asyncio.AbstractEventLoop] = None
_listener_started = False


@router.websocket("/ws/aircraft")
async def ws_aircraft(websocket: WebSocket):
    global _loop, _listener_started
    await websocket.accept()
    _connections.add(websocket)
    if _loop is None:
        _loop = asyncio.get_running_loop()

    if not _listener_started:
        _listener_started = True
        t = threading.Thread(target=_redis_listener, daemon=True)
        t.start()

    # Send latest snapshot immediately
    try:
        latest = get_latest_aircraft()
        await websocket.send_json({
            "type": "aircraft_update",
            "data": latest,
            "ts": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        })
    except Exception as e:
        logger.debug("Send snapshot: %s", e)

    try:
        while True:
            _ = await websocket.receive_text()
    except Exception:
        pass
    finally:
        _connections.discard(websocket)
