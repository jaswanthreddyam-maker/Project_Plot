from pydantic import BaseModel
import datetime
from crewai.flow.flow import Flow, start, listen
from crewai.flow.persistence.decorators import persist
from crewai import Agent, Task, Crew, Process, LLM

import json
import redis
import os

from backend.db_config import get_db_session, AgentTrace, SessionLocal, AgentApproval, VaultKey, GlobalConfig
import chromadb
from chromadb.config import Settings
from cryptography.fernet import Fernet


redis_client = redis.Redis.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"))
SENSITIVE_TOOLS = ["Delete", "Shell", "FileWrite", "GitHub", "Asana", "Jira", "GitHub Action Tool"]

class HITLToolWrapper:
    """Wraps a CrewAI tool to intercept execution if it's in the sensitive list."""
    def __init__(self, tool, execution_id, user_id):
        self.tool = tool
        self.execution_id = execution_id
        self.user_id = user_id
        self.name = getattr(tool, 'name', 'Unknown Tool')
        self.description = getattr(tool, 'description', '')
        self.args_schema = getattr(tool, 'args_schema', None)

    def _run(self, *args, **kwargs):
        if self.name in SENSITIVE_TOOLS:
            print(f"[HITL] Intercepting sensitive tool: {self.name}")
            
            # 1. Create DB record for approval
            import uuid, json
            db = SessionLocal()
            approval_id = str(uuid.uuid4())
            try:
                new_approval = AgentApproval(
                    id=approval_id,
                    user_id=self.user_id,
                    execution_id=self.execution_id,
                    tool_name=self.name,
                    arguments=json.dumps({"args": args, "kwargs": kwargs}),
                    reasoning=f"Agent requested sensitive action: {self.name}",
                    status="pending"
                )
                db.add(new_approval)
                db.commit()
            finally:
                db.close()

            # 2. Push SSE notification
            payload = {
                "type": "approval_required",
                "execution_id": self.execution_id,
                "tool_name": self.name,
                "arguments": kwargs,
                "timestamp": str(datetime.datetime.utcnow())
            }
            redis_client.rpush(f"stream:{self.execution_id}", json.dumps(payload))

            # 3. Block for response
            print(f"[HITL] Blocking for approval: approval_response:{self.execution_id}")
            result = redis_client.blpop(f"approval_response:{self.execution_id}", timeout=600) # 10 min timeout
            
            if result:
                _, response_bytes = result
                response = response_bytes.decode('utf-8')
                if response == "approved":
                    print(f"[HITL] Tool approved: {self.name}")
                    return self.tool._run(*args, **kwargs)
                else:
                    print(f"[HITL] Tool denied: {self.name}")
                    raise Exception("cancelled_by_user")
            else:
                raise Exception("cancelled_by_user")
        
        return self.tool._run(*args, **kwargs)

class PlotState(BaseModel):
    user_input: str = ""
    status: str = ""
    final_output: str = ""
    knowledge_sources: list = []
    execution_id: str = ""
    user_id: str = ""
    agents_config: list = []
    tasks_config: list = []
    agent_tools_map: dict = {} # Map of agent_id to tool list

@persist()
class PlotAutonomousFlow(Flow[PlotState]):
    
    @start()
    def initialize_workflow(self):
        self.state.status = "Initializing Plot Autonomous workflow..."
        print(f"[PlotAutonomousFlow] Start: received input: {self.state.user_input}")
        return "Workflow initialized"

    @listen(initialize_workflow)
    def assemble_and_run_crew(self, init_result):
        self.state.status = "Assembling dynamic crew..."
        
        if not self.state.agents_config or not self.state.tasks_config:
            self.state.status = "Error: Missing agents or tasks configuration."
            return "Execution failed due to missing configuration."
            
        # --- RAG / Key Setup ---
        db = SessionLocal()
        try:
            # Fetch global config for the user
            global_config = db.query(GlobalConfig).filter(GlobalConfig.user_id == self.state.user_id).first()
            if not global_config:
                global_config = GlobalConfig(
                    id=str(uuid.uuid4()), 
                    user_id=self.state.user_id,
                    default_model="gpt-4o", 
                    temperature=0.7, 
                    memory_enabled=True
                )
                
            # Fetch user-specific vault keys
            vault_keys = db.query(VaultKey).filter(VaultKey.user_id == self.state.user_id).all()
            
            master_key = os.environ.get("VAULT_MASTER_KEY")
            if not master_key:
                # Fallback purely for safety if backend restarted without keys
                master_key = Fernet.generate_key().decode()
                os.environ["VAULT_MASTER_KEY"] = master_key
            fernet = Fernet(master_key.encode())
            
            decrypted_keys = {}
            for vk in vault_keys:
                try:
                    decrypted = fernet.decrypt(vk.encrypted_value.encode()).decode()
                    decrypted_keys[vk.key_name] = decrypted
                    # CrewAI tools require SEARCH and DEV keys in os.environ
                    if vk.category in ["SEARCH", "DEV"]:
                        os.environ[vk.key_name] = decrypted
                except Exception as e:
                    print(f"[Vault] Failed to decrypt key {vk.key_name}: {e}")
                    
        finally:
            db.close()
            
        crew_agents = []
        for ac in self.state.agents_config:
            provider_str = ac.get("provider", "openai").lower()
            model_name = global_config.default_model
            api_key = decrypted_keys.get("OPENAI_API_KEY")

            if provider_str == "gemini":
                model_name = "gemini/gemini-1.5-pro-latest"
                api_key = decrypted_keys.get("GEMINI_API_KEY")
            elif provider_str == "claude":
                model_name = "anthropic/claude-3-5-sonnet-20241022"
                api_key = decrypted_keys.get("ANTHROPIC_API_KEY")
            elif provider_str == "ollama":
                model_name = "ollama/llama3"
                api_key = None # Local
            elif provider_str == "grok":
                model_name = "xai/grok-beta"
                api_key = decrypted_keys.get("XAI_API_KEY")
                
            # Explicitly pass api_key and temperature
            llm_kwargs = {
                "model": model_name,
                "temperature": global_config.temperature
            }
            if api_key:
                llm_kwargs["api_key"] = api_key
                
            llm = LLM(**llm_kwargs)
            
            # Fetch and wrap tools for this agent
            agent_id = ac.get("id", "")
            raw_tools = self.state.agent_tools_map.get(agent_id, [])
            wrapped_tools = [HITLToolWrapper(t, self.state.execution_id, self.state.user_id) for t in raw_tools]
            
            agent = Agent(
                role=ac.get("role", "Assistant"),
                goal=ac.get("goal", "Help the user"),
                backstory=ac.get("backstory", "A helpful AI assistant."),
                llm=llm,
                tools=wrapped_tools,
                knowledge_sources=self.state.knowledge_sources if (self.state.knowledge_sources and global_config.memory_enabled) else None,
                verbose=True,
                allow_delegation=False
            )

            crew_agents.append(agent)
            
        crew_tasks = []
        for tc in self.state.tasks_config:
            # We assign all agents or the first agent to the task by default
            task = Task(
                description=tc.get("description", "Perform task"),
                expected_output=tc.get("expected_output", "Task result"),
                agent=crew_agents[0] if crew_agents else None 
            )
            crew_tasks.append(task)
            
        def trace_step(step_output):
            """Callback fired after every agent step. We save this to SQLite."""
            try:
                # step_output could be a string or a tuple depending on the CrewAI version
                # Usually it's an object containing thought, tool, log, etc.
                
                # Safely serialize whatever output we receive.
                if hasattr(step_output, 'model_dump_json'):
                    log_str = step_output.model_dump_json()
                elif hasattr(step_output, '__dict__'):
                    # Strip out circular references if needed
                    safe_dict = {k: v for k, v in step_output.__dict__.items() if isinstance(v, (str, int, float, bool, list, dict))}
                    log_str = json.dumps(safe_dict)
                else:
                    log_str = str(step_output)

                with get_db_session() as db:
                    import uuid
                    new_trace = AgentTrace(
                        id=str(uuid.uuid4()),
                        user_id=self.state.user_id,
                        execution_id=self.state.execution_id,
                        agent_role="Crew Agent", 
                        task_description="Agent execution step",
                        status="Running",
                        logs=log_str
                    )
                    db.add(new_trace)
                    db.commit()
                
                # Push to Redis for Live Trace Streaming
                trace_payload = {
                    "type": "thought",
                    "content": log_str,
                    "timestamp": str(datetime.datetime.utcnow())
                }
                # Check for tool usage in log
                if "Action:" in log_str:
                    try:
                        action = log_str.split("Action:")[1].split("\n")[0].strip()
                        action_input = log_str.split("Action Input:")[1].split("\n")[0].strip() if "Action Input:" in log_str else ""
                        trace_payload = {
                            "type": "tool",
                            "name": action,
                            "input": action_input,
                            "timestamp": str(datetime.datetime.utcnow())
                        }
                    except:
                        pass
                
                redis_client.rpush(f"stream:{self.state.execution_id}", json.dumps(trace_payload))
            except Exception as e:
                print(f"[Telemetry Error] Failed to write trace: {e}")

        crew = Crew(
            agents=crew_agents,
            tasks=crew_tasks,
            process=Process.sequential,
            verbose=True,
            step_callback=trace_step,
            # Enabling Memory Systems (Short-term, Long-term, Entity)
            memory=True,
            embedder={
                "provider": "openai",
                "config": {
                    "model": "text-embedding-3-small"
                }
            },
            # Assigning the knowledge sources to the entire Crew context instead as fallback
            knowledge_sources=self.state.knowledge_sources if self.state.knowledge_sources else None
        )
        
        self.state.status = "Executing core workflow logic..."
        print(f"[PlotAutonomousFlow] Crew Kickoff Started")
        
        # --- RAG: Retrieve context from ChromaDB ---
        try:
            chroma_client = chromadb.PersistentClient(path="./chroma_db")
            collection = chroma_client.get_or_create_collection(name="crew_memory")
            
            # Query relevant context based on user input
            results = collection.query(
                query_texts=[self.state.user_input],
                n_results=3
            )
            context = "\n".join(results['documents'][0]) if results['documents'] else ""
            
            if context:
                print(f"[RAG] Retrieved context: {context[:100]}...")
                # Prepend context to the first task's description as requested
                if crew_tasks:
                    crew_tasks[0].description = f"Relevant Context:\n{context}\n\nTask Description:\n{crew_tasks[0].description}"
        except Exception as e:
            print(f"[RAG Error] {e}")

        try:
            # This blocks until CrewAI finishes its steps. Redis listeners trap the updates!
            crew_result = crew.kickoff()
            
            # Store final output in memory store
            try:
                collection.add(
                    documents=[str(crew_result.raw)],
                    ids=[f"result_{self.state.execution_id}"]
                )
            except Exception as e:
                print(f"[RAG Save Error] {e}")

            return str(crew_result.raw)
            
        except Exception as e:
            error_msg = str(e)
            if "cancelled_by_user" in error_msg:
                user_msg = "Execution cancelled by human operator."
                redis_client.rpush(f"stream:{self.state.execution_id}", f"__ERROR__{user_msg}")
                return json.dumps({"status": "cancelled_by_user"})
            
            error_msg = f"API Error or Network Failure: {error_msg}"
            redis_client.rpush(f"stream:{self.state.execution_id}", f"__ERROR__{error_msg}")
            print(f"[CrewAI Error] {error_msg}")
            return f"Error: {error_msg}"
            
        finally:
            # --- Usage Tracking (Try-Finally for granular tokens) ---
            try:
                # Capture usage data
                prompt_tokens = 0
                completion_tokens = 0
                status_val = "success" if self.state.status != "Cancelled" and "API Error" not in getattr(self, "state", self).status else "failed"

                if hasattr(crew, 'usage_metrics') and crew.usage_metrics:
                    prompt_tokens = getattr(crew.usage_metrics, 'prompt_tokens', 0)
                    completion_tokens = getattr(crew.usage_metrics, 'completion_tokens', 0)
                
                # Fetch model name used to calculate appropriate cost
                db = SessionLocal()
                try:
                    gc = db.query(GlobalConfig).first()
                    model_used = gc.default_model if gc else "gpt-4o"
                finally:
                    db.close()
                
                import utils.metrics as metrics
                with get_db_session() as ds:
                    metrics.log_usage(ds, self.state.execution_id, self.state.user_id, model_used, prompt_tokens, completion_tokens, status=status_val)
            except Exception as usage_err:
                print(f"[Usage Tracking Error] {usage_err}")

    @listen(assemble_and_run_crew)
    def request_human_feedback(self, draft_result):
        # Emit the intervention signal to the frontend
        stream_channel = f"stream:{self.state.execution_id}"
        prompt = "Review the initial draft. Do you have any feedback or should we proceed?"
        payload = {"type": "status", "data": {"state": "__INTERVENTION_REQUIRED__", "prompt": prompt}}
        redis_client.rpush(stream_channel, json.dumps(payload))
        self.state.status = "Waiting for human feedback..."
        
        # Block until feedback is received in the dedicated feedback queue
        feedback_channel = f"feedback:{self.state.execution_id}"
        print(f"[PlotAutonomousFlow] Blocking for feedback on channel: {feedback_channel}")
        
        # blpop returns a tuple (key, value)
        result = redis_client.blpop(feedback_channel, timeout=300) # Wait up to 5 minutes
        
        if result:
            _, feedback_bytes = result
            feedback = feedback_bytes.decode('utf-8')
            print(f"[PlotAutonomousFlow] Received feedback: {feedback}")
            return feedback
        else:
            print("[PlotAutonomousFlow] Timeout waiting for feedback")
            return "No feedback provided (Timeout)"

    @listen(request_human_feedback)
    def finalize_execution(self, feedback):
        self.state.status = "Finalizing based on feedback..."
        import time
        time.sleep(1)
        self.state.final_output = f"Successfully processed input: '{self.state.user_input}'. Feedback applied: '{feedback}'"
        self.state.status = "Workflow completed"
        return self.state.final_output
