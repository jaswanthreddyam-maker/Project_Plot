from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc

from backend.auth import get_current_user
from backend.db_config import ProjectRecord, get_db_session

router = APIRouter(prefix="/api/projects", tags=["Automations"])


class ProjectGraph(BaseModel):
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)


class Project(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    updated_at: str
    graph: Optional[ProjectGraph] = None


class ProjectCreate(BaseModel):
    title: Optional[str] = "Untitled Project"
    prompt: Optional[str] = ""


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    graph: Optional[ProjectGraph] = None


def _to_project_response(project: ProjectRecord, include_graph: bool) -> Project:
    return Project(
        id=project.id,
        title=project.title,
        description=project.description or "",
        updated_at=(project.updated_at or datetime.utcnow()).isoformat(),
        graph=ProjectGraph(**project.graph) if include_graph and isinstance(project.graph, dict) else None,
    )


@router.get("/", response_model=List[Project])
async def get_projects(current_user: str = Depends(get_current_user)):
    with get_db_session() as db:
        projects = (
            db.query(ProjectRecord)
            .filter(ProjectRecord.user_id == current_user)
            .order_by(desc(ProjectRecord.updated_at))
            .all()
        )
        return [_to_project_response(project, include_graph=False) for project in projects]


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: str = Depends(get_current_user)):
    with get_db_session() as db:
        project = (
            db.query(ProjectRecord)
            .filter(
                ProjectRecord.id == project_id,
                ProjectRecord.user_id == current_user,
            )
            .first()
        )
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return _to_project_response(project, include_graph=True)


@router.post("/", response_model=Project)
async def create_project(req: ProjectCreate, current_user: str = Depends(get_current_user)):
    title = (req.title or "").strip() or "Untitled Project"
    prompt = (req.prompt or "").strip()

    with get_db_session() as db:
        project = ProjectRecord(
            id=str(uuid.uuid4()),
            user_id=current_user,
            title=title,
            description=(f"Generated from prompt: {prompt[:30]}..." if prompt else "Start fresh project"),
            graph={"nodes": [], "edges": []},
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return _to_project_response(project, include_graph=True)


@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    req: ProjectUpdate,
    current_user: str = Depends(get_current_user),
):
    with get_db_session() as db:
        project = (
            db.query(ProjectRecord)
            .filter(
                ProjectRecord.id == project_id,
                ProjectRecord.user_id == current_user,
            )
            .first()
        )
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")

        if req.title is not None:
            project.title = req.title.strip() or "Untitled Project"
        if req.description is not None:
            project.description = req.description
        if req.graph is not None:
            project.graph = req.graph.model_dump()

        project.updated_at = datetime.utcnow()
        db.add(project)
        db.commit()
        db.refresh(project)
        return _to_project_response(project, include_graph=True)
