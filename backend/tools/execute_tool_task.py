import json
import redis
import os
from celery import shared_task
from crewai.telemetry import Telemetry
from pydantic import ValidationError

from db_config import engine

# Connect to Redis for manual PubSub streaming (this allows Celery workers to push data back to FastAPI)
redis_client = redis.Redis.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"))

# Import your tools/crews (We will create a dummy crew or integrate one next)
# from flows.sample_flow import SampleFlow

@shared_task(name="tools.execute_tool_task.run_agent_tool", bind=True)
def run_agent_tool(self, tool_name: str, arguments: dict, execution_id: str):
    """
    Core execution logic triggered by Celery.
    This orchestrates the CrewAI kickoff and streams events back via Redis Pub/Sub.
    """
    stream_channel = f"stream:{execution_id}"
    
    def on_llm_stream_chunk(chunk: str):
        # Push raw chunks back to the Redis channel
        redis_client.rpush(stream_channel, json.dumps({"type": "chunk", "content": chunk}))
        # Optional: Expire the key eventually
        redis_client.expire(stream_channel, 3600)
        
    def on_agent_status_change(status: dict):
        # Push Agent Status (e.g., Drafting, Researching)
        redis_client.rpush(stream_channel, json.dumps({"type": "status", "data": status}))

    # Example dispatch logic (You will replace this with your actual Crew/Flow initializations)
    try:
        on_agent_status_change({"agent": "System", "state": "Initializing CrewAI Workflows..."})
        
        # NOTE: Telemetry and EventBus configuration for streaming will be set here.
        # Since CrewAI 0.98.0 event buses are configured at the Crew() level with `step_callback`
        # or `task_callback`.
        
        if tool_name == "SampleResearchTool":
            # Simulate a kickoff
            import time
            on_agent_status_change({"agent": "Researcher", "state": "Researching topic..."})
            for i in range(5):
                on_llm_stream_chunk(f"Found artifact {i}... ")
                time.sleep(1)
            on_agent_status_change({"agent": "Writer", "state": "Drafting final content..."})
            for i in range(5):
                on_llm_stream_chunk(f"Drafting paragraph {i}... ")
                time.sleep(1)
                
            final_output = "Task successfully completed by AI agents."
            
        else:
            final_output = f"Unknown tool requested: {tool_name}"
        
        # Signal completion
        redis_client.rpush(stream_channel, "__DONE__")
        return {"status": "success", "result": final_output}

    except ValidationError as e:
        # Pydantic schema hallucinaton caught here. In a real Flow, it self-corrects.
        error_msg = f"Schema Validation Error: {str(e)}"
        redis_client.rpush(stream_channel, f"__ERROR__{error_msg}")
        raise e
    except Exception as e:
        error_msg = str(e)
        redis_client.rpush(stream_channel, f"__ERROR__{error_msg}")
        raise e
