"""
Detections API - trigger detection run (enqueue RQ job).
"""
import logging
from fastapi import APIRouter

from app.core.config import settings
from redis import Redis
from rq import Queue

from app.workers.jobs import run_detection_batch

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/detections/run")
async def trigger_detection_run():
    """Admin/dev: enqueue one detection run (all cameras with mock or real detector)."""
    try:
        redis_conn = Redis.from_url(settings.redis_url)
        q = Queue("geotrack", connection=redis_conn)
        job = q.enqueue(run_detection_batch, job_timeout="5m")
        return {"status": "enqueued", "job_id": job.id}
    except Exception as e:
        logger.warning("Failed to enqueue detection job: %s", e)
        return {"status": "error", "message": str(e)}
