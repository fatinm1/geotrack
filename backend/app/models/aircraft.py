"""
Aircraft latest position - ADS-B state vectors.
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float
from geoalchemy2 import Geometry

from app.db.base import Base


class AircraftLatest(Base):
    __tablename__ = "aircraft_latest"

    icao24 = Column(String(6), primary_key=True)
    callsign = Column(String(16), nullable=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    altitude = Column(Float, nullable=True)
    velocity = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    ts = Column(DateTime, nullable=False)
