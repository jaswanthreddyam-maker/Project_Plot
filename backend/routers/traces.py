from fastapi import APIRouter
from sqlalchemy import desc
import datetime
import json
from db_config import get_db_session, AgentTrace

router = APIRouter(
    prefix="/api/traces",
    tags=["traces"]
)

@router.get("")
def get_all_traces():
    """Fetches a list of all distinct execution runs recently stored."""
    with get_db_session() as db:
        # Get all traces but we just want to group them by execution_id for the list view
        # We can fetch unique executions with their latest status
        results = db.query(
            AgentTrace.execution_id,
            AgentTrace.status,
            AgentTrace.timestamp
        ).order_by(desc(AgentTrace.timestamp)).all()

        # Deduplicate to show only the latest status per execution_id
        seen = set()
        unique_runs = []
        for row in results:
            if row.execution_id not in seen:
                seen.add(row.execution_id)
                unique_runs.append({
                    "execution_id": row.execution_id,
                    "status": row.status,
                    "timestamp": row.timestamp.isoformat()
                })
        
        if not unique_runs:
            return [{
                "execution_id": "demo-exec-001",
                "status": "Success",
                "timestamp": datetime.datetime.utcnow().isoformat()
            }]
            
        return unique_runs

@router.get("/{execution_id}")
def get_trace_details(execution_id: str):
    """Fetches the step-by-step logs for a specific execution."""
    with get_db_session() as db:
        traces = db.query(AgentTrace).filter(
            AgentTrace.execution_id == execution_id
        ).order_by(AgentTrace.timestamp).all()
        
        if not traces and execution_id == "demo-exec-001":
            now = datetime.datetime.utcnow()
            return [
                {
                    "id": "demo-step-1",
                    "agent_role": "System",
                    "task_description": "Initialize Plot Demo Execution",
                    "status": "Running",
                    "logs": "System booted securely. Waiting for instructions...",
                    "timestamp": (now - datetime.timedelta(minutes=2)).isoformat()
                },
                {
                    "id": "demo-step-2",
                    "agent_role": "Research Agent",
                    "task_description": "Analyze Market Data",
                    "status": "Success",
                    "logs": json.dumps({"thought": "I need to fetch the latest market trends.", "action": "SearchWeb", "result": "Found 5 key trends in AI development."}),
                    "timestamp": (now - datetime.timedelta(minutes=1)).isoformat()
                },
                {
                    "id": "demo-step-3",
                    "agent_role": "System",
                    "task_description": "Finalize",
                    "status": "Success",
                    "logs": "Flow Execution Finished",
                    "timestamp": now.isoformat()
                }
            ]
            
        return [
            {
                "id": t.id,
                "agent_role": t.agent_role,
                "task_description": t.task_description,
                "status": t.status,
                "logs": t.logs,
                "timestamp": t.timestamp.isoformat()
            }
            for t in traces
        ]
