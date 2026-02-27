import json
import redis
import os
from crewai.events import BaseEventListener, crewai_event_bus
from crewai.events.events import LLMStreamChunkEvent, TaskCompletedEvent, FlowFinishedEvent

class PlotEventListener(BaseEventListener):
    """
    Listens to internal CrewAI events and streams them via Redis Pub/Sub to the FastAPI SSE endpoint.
    """
    def __init__(self, execution_id: str):
        self.stream_channel = f"stream:{execution_id}"
        self.redis_client = redis.Redis.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"))
        super().__init__()

    @crewai_event_bus.on(LLMStreamChunkEvent)
    def handle_llm_chunk(self, event: LLMStreamChunkEvent):
        payload = {"event": "chunk", "data": event.chunk}
        self.redis_client.rpush(self.stream_channel, json.dumps(payload))

    @crewai_event_bus.on(TaskCompletedEvent)
    def handle_task_completed(self, event: TaskCompletedEvent):
        payload = {"event": "status", "data": f"Task completed: {event.task.description[:50]}..."}
        self.redis_client.rpush(self.stream_channel, json.dumps(payload))
        
    @crewai_event_bus.on(FlowFinishedEvent)
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
