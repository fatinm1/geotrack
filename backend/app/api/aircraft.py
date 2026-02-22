"""
Aircraft API - REST fallback for latest positions.
"""
from fastapi import APIRouter

from app.services.aircraft_service import get_latest_aircraft

router = APIRouter()


@router.get("/aircraft/latest")
async def list_aircraft_latest():
    """Fallback REST list of latest aircraft (from Redis cache)."""
    items = get_latest_aircraft()
    return {"items": items}
