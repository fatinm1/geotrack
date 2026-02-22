"""
Health check endpoint.
"""
from fastapi import APIRouter
from sqlalchemy import text

from app.db.base import engine

router = APIRouter()


@router.get("/health")
async def health():
    """Health check for load balancers and monitoring."""
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass
    return {"status": "ok", "database": "ok" if db_ok else "unavailable"}
