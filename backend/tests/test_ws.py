"""WebSocket smoke test."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_ws_aircraft_connect():
    """WebSocket /ws/aircraft accepts connection."""
    with client.websocket_connect("/ws/aircraft") as ws:
        data = ws.receive_json()
        assert "type" in data
        assert data["type"] in ("connected", "aircraft_update")
