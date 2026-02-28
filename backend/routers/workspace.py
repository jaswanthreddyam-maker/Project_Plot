import uuid
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from db_config import get_db_session, WorkspaceMetadata

router = APIRouter(
    prefix="/api/workspace",
    tags=["workspace"]
)

class WorkspaceUpdateRequest(BaseModel):
    app_name: Optional[str] = None

class WorkspaceResponse(BaseModel):
    app_name: str
    instance_id: str

@router.get("/info", response_model=WorkspaceResponse)
def get_workspace_info():
    """Returns the current workspace metadata."""
    with get_db_session() as db:
        workspace = db.query(WorkspaceMetadata).first()
        if not workspace:
            workspace = WorkspaceMetadata(
                id="singleton", 
                app_name="PlotAI Workspace", 
                instance_id=str(uuid.uuid4())
            )
            db.add(workspace)
            db.commit()
            db.refresh(workspace)
            
        return WorkspaceResponse(
            app_name=workspace.app_name,
            instance_id=workspace.instance_id
        )

@router.post("/update")
def update_workspace_info(req: WorkspaceUpdateRequest):
    """Updates the workspace metadata."""
    with get_db_session() as db:
        workspace = db.query(WorkspaceMetadata).first()
        if not workspace:
            workspace = WorkspaceMetadata(
                id="singleton", 
                app_name="PlotAI Workspace", 
                instance_id=str(uuid.uuid4())
            )
            db.add(workspace)
        
        if req.app_name is not None:
            workspace.app_name = req.app_name
            
        db.commit()
        return {"status": "success", "message": "Workspace updated."}
