from pydantic import BaseModel
from crewai.flow.flow import Flow, start, listen
from crewai.flow.persistence.decorators import persist

import json
import redis
import os

redis_client = redis.Redis.from_url(os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"))

class PlotState(BaseModel):
    user_input: str = ""
    status: str = ""
    final_output: str = ""
    knowledge_sources: list = []
    execution_id: str = ""

@persist()
class PlotAutonomousFlow(Flow[PlotState]):
    
    @start()
    def initialize_workflow(self):
        self.state.status = "Initializing Plot Autonomous workflow..."
        print(f"[PlotAutonomousFlow] Start: received input: {self.state.user_input}")
        return "Workflow initialized"

    @listen(initialize_workflow)
    def execute_core_logic(self, init_result):
        self.state.status = "Executing core workflow logic..."
        print(f"[PlotAutonomousFlow] Executing logic based on: {init_result}")
        import time
        time.sleep(2)
        return "Draft complete. Ready for review."

    @listen(execute_core_logic)
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
