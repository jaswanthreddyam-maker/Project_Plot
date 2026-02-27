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

    try:
        on_agent_status_change({"agent": "System", "state": "Initializing CrewAI Workflows..."})
        
        if tool_name == "PlotAutonomous":
            from autonomous_flow import PlotAutonomousFlow
            from listeners import PlotEventListener
            
            # Setup Event Listener
            listener = PlotEventListener(execution_id=execution_id)
            
            # Extract inputs
            objective = arguments.get("objective", "Unknown objective")
            knowledge_payload = arguments.get("knowledge_sources", [])
            
            knowledge_sources = []
            
            try:
                # Dynamically instantiate Knowledge Sources
                if knowledge_payload:
                    from crewai.knowledge.source.pdf_knowledge_source import PDFKnowledgeSource
                    from crewai.knowledge.source.text_file_knowledge_source import TextFileKnowledgeSource
                    from crewai.knowledge.source.crew_docling_source import CrewDoclingSource
                    
                    for ks in knowledge_payload:
                        if ks.get("type") == "pdf":
                            knowledge_sources.append(PDFKnowledgeSource(file_paths=[ks.get("path")]))
                        elif ks.get("type") == "txt":
                            knowledge_sources.append(TextFileKnowledgeSource(file_paths=[ks.get("path")]))
                        elif ks.get("type") == "url":
                            knowledge_sources.append(CrewDoclingSource(file_paths=[ks.get("path")]))

                # Initialize Flow state
                flow = PlotAutonomousFlow()
                flow.state.user_input = objective
                flow.state.execution_id = execution_id
                
                # Dynamically set frontend configuration for Crew creation
                flow.state.agents_config = arguments.get("agents", [])
                flow.state.tasks_config = arguments.get("tasks", [])
                
                # In a real CrewAI setup, you inject these sources into the Agents or the Crew itself.
                # For this scaffolding, we pass it into the Flow state.
                flow.state.knowledge_sources = knowledge_sources
                
                # Run the Flow
                final_output = flow.kickoff()
                
                on_agent_status_change({"agent": "System", "state": "Flow Execution Finished"})
            finally:
                # Ensure the Redis connection used by the listener is securely closed
                listener.close()
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
