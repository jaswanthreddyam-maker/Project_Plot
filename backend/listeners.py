import json
import os

import redis

try:
    # CrewAI >=1.x exposes event types directly from `crewai.events`.
    from crewai.events import (
        BaseEventListener,
        FlowFinishedEvent,
        LLMStreamChunkEvent,
        TaskCompletedEvent,
        crewai_event_bus,
    )
except ImportError:
    # Backward compatibility with older CrewAI builds.
    from crewai.events import BaseEventListener, crewai_event_bus
    from crewai.events.events import FlowFinishedEvent, LLMStreamChunkEvent, TaskCompletedEvent

class PlotEventListener(BaseEventListener):
    """
    Listens to internal CrewAI events and streams them via Redis Pub/Sub to the FastAPI SSE endpoint.
    """
    def __init__(self, execution_id: str, user_id: str):
        self.user_id = user_id
        self.stream_channel = f"stream:{execution_id}"
        self.redis_client = redis.Redis.from_url(
            os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
        )
        super().__init__()

    def setup_listeners(self, crewai_event_bus):
        @crewai_event_bus.on(LLMStreamChunkEvent)
        def _on_llm_chunk(source, event):
            self.handle_llm_chunk(event)

        @crewai_event_bus.on(TaskCompletedEvent)
        def _on_task_completed(source, event):
            self.handle_task_completed(event)

        @crewai_event_bus.on(FlowFinishedEvent)
        def _on_flow_finished(source, event):
            self.handle_flow_finished(event)

    def handle_llm_chunk(self, event: LLMStreamChunkEvent):
        chunk = getattr(event, "chunk", "")
        payload = {"event": "chunk", "data": chunk}
        self.redis_client.rpush(self.stream_channel, json.dumps(payload))

    def handle_task_completed(self, event: TaskCompletedEvent):
        task = getattr(event, "task", None)
        description = getattr(task, "description", "Task completed")
        payload = {"event": "status", "data": f"Task completed: {description[:50]}..."}
        self.redis_client.rpush(self.stream_channel, json.dumps(payload))
        
    def handle_flow_finished(self, event: FlowFinishedEvent):
        # We can trap the flow finishing here as well
        payload = {"event": "status", "data": "Flow execution finished!"}
        self.redis_client.rpush(self.stream_channel, json.dumps(payload))

    def close(self):
        """Securely close the Redis connection."""
        try:
            self.redis_client.close()
        except:
            pass
