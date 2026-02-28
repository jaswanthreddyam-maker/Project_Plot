from pydantic import BaseModel
from crewai.flow.flow import Flow, start, listen
from crewai.flow.persistence.decorators import persist
from crewai import Agent, Task, Crew, Process, LLM

import json
import redis
import os

from db_config import get_db_session, AgentTrace

redis_client = redis.Redis.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"))

class PlotState(BaseModel):
    user_input: str = ""
    status: str = ""
    final_output: str = ""
    knowledge_sources: list = []
    execution_id: str = ""
    agents_config: list = []
    tasks_config: list = []

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
            
        crew_agents = []
        for ac in self.state.agents_config:
            provider_str = ac.get("provider", "openai").lower()
            model_name = "gpt-4o-mini"
            if provider_str == "gemini":
                model_name = "gemini/gemini-1.5-pro-latest"
            elif provider_str == "claude":
                model_name = "anthropic/claude-3-5-sonnet-20241022"
            elif provider_str == "ollama":
                model_name = "ollama/llama3"
            elif provider_str == "grok":
                model_name = "xai/grok-beta"
                
            llm = LLM(model=model_name)
            
            agent = Agent(
                role=ac.get("role", "Assistant"),
                goal=ac.get("goal", "Help the user"),
                backstory=ac.get("backstory", "A helpful AI assistant."),
                llm=llm,
                knowledge_sources=self.state.knowledge_sources if self.state.knowledge_sources else None,
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
                        execution_id=self.state.execution_id,
                        agent_role="Crew Agent", # Note: We could parse the role from context if passed 
                        task_description="Agent execution step",
                        status="Running",
                        logs=log_str
                    )
                    db.add(new_trace)
                    db.commit()
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
        
        # This blocks until CrewAI finishes its steps. Redis listeners trap the updates!
        crew_result = crew.kickoff()
        
        return str(crew_result.raw)

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
