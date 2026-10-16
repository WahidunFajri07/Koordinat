"""Celery tasks for spatial matching between master and kosong records."""

import logging
from typing import Any

from celery import Task

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="process_spatial_matching")
def process_spatial_matching(self: Task, process_id: str) -> dict[str, Any]:
    """Async task to execute spatial matching for a match process."""
    logger.info("Processing spatial matching for process_id=%s", process_id)
    return {"status": "success", "process_id": process_id}
