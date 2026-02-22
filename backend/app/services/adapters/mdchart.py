"""
MD CHART traffic camera feed adapter.
Fetches camera metadata from Maryland DOT CHART API.
"""
import logging
from typing import Any, List, Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_FEED_URL = "https://chart.maryland.gov/DataFeeds/GetCamerasJson"


def _point_wkt(lon: float, lat: float) -> str:
    return f"POINT({lon} {lat})"


def fetch_cameras(
    feed_url: str = DEFAULT_FEED_URL,
    timeout: float = 15.0,
) -> List[dict[str, Any]]:
    """
    Fetch traffic camera metadata from MD CHART JSON feed.
    Returns list of dicts suitable for traffic_cameras table.
    """
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(feed_url)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as e:
        logger.warning("MD CHART feed unavailable: %s", e)
        return []

    items: List[dict[str, Any]] = []
    for cam in raw:
        cam_id = cam.get("id")
        name = cam.get("name") or cam.get("description") or str(cam_id)
        lon = cam.get("lon")
        lat = cam.get("lat")
        stream_url = cam.get("publicVideoURL") or ""
        if not cam_id or not stream_url or lon is None or lat is None:
            continue
        region = None
        cats = cam.get("cameraCategories")
        if cats and isinstance(cats, list):
            region = str(cats[0]) if cats else None
        snapshot_url = None  # MD CHART doesn't expose snapshot URL in this feed
        items.append({
            "camera_id": str(cam_id)[:64],
            "name": str(name)[:256],
            "geom": _point_wkt(float(lon), float(lat)),
            "stream_url": stream_url,
            "snapshot_url": snapshot_url,
            "region": str(region)[:128] if region else None,
        })
    logger.info("Fetched %d cameras from MD CHART", len(items))
    return items
