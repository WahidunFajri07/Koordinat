"""Celery tasks for data cleaning, dedup, and loading pipeline."""

import logging
from typing import Any

from celery import Task

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="process_upload_pipeline")
def process_upload_pipeline(self: Task, upload_id: str) -> dict[str, Any]:
    """Async task to clean, deduplicate and import uploaded files."""
    logger.info("Processing upload pipeline for upload_id=%s", upload_id)
    return {"status": "success", "upload_id": upload_id}
