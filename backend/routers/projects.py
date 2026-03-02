from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Automations"])

# In-memory user-scoped store for development scaffolding.
fake_projects_db: Dict[str, List[dict]] = {}


class Project(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    updated_at: str


class ProjectCreate(BaseModel):
    title: Optional[str] = "Untitled Project"
    prompt: Optional[str] = ""


@router.get("/", response_model=List[Project])
async def get_projects(current_user: str = Depends(get_current_user)):
    return fake_projects_db.get(current_user, [])


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: str = Depends(get_current_user)):
    projects = fake_projects_db.get(current_user, [])
    project = next((item for item in projects if item["id"] == project_id), None)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=Project)
async def create_project(req: ProjectCreate, current_user: str = Depends(get_current_user)):
    title = (req.title or "").strip() or "Untitled Project"
    prompt = (req.prompt or "").strip()

    new_project = {
        "id": str(uuid.uuid4()),
        "title": title,
        "description": (
            f"Generated from prompt: {prompt[:30]}..." if prompt else "Start fresh project"
        ),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    user_projects = fake_projects_db.setdefault(current_user, [])
    user_projects.insert(0, new_project)
    return new_project
