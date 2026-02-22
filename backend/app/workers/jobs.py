"""
RQ job definitions for GeoTrack.
"""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models import TrafficCamera, CameraDetection
from app.workers.detector import run_detection

logger = logging.getLogger(__name__)

engine = create_engine(settings.database_url, pool_pre_ping=True)
Session = sessionmaker(bind=engine)


def fetch_image_bytes(url: str) -> Optional[bytes]:
    """Fetch snapshot image from URL. Returns None on failure."""
    try:
        import httpx
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception as e:
        logger.warning("Failed to fetch image %s: %s", url, e)
        return None


def run_detection_for_camera(camera_id: str) -> Optional[dict]:
    """Run detection for a single camera. Returns result dict or None."""
    db = Session()
    try:
        cam = db.query(TrafficCamera).filter(TrafficCamera.camera_id == camera_id).first()
        if not cam:
            logger.warning("Camera %s not found", camera_id)
            return None
        snapshot_url = cam.snapshot_url
        if not snapshot_url:
            # Use mock detector without image when no snapshot
            result = run_detection()
        else:
            img_bytes = fetch_image_bytes(snapshot_url)
            if img_bytes:
                result = run_detection(image_bytes=img_bytes)
            else:
                result = run_detection()

        db.add(CameraDetection(
            camera_id=camera_id,
            ts=result["timestamp"],
            vehicle_count=result["vehicle_count"],
            congestion_score=result["congestion_score"],
            meta=result.get("meta"),
        ))
        db.commit()
        return result
    except Exception as e:
        logger.exception("Detection failed for %s: %s", camera_id, e)
        db.rollback()
        return None
    finally:
        db.close()


def run_detection_batch():
    """
    RQ job: run detection for all cameras that have detection enabled.
    In MVP we run for all cameras; when DETECTIONS_ENABLED=false this job is not scheduled.
    """
    if not settings.detections_enabled:
        logger.info("Detections disabled, skipping")
        return {"processed": 0, "skipped": True}

    db = Session()
    try:
        cameras = db.query(TrafficCamera).all()
        processed = 0
        for cam in cameras:
            run_detection_for_camera(cam.camera_id)
            processed += 1
        return {"processed": processed}
    finally:
        db.close()
