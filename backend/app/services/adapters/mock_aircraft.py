"""
Mock aircraft generator - random planes over bounding box for MVP.
"""
import logging
import random
import time
from typing import List

logger = logging.getLogger(__name__)

# Maryland / Mid-Atlantic
BBOX = {"min_lon": -79.5, "max_lon": -75.0, "min_lat": 37.9, "max_lat": 39.8}

CALLSIGNS = [
    "UAL123", "AAL456", "SWA789", "DAL321", "N12345", "FDX100",
    "UPS200", "JBU50", "ASA101", "SKW234", "GPD567", "FTH89",
]


def _hex6() -> str:
    return "".join(random.choices("0123456789abcdef", k=6))


def generate_mock_aircraft(count: int = 15) -> List[dict]:
    """Generate mock aircraft state vectors."""
    items = []
    for _ in range(count):
        lon = random.uniform(BBOX["min_lon"], BBOX["max_lon"])
        lat = random.uniform(BBOX["min_lat"], BBOX["max_lat"])
        items.append({
            "icao24": _hex6(),
            "callsign": random.choice(CALLSIGNS) if random.random() > 0.2 else None,
            "lon": lon,
            "lat": lat,
            "altitude": random.uniform(500, 40000) if random.random() > 0.1 else None,
            "velocity": random.uniform(100, 500) if random.random() > 0.1 else None,
            "heading": random.uniform(0, 360) if random.random() > 0.1 else None,
            "ts": int(time.time()),
        })
    return items
