import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Explicitly configure Celery with REDIS
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

celery_app = Celery(
    "plot_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=['tools.execute_tool_task'] # We will define our tasks here
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Worker Resilience Limits
    task_time_limit=300, # 5 minutes hard limit to kill hang runs
    task_soft_time_limit=270, # Soft limit to allow gracefully catching the exception
    worker_concurrency=4, # Depends on deployment scale
)
