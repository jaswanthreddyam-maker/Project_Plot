from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
import asyncio
from typing import Dict, Any, Optional
import uuid

# Import Celery App
from worker import celery_app

app = FastAPI(title="Plot Autonomous AI Orchestrator")

# Allow Next.js frontend to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

import os
import redis
import redis.asyncio as redis_async

# Redis Client for Pub/Sub
redis_client = redis.Redis.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"))
async_redis_client = redis_async.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"))

@app.post("/api/tools/execute", status_code=202)
async def execute_tool(req: ToolExecutionRequest):
    """
    Kicks off a background CrewAI execution via Celery.
    Returns 202 Accepted and a task_id immediately.
    """
    execution_id = req.execution_id or str(uuid.uuid4())
    
    # Send the task to the Celery queue
    task = celery_app.send_task(
        "tools.execute_tool_task.run_agent_tool", 
        args=[req.tool_name, req.arguments, execution_id],
        task_id=execution_id
    )
    
    return {"message": "Execution started", "task_id": task.id, "execution_id": execution_id}


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


@app.post("/api/resume")
async def resume_execution(request: Request):
    """
    Webhook for Asynchronous HITL execution resuming
    """
    data = await request.json()
    # Logic to hydrate state and resume
    return {"status": "ok", "message": "Execution resumed"}
