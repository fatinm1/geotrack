"""
Camera detection model - vision analytics results.
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Float, String
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class CameraDetection(Base):
    __tablename__ = "camera_detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(String(64), ForeignKey("traffic_cameras.camera_id", ondelete="CASCADE"), nullable=False)
    ts = Column(DateTime, nullable=False)
    vehicle_count = Column(Integer, nullable=False, default=0)
    congestion_score = Column(Float, nullable=False, default=0.0)  # 0..1
    meta = Column(JSONB, nullable=True)
