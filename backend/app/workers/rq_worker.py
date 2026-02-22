"""
RQ worker - runs detection jobs from Redis queue.
"""
import logging
import os
import sys

# Ensure app is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from redis import Redis
from rq import Worker, Queue

from app.core.config import settings
from app.workers.jobs import run_detection_batch, run_detection_for_camera

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    redis_conn = Redis.from_url(settings.redis_url)
    q = Queue("geotrack", connection=redis_conn)
    worker = Worker([q], connection=redis_conn, exception_handlers=[])
    logger.info("Starting RQ worker for queue geotrack")
    worker.work()


if __name__ == "__main__":
    main()
