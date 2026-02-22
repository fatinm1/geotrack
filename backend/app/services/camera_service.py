"""
Camera ingestion service - loads from MD CHART or mock and upserts to DB.
"""
import logging
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement

from app.models import TrafficCamera
from app.services.adapters.mdchart import fetch_cameras as fetch_mdchart
from app.services.adapters.mock_cameras import load_mock_cameras
from app.core.config import settings

logger = logging.getLogger(__name__)


def load_cameras(
    feed_url: Optional[str] = None,
    use_mock_if_empty: bool = True,
) -> List[dict]:
    """Load cameras from MD CHART feed or mock. Returns raw dicts."""
    url = feed_url or settings.mdchart_feed_url or "https://chart.maryland.gov/DataFeeds/GetCamerasJson"
    items = fetch_mdchart(feed_url=url)
    if not items and use_mock_if_empty:
        items = load_mock_cameras()
    return items


def upsert_cameras(db: Session, items: List[dict]) -> int:
    """Upsert camera records. Returns count upserted."""
    count = 0
    for row in items:
        try:
            geom = WKTElement(row["geom"], srid=4326)
            existing = db.query(TrafficCamera).filter(TrafficCamera.camera_id == row["camera_id"]).first()
            if existing:
                existing.name = row["name"]
                existing.geom = geom
                existing.stream_url = row["stream_url"]
                existing.snapshot_url = row.get("snapshot_url")
                existing.region = row.get("region")
            else:
                db.add(TrafficCamera(
                    camera_id=row["camera_id"],
                    name=row["name"],
                    geom=geom,
                    stream_url=row["stream_url"],
                    snapshot_url=row.get("snapshot_url"),
                    region=row.get("region"),
                ))
            count += 1
        except Exception as e:
            logger.warning("Skip camera %s: %s", row.get("camera_id"), e)
    db.commit()
    return count


def refresh_cameras(db: Session) -> int:
    """Load from source and upsert. Returns count."""
    items = load_cameras()
    return upsert_cameras(db, items)
