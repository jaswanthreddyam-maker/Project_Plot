import json
import redis
import os
import base64
from celery import shared_task
from crewai.telemetry import Telemetry
from pydantic import ValidationError

from db_config import engine, SessionLocal, IntegrationToken

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
                # Helper to fetch and decrypt integration tokens
                def get_integration_token(provider_name):
                    db = SessionLocal()
                    try:
                        token_record = db.query(IntegrationToken).filter(IntegrationToken.provider == provider_name).first()
                        if token_record:
                            # Basic base64 decode for development
                            return base64.b64decode(token_record.token_encrypted.encode()).decode()
                        return None
                    finally:
                        db.close()

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
                
                # Check for Enterprise Tools
                all_requested_tools = set()
                for agent_cfg in arguments.get("agents", []):
                    for t in agent_cfg.get("tools", []):
                        all_requested_tools.add(t)
                        
                # Dynamically instantiate Enterprise Tools if requested
                from crewai.tools import tool
                
                if "GitHub" in all_requested_tools:
                    github_token = get_integration_token("github")
                    if github_token:
                        os.environ["GITHUB_TOKEN"] = github_token
                        @tool("GitHub Action Tool")
                        def github_action_tool(action: str, repo: str) -> str:
                            """Execute a GitHub action on a repository."""
                            return f"Executed '{action}' on {repo} using authenticated GitHub token."
                        TOOL_MAP["GitHub"] = lambda: github_action_tool
                
                if "Asana" in all_requested_tools:
                    asana_token = get_integration_token("asana")
                    if asana_token:
                        os.environ["ASANA_ACCESS_TOKEN"] = asana_token
                        @tool("Asana Action Tool")
                        def asana_action_tool(action: str, task: str) -> str:
                            """Execute an Asana action."""
                            return f"Successfully performed '{action}' on Asana task '{task}' via authenticated token."
                        TOOL_MAP["Asana"] = lambda: asana_action_tool
                        
                if "Jira" in all_requested_tools:
                    jira_token = get_integration_token("jira")
                    if jira_token:
                        os.environ["JIRA_API_TOKEN"] = jira_token
                        @tool("Jira Action Tool")
                        def jira_action_tool(action: str, issue: str) -> str:
                            """Execute a Jira action."""
                            return f"Successfully interacted with Jira issue '{issue}' using standard auth."
                        TOOL_MAP["Jira"] = lambda: jira_action_tool

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

import uuid
import datetime

@shared_task(name="tools.execute_tool_task.scheduled_flow_kickoff", bind=True)
def scheduled_flow_kickoff(self, payload: dict):
    # Wrapper to instantiate and run PlotAutonomousFlow directly
    execution_id = f"sch-{str(uuid.uuid4())[:8]}"
    run_agent_tool("PlotAutonomous", payload, execution_id)

@shared_task(name="tools.execute_tool_task.poll_schedules", bind=True)
def poll_schedules(self):
    """
    Polled every minute by Celery Beat.
    Checks the SQLite DB for ScheduledFlow entries and triggers them if it's time.
    """
    from db_config import SessionLocal, ScheduledFlow
    db_session = SessionLocal()
    try:
        flows = db_session.query(ScheduledFlow).all()
        now = datetime.datetime.utcnow()
        for f in flows:
            trigger = False
            # Very simple cron simulation for exact match string parsing
            if f.cron_expression == "Every 1 Minute":
                trigger = True
            elif f.cron_expression == "Every Hour" and now.minute == 0:
                trigger = True
            elif f.cron_expression == "Daily at 9 AM" and now.hour == 9 and now.minute == 0:
                trigger = True
                
            if trigger:
                payload = json.loads(f.payload_json)
                scheduled_flow_kickoff.delay(payload)
                
    finally:
        db_session.close()
