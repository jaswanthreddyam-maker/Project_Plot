import asyncio
import json
import logging
import os
import shutil
import time
import uuid
from typing import Any, Dict, Optional

import redis
import redis.asyncio as redis_async
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sse_starlette.sse import EventSourceResponse

from backend import auth
from backend.auth import get_current_user
from backend.db_config import SessionLocal
from backend.routers import (
    automations,
    billing,
    config,
    execute,
    integrations,
    projects,
    templates,
    traces,
    vault,
    workspace,
)
from backend.routers.settings import settings_router

# Import Celery App
from backend.worker import celery_app

app = FastAPI(title="Plot Autonomous AI Orchestrator")

# Redis clients for queueing and health checks.
redis_client = redis.Redis.from_url(
    os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
)
async_redis_client = redis_async.from_url(
    os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
)


def _frontend_origins() -> list[str]:
    raw_value = os.environ.get("FRONTEND_URL") or os.environ.get("NEXT_PUBLIC_FRONTEND_URL")

    if raw_value:
        candidates = [value.strip().rstrip("/") for value in raw_value.split(",") if value.strip()]
    else:
        # Local dev safe defaults for hostname/port variations.
        candidates = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ]

    origins = [origin for origin in candidates if origin and origin != "*"]
    return sorted(set(origins)) or ["http://localhost:3000"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    services = {"redis": "down", "db": "down"}

    try:
        redis_client.ping()
        services["redis"] = "up"
    except Exception:
        pass

    db = None
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        services["db"] = "up"
    except Exception:
        pass
    finally:
        if db is not None:
            db.close()

    overall_status = "ok" if all(v == "up" for v in services.values()) else "degraded"
    return {"status": overall_status, "services": services}

app.include_router(settings_router)
app.include_router(auth.router)
app.include_router(traces.router)
app.include_router(integrations.router)
app.include_router(automations.router)
app.include_router(vault.router)
app.include_router(config.router)
app.include_router(workspace.router)
app.include_router(projects.router)
app.include_router(templates.router)
app.include_router(billing.router)
app.include_router(execute.router)

logger = logging.getLogger("api_logger")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(ch)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    logger.info(f"Completed response: {response.status_code} in {process_time:.2f}ms")
    return response

# Custom Middleware to disable Proxy Buffering for SSE
@app.middleware("http")
async def add_sse_headers(request: Request, call_next):
    response = await call_next(request)
    if "stream" in request.url.path:
        response.headers["Cache-Control"] = "no-cache"
        response.headers["X-Accel-Buffering"] = "no" # For Nginx
        response.headers["Connection"] = "keep-alive"
    return response

# --- Models ---
class ToolExecutionRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    execution_id: Optional[str] = None # Will be generated if not provided

KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), "knowledge")
os.makedirs(KNOWLEDGE_DIR, exist_ok=True)

@app.post("/api/knowledge/upload")
async def upload_knowledge(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    """
    Accepts PDF/TXT file uploads or URLs and saves them to the local ./knowledge directory for RAG.
    """
    if file:
        file_path = os.path.join(KNOWLEDGE_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"status": "success", "type": "file", "path": file_path, "name": file.filename}

    if url:
        return {"status": "success", "type": "url", "path": url, "name": url}

    raise HTTPException(status_code=400, detail="Must provide either a file or a url")

@app.post("/api/tools/execute", status_code=202)
async def execute_tool(req: ToolExecutionRequest, current_user: str = Depends(get_current_user)):
    """
    Kicks off a background CrewAI execution via Celery.
    Returns 202 Accepted and a task_id immediately.
    """
    broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

    # Fail fast with a concrete message when Redis/Broker is down.
    try:
        redis_client.ping()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Celery broker is offline ({broker_url}). "
                "Start Redis first, then restart the Celery worker."
            ),
        ) from exc

    # Avoid "Initializing..." stalls when the queue has no active consumers.
    try:
        workers = celery_app.control.inspect(timeout=3).ping() or {}
    except Exception:
        workers = {}
    if not workers:
        raise HTTPException(
            status_code=503,
            detail=(
                "No Celery worker is online. "
                "Start the worker process after Redis is running and retry."
            ),
        )

    execution_id = req.execution_id or str(uuid.uuid4())

    # Send the task to the Celery queue (passing user_id)
    try:
        task = celery_app.send_task(
            "tools.execute_tool_task.run_agent_tool",
            args=[req.tool_name, req.arguments, execution_id, current_user],
            task_id=execution_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Failed to enqueue task via broker ({broker_url}). "
                "Verify Redis and Celery worker connectivity, then retry."
            ),
        ) from exc

    return {"message": "Execution started", "task_id": task.id, "execution_id": execution_id}

@app.post("/api/tools/schedule", status_code=201)
async def schedule_flow_endpoint(req: Request, current_user: str = Depends(get_current_user)):
    """
    Saves the cron configuration to the database for Celery Beat polling.
    """
    payload = await req.json()
    interval = payload.get("interval", "Every Hour")
    arguments = payload.get("arguments", {})

    import json
    import uuid

    from backend.db_config import ScheduledFlow, SessionLocal
    db = SessionLocal()
    try:
        new_sch = ScheduledFlow(
            id=str(uuid.uuid4()),
            user_id=current_user,
            cron_schedule=interval,
            payload=json.dumps(arguments)
        )
        db.add(new_sch)
        db.commit()
    finally:
        db.close()

    return {"status": "success", "message": f"Successfully scheduled flow for '{interval}'"}

@app.get("/api/traces/stream/{execution_id}")
async def stream_traces(request: Request, execution_id: str):
    """
    SSE Endpoint for real-time Agent Traces.
    This reads from the Redis list `stream:{execution_id}`.
    """
    stream_channel = f"stream:{execution_id}"

    async def event_generator():
        keep_alive_count = 0
        try:
            while True:
                if await request.is_disconnected():
                    break

                # Use a shorter timeout or non-blocking check
                result = await async_redis_client.blpop(stream_channel, timeout=1)

                if result:
                    keep_alive_count = 0
                    _, event_bytes = result
                    event_data = event_bytes.decode('utf-8')

                    if event_data.startswith("__DONE__"):
                        result_content = event_data[8:]  # Everything after "__DONE__"
                        yield {"data": json.dumps({"type": "completed", "content": "Execution finished", "result": result_content})}
                        break
                    if event_data.startswith("__ERROR__"):
                        yield {"data": json.dumps({"type": "error", "content": event_data[9:]})}
                        break

                    yield {"data": event_data}
                else:
                    keep_alive_count += 1
                    if keep_alive_count >= 30:
                        yield {"data": json.dumps({"type": "status", "content": "waiting_for_user"})}
                        keep_alive_count = 0
                    # Small sleep to prevent tight loop if blpop returns quickly
                    await asyncio.sleep(0.01)

        except asyncio.CancelledError:
            # Handle task cancellation (e.g. server shutdown or client disconnect during yield)
            pass
        finally:
            await async_redis_client.expire(stream_channel, 60)

    return EventSourceResponse(event_generator())


@app.get("/stream/{task_id}")
async def stream_execution(request: Request, task_id: str):
    """
    SSE Endpoint for real-time Agent tracking.
    This reads from the Redis list `stream:{task_id}` populated by the Celery worker.
    """
    stream_channel = f"stream:{task_id}"

    async def event_generator():
        try:
            while True:
                # If client disconnects, break
                if await request.is_disconnected():
                    break

                # Fetch next event from Redis using asyncio client
                result = await async_redis_client.blpop(stream_channel, timeout=1)

                if result:
                    _, event_bytes = result
                    event_data = event_bytes.decode('utf-8')

                    # Check for termination signal
                    if event_data == "__DONE__":
                        yield {"data": '{"status": "completed", "message": "Execution finished"}'}
                        break
                    if event_data.startswith("__ERROR__"):
                        yield {"data": f'{{"status": "error", "message": "{event_data[9:]}"}}'}
                        break

                    yield {"data": event_data}
                else:
                    # Timeout reached, just continue to check for disconnects
                    await asyncio.sleep(0.1)

        finally:
            # Graceful Cleanup:
            # Apply a 60-second TTL to the Redis list if client disconnects or finishes.
            # This prevents orphaned Celery worker outputs from permanently leaking memory.
            await async_redis_client.expire(stream_channel, 60)

    return EventSourceResponse(event_generator())


class ResumeRequest(BaseModel):
    task_id: str
    feedback: str

@app.post("/api/resume")
async def resume_execution(req: ResumeRequest, current_user: str = Depends(get_current_user)):
    """
    Webhook for Asynchronous HITL execution resuming
    """
    # Push feedback to a dedicated Redis queue for this task
    await async_redis_client.rpush(f"feedback:{req.task_id}", req.feedback)
    # Expire in case the flow already died
    await async_redis_client.expire(f"feedback:{req.task_id}", 3600)

    return {"status": "ok", "message": "Feedback submitted to flow"}
@app.get("/api/analytics/usage")
async def get_usage_analytics(current_user: str = Depends(get_current_user)):
    """
    Returns aggregated LLM usage data, cost tracking, and summary stats for the dashboard.
    """
    from datetime import datetime, timedelta

    from sqlalchemy import func

    from backend.db_config import AgentTrace, LLMConnection, SessionLocal, UsageLog

    db = SessionLocal()
    try:
        # 1. Summary Stats
        total_cost = db.query(func.sum(UsageLog.total_cost)).filter(UsageLog.user_id == current_user).scalar() or 0
        total_agents = db.query(func.count(LLMConnection.id)).filter(LLMConnection.user_id == current_user).scalar() or 0

        # 2. Success vs Failed
        success_count = db.query(func.count(UsageLog.id)).filter(
            UsageLog.status == "success",
            UsageLog.user_id == current_user
        ).scalar() or 0
        failed_count = db.query(func.count(UsageLog.id)).filter(
            UsageLog.status == "failed",
            UsageLog.user_id == current_user
        ).scalar() or 0
        total_runs = success_count + failed_count
        success_rate = (success_count / total_runs * 100) if total_runs > 0 else 0

        # 3. Daily Token Spend (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        daily_stats = db.query(
            func.date(UsageLog.timestamp).label('day'),
            func.sum(UsageLog.prompt_tokens).label('prompt'),
            func.sum(UsageLog.completion_tokens).label('completion')
        ).filter(UsageLog.timestamp >= seven_days_ago, UsageLog.user_id == current_user)\
         .group_by(func.date(UsageLog.timestamp))\
         .order_by(func.date(UsageLog.timestamp)).all()

        token_chart = []
        for d in daily_stats:
            token_chart.append({
                "date": d.day,
                "tokens": int(float(d.prompt or 0)) + int(float(d.completion or 0))
            })

        # 4. Task Throughput (placeholder or actual trace count)
        task_throughput = db.query(
            func.date(AgentTrace.timestamp).label('day'),
            func.count(AgentTrace.id).label('count')
        ).filter(AgentTrace.timestamp >= seven_days_ago, AgentTrace.user_id == current_user)\
         .group_by(func.date(AgentTrace.timestamp))\
         .order_by(func.date(AgentTrace.timestamp)).all()

        task_chart = [{"date": t.day, "tasks": t.count} for t in task_throughput]

        return {
            "summary": {
                "total_cost": round(float(total_cost), 4),
                "total_agents": total_agents,
                "total_tools": 8, # Placeholder for tools catalog size
                "success_rate": round(success_rate, 1),
                "total_runs": total_runs
            },
            "token_chart": token_chart,
            "task_chart": task_chart
        }
    finally:
        db.close()

class ApprovalResponse(BaseModel):
    execution_id: str

@app.post("/api/approval/confirm")
async def confirm_approval(req: ApprovalResponse, current_user: str = Depends(get_current_user)):
    """Resumes the sensitive tool execution by pushing an 'approved' signal to Redis."""
    from backend.db_config import AgentApproval, SessionLocal
    db = SessionLocal()
    try:
        approval = db.query(AgentApproval).filter(
            AgentApproval.execution_id == req.execution_id,
            AgentApproval.status == "pending"
        ).order_by(AgentApproval.timestamp.desc()).first()

        if approval:
            approval.status = "approved"
            db.commit()

            # Resume signal
            await async_redis_client.rpush(f"approval_response:{req.execution_id}", "approved")
            return {"status": "ok", "message": "Execution approved and resumed"}
    finally:
        db.close()

    raise HTTPException(status_code=404, detail="Pending approval not found")

@app.post("/api/approval/deny")
async def deny_approval(req: ApprovalResponse, current_user: str = Depends(get_current_user)):
    """Stops the sensitive tool execution by pushing a 'denied' signal to Redis."""
    from backend.db_config import AgentApproval, SessionLocal
    db = SessionLocal()
    try:
        approval = db.query(AgentApproval).filter(
            AgentApproval.execution_id == req.execution_id,
            AgentApproval.status == "pending"
        ).order_by(AgentApproval.timestamp.desc()).first()

        if approval:
            approval.status = "denied"
            db.commit()

            # Deny signal
            await async_redis_client.rpush(f"approval_response:{req.execution_id}", "denied")
            return {"status": "ok", "message": "Execution denied and halted"}
    finally:
        db.close()

    raise HTTPException(status_code=404, detail="Pending approval not found")
