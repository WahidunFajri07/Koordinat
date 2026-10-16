"""Celery application instance and configuration."""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "rekonsiliasi_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.pipeline_tasks",
        "app.tasks.matching_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Jakarta",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour limit
    worker_prefetch_multiplier=1,
)
