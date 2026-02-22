"""Pydantic schemas for cameras."""
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CameraBase(BaseModel):
    name: str
    stream_url: str
    region: Optional[str] = None


class CameraOut(CameraBase):
    model_config = ConfigDict(from_attributes=True)
    camera_id: str
    lon: float
    lat: float
    stream_url: str
    snapshot_url: Optional[str] = None
    vehicle_count: Optional[int] = None
    congestion_score: Optional[float] = None  # 0..1, from latest detection


class CameraListItem(BaseModel):
    camera_id: str
    name: str
    lon: float
    lat: float
    stream_url: str
    region: Optional[str] = None
    vehicle_count: Optional[int] = None
    congestion_score: Optional[float] = None
