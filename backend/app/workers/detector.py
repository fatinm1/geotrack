"""
Pluggable panoptic-style detector.
Default: mock detector (CPU-only, no model download).
Output: vehicle_count (int), congestion_score (0..1), timestamp.
"""
import logging
import random
from datetime import datetime
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def run_detection(
    image_url: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
) -> dict[str, Any]:
    """
    Run detection on a frame. Returns vehicle_count, congestion_score (0..1), meta.
    When USE_MOCK_DETECTOR=true, returns random mock results without processing image.
    """
    if settings.use_mock_detector:
        return _mock_detect()
    return _real_detect(image_url, image_bytes)


def _mock_detect() -> dict[str, Any]:
    """Mock detector - no image processing, returns random values."""
    vehicle_count = random.randint(0, 50)
    congestion_score = min(1.0, vehicle_count / 30.0 + random.uniform(-0.1, 0.1))
    congestion_score = max(0.0, min(1.0, congestion_score))
    return {
        "vehicle_count": vehicle_count,
        "congestion_score": round(congestion_score, 2),
        "timestamp": datetime.utcnow(),
        "meta": {"detector": "mock"},
    }


def _real_detect(image_url: Optional[str], image_bytes: Optional[bytes]) -> dict[str, Any]:
    """
    Placeholder for real model. Implement with YOLO/DeepLab etc.
    Do NOT download models automatically unless explicitly requested.
    """
    logger.warning("Real detector not implemented; falling back to mock")
    return _mock_detect()
