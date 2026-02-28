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

                # ── Dynamic API Key Injection ─────────────────────────
                # Fetch API keys from LLMConnections table for each agent's provider
                import base64
                from db_config import SessionLocal, LLMConnection

                db_session = SessionLocal()
                try:
                    PROVIDER_ENV_MAP = {
                        "openai": "OPENAI_API_KEY",
                        "anthropic": "ANTHROPIC_API_KEY",
                        "gemini": "GEMINI_API_KEY",
                        "google": "GEMINI_API_KEY",
                        "groq": "GROQ_API_KEY",
                        "ollama": "OLLAMA_HOST",
                    }
                    agents_list = arguments.get("agents", [])
                    injected_providers = set()
                    for agent_cfg in agents_list:
                        provider_name = agent_cfg.get("provider", "").lower().strip()
                        if provider_name and provider_name not in injected_providers:
                            conn = db_session.query(LLMConnection).filter_by(
                                provider=provider_name
                            ).order_by(LLMConnection.created_at.desc()).first()
                            if conn:
                                decoded_key = base64.b64decode(conn.api_key_encrypted).decode("utf-8")
                                env_var = PROVIDER_ENV_MAP.get(provider_name, f"{provider_name.upper()}_API_KEY")
                                os.environ[env_var] = decoded_key
                                injected_providers.add(provider_name)
                finally:
                    db_session.close()
                
                # ── Dynamic Tool Injection ────────────────────────────
                # Read each agent's tools list and instantiate CrewAI tool objects
                try:
                    from crewai_tools import SerperDevTool, ScrapeWebsiteTool
                except ImportError:
                    SerperDevTool = None
                    ScrapeWebsiteTool = None

                TOOL_MAP = {}
                if SerperDevTool:
                    TOOL_MAP["Web Search"] = SerperDevTool
                if ScrapeWebsiteTool:
                    TOOL_MAP["Web Scraper"] = ScrapeWebsiteTool

                agent_tools_map = {}  # agent_id -> [tool_instance, ...]
                for agent_cfg in arguments.get("agents", []):
                    agent_id = agent_cfg.get("id", "")
                    requested_tools = agent_cfg.get("tools", [])
                    tool_instances = []
                    for tool_name in requested_tools:
                        tool_cls = TOOL_MAP.get(tool_name)
                        if tool_cls:
                            tool_instances.append(tool_cls())
                    if tool_instances:
                        agent_tools_map[agent_id] = tool_instances

                # Pass tool map into Flow state for Crew creation
                flow.state.agent_tools_map = agent_tools_map

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
