from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from db_config import get_db_session, WorkspaceMetadata
from auth import get_current_user

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
def get_workspace_info(current_user: str = Depends(get_current_user)):
    """Returns the current workspace metadata."""
    with get_db_session() as db:
        workspace = db.query(WorkspaceMetadata).filter(WorkspaceMetadata.user_id == current_user).first()
        if not workspace:
            import uuid
            workspace = WorkspaceMetadata(
                id=str(uuid.uuid4()), 
                user_id=current_user,
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
def update_workspace_info(req: WorkspaceUpdateRequest, current_user: str = Depends(get_current_user)):
    """Updates the workspace metadata."""
    with get_db_session() as db:
        workspace = db.query(WorkspaceMetadata).filter(WorkspaceMetadata.user_id == current_user).first()
        if not workspace:
            import uuid
            workspace = WorkspaceMetadata(
                id=str(uuid.uuid4()), 
                user_id=current_user,
                app_name="PlotAI Workspace", 
                instance_id=str(uuid.uuid4())
            )
            db.add(workspace)
        
        if req.app_name is not None:
            workspace.app_name = req.app_name
            
        db.commit()
        return {"status": "success", "message": "Workspace updated."}
