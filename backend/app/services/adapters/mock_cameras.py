"""
Mock traffic camera loader for when MD CHART feed is unavailable.
Returns sample cameras in Maryland bounding box.
"""
import logging
from typing import Any, List

logger = logging.getLogger(__name__)

# Maryland approximate bounding box
MD_BBOX = {
    "min_lon": -79.5,
    "max_lon": -75.0,
    "min_lat": 37.9,
    "max_lat": 39.8,
}

MOCK_CAMERAS = [
    {"name": "I-95 @ Baltimore", "lon": -76.61, "lat": 39.28},
    {"name": "I-495 @ Bethesda", "lon": -77.10, "lat": 39.00},
    {"name": "US 50 @ Annapolis", "lon": -76.49, "lat": 38.98},
    {"name": "I-83 @ Timonium", "lon": -76.63, "lat": 39.44},
    {"name": "I-270 @ Rockville", "lon": -77.15, "lat": 39.08},
    {"name": "I-695 @ Towson", "lon": -76.60, "lat": 39.40},
    {"name": "US 50 @ Kent Narrows", "lon": -76.24, "lat": 38.97},
    {"name": "I-70 @ Frederick", "lon": -77.42, "lat": 39.40},
]


def load_mock_cameras() -> List[dict[str, Any]]:
    """Return mock camera records for MVP when feed unavailable."""
    items = []
    base_stream = "https://chart.maryland.gov/Video/GetVideo/"
    for i, cam in enumerate(MOCK_CAMERAS):
        cam_id = f"mock_cam_{i+1:03d}"
        items.append({
            "camera_id": cam_id,
            "name": cam["name"],
            "geom": f"POINT({cam['lon']} {cam['lat']})",
            "stream_url": f"{base_stream}{cam_id}",
            "snapshot_url": None,
            "region": "Maryland",
        })
    logger.info("Loaded %d mock cameras", len(items))
    return items
