from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uuid
import datetime
from sqlalchemy import desc

from backend.db_config import get_db_session, ScheduledFlow
from backend.auth import get_current_user

router = APIRouter(
    prefix="/api/automations",
    tags=["automations"]
)

class AutomationCreateRequest(BaseModel):
    crew_name: str
    cron_schedule: str
    payload: Dict[str, Any]

@router.get("")
def get_all_automations(current_user: str = Depends(get_current_user)):
    """Fetch all scheduled automations"""
    with get_db_session() as db:
        flows = db.query(ScheduledFlow).filter(
            ScheduledFlow.user_id == current_user
        ).order_by(desc(ScheduledFlow.created_at)).all()
        return [
            {
                "id": f.id,
                "crew_name": f.crew_name,
                "cron_schedule": f.cron_schedule,
                "is_active": f.is_active,
                "created_at": f.created_at.isoformat()
            } for f in flows
        ]

@router.post("")
def create_automation(req: AutomationCreateRequest, current_user: str = Depends(get_current_user)):
    """Create a new automation schedule"""
    import json
    with get_db_session() as db:
        new_flow = ScheduledFlow(
            id=f"sch-{str(uuid.uuid4())[:8]}",
            user_id=current_user,
            crew_name=req.crew_name,
            cron_schedule=req.cron_schedule,
            payload=json.dumps(req.payload),
            is_active=True
        )
        db.add(new_flow)
        db.commit()
        db.refresh(new_flow)
        return {"status": "success", "id": new_flow.id}

class ToggleRequest(BaseModel):
    is_active: bool

@router.patch("/{flow_id}/toggle")
def toggle_automation(flow_id: str, req: ToggleRequest, current_user: str = Depends(get_current_user)):
    """Toggle the active state of an automation"""
    with get_db_session() as db:
        flow = db.query(ScheduledFlow).filter(
            ScheduledFlow.id == flow_id,
            ScheduledFlow.user_id == current_user
        ).first()
        if not flow:
            raise HTTPException(status_code=404, detail="Automation not found")
        
        flow.is_active = req.is_active
        db.commit()
        return {"status": "success", "is_active": flow.is_active}
