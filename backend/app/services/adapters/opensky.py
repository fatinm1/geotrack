"""
OpenSky Network API adapter for ADS-B state vectors.
Rate limiting and graceful failure handling.
"""
import logging
import time
from typing import Any, List, Optional

import httpx

logger = logging.getLogger(__name__)

OPENSKY_URL = "https://opensky-network.org/api/states/all"

# Maryland / Mid-Atlantic bounding box
DEFAULT_BBOX = {"lamin": 37.9, "lomin": -79.5, "lamax": 39.8, "lomax": -75.0}

# State vector indices (OpenSky format)
# 0: icao24, 1: callsign, 5: lon, 6: lat, 7: baro_altitude, 9: velocity, 10: true_track
I_ICAO24, I_CALLSIGN, I_LON, I_LAT = 0, 1, 5, 6
I_ALT, I_VEL, I_HEADING = 7, 9, 10


def fetch_states(
    bbox: Optional[dict] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    timeout: float = 10.0,
) -> List[dict[str, Any]]:
    """
    Fetch state vectors from OpenSky API.
    Returns list of dicts: icao24, callsign, lon, lat, altitude, velocity, heading, ts.
    """
    bbox = bbox or DEFAULT_BBOX
    auth = (username, password) if (username and password) else None

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(OPENSKY_URL, params=bbox, auth=auth)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("OpenSky API failed: %s", e)
        return []

    states = data.get("states") or []
    ts = data.get("time") or int(time.time())

    items = []
    for s in states:
        if not s or len(s) <= I_HEADING:
            continue
        lon, lat = s[I_LON], s[I_LAT]
        if lon is None or lat is None:
            continue
        items.append({
            "icao24": str(s[I_ICAO24]).strip().lower()[:6],
            "callsign": (str(s[I_CALLSIGN]).strip() if s[I_CALLSIGN] else None) or None,
            "lon": float(lon),
            "lat": float(lat),
            "altitude": float(s[I_ALT]) if s[I_ALT] is not None else None,
            "velocity": float(s[I_VEL]) if s[I_VEL] is not None else None,
            "heading": float(s[I_HEADING]) if s[I_HEADING] is not None else None,
            "ts": ts,
        })
    logger.info("OpenSky: fetched %d aircraft", len(items))
    return items
