"""SQLAlchemy models for GeoTrack."""
from app.db.base import Base
from app.models.traffic_camera import TrafficCamera
from app.models.camera_detection import CameraDetection
from app.models.aircraft import AircraftLatest

__all__ = ["Base", "TrafficCamera", "CameraDetection", "AircraftLatest"]
