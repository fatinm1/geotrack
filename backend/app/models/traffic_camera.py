"""
Traffic camera model - MD CHART cameras with PostGIS geometry.
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry

from app.db.base import Base


class TrafficCamera(Base):
    __tablename__ = "traffic_cameras"

    camera_id = Column(String(64), primary_key=True)
    name = Column(String(256), nullable=False)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    stream_url = Column(Text, nullable=False)
    snapshot_url = Column(Text, nullable=True)
    region = Column(String(128), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
