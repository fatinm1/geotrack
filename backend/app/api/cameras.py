"""
Cameras API - list cameras with optional latest detection summary.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.db import get_db
from app.models import TrafficCamera, CameraDetection
from app.services.camera_service import refresh_cameras

router = APIRouter()


def _cam_to_item(cam: TrafficCamera, lon: float, lat: float, vehicle_count: Optional[int] = None, congestion_score: Optional[float] = None) -> dict:
    """Convert TrafficCamera to API item."""
    return {
        "camera_id": cam.camera_id,
        "name": cam.name,
        "lon": lon,
        "lat": lat,
        "stream_url": cam.stream_url,
        "region": cam.region,
        "vehicle_count": vehicle_count,
        "congestion_score": congestion_score,
    }


@router.get("/cameras", response_model=dict)
async def list_cameras(
    db: Session = Depends(get_db),
    refresh: bool = False,
):
    """
    List traffic cameras with latest detection summary.
    If DB is empty and refresh=False, auto-refreshes from source.
    """
    count = db.query(TrafficCamera).count()
    if count == 0 or refresh:
        try:
            refresh_cameras(db)
            count = db.query(TrafficCamera).count()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Camera refresh failed: %s", e)

    # Subquery for latest detection per camera
    latest = (
        db.query(
            CameraDetection.camera_id,
            CameraDetection.vehicle_count,
            CameraDetection.congestion_score,
        )
        .distinct(CameraDetection.camera_id)
        .order_by(CameraDetection.camera_id, desc(CameraDetection.ts))
    )
    # Simpler: get all detections, take latest per camera in Python
    detections = {}
    for d in db.query(CameraDetection).order_by(desc(CameraDetection.ts)):
        if d.camera_id not in detections:
            detections[d.camera_id] = {"vehicle_count": d.vehicle_count, "congestion_score": d.congestion_score}

    items = []
    rows = db.query(
        TrafficCamera,
        func.ST_X(TrafficCamera.geom).label("lon"),
        func.ST_Y(TrafficCamera.geom).label("lat"),
    ).all()
    for cam, lon, lat in rows:
        det = detections.get(cam.camera_id, {})
        items.append(_cam_to_item(
            cam, float(lon or 0), float(lat or 0),
            vehicle_count=det.get("vehicle_count"),
            congestion_score=det.get("congestion_score"),
        ))

    return {"items": items}


@router.post("/cameras/refresh")
async def refresh_cameras_endpoint(db: Session = Depends(get_db)):
    """Manually trigger camera refresh from MD CHART (or mock)."""
    count = refresh_cameras(db)
    return {"status": "ok", "upserted": count}


@router.get("/cameras/{camera_id}", response_model=dict)
async def get_camera(
    camera_id: str,
    db: Session = Depends(get_db),
):
    """Get single camera by ID."""
    cam = db.query(TrafficCamera).filter(TrafficCamera.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Latest detection
    det = (
        db.query(CameraDetection)
        .filter(CameraDetection.camera_id == camera_id)
        .order_by(desc(CameraDetection.ts))
        .first()
    )

    row = db.query(
        func.ST_X(TrafficCamera.geom).label("lon"),
        func.ST_Y(TrafficCamera.geom).label("lat"),
    ).filter(TrafficCamera.camera_id == camera_id).first()
    lon = float(row.lon or 0) if row else 0
    lat = float(row.lat or 0) if row else 0

    item = _cam_to_item(
        cam, lon, lat,
        vehicle_count=det.vehicle_count if det else None,
        congestion_score=det.congestion_score if det else None,
    )
    return item
