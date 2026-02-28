from fastapi import APIRouter
from sqlalchemy import desc
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
        
        return unique_runs

@router.get("/{execution_id}")
def get_trace_details(execution_id: str):
    """Fetches the step-by-step logs for a specific execution."""
    with get_db_session() as db:
        traces = db.query(AgentTrace).filter(
            AgentTrace.execution_id == execution_id
        ).order_by(AgentTrace.timestamp).all()
        
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
