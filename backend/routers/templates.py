from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from db_config import get_db_session, Template
from auth import get_current_user

router = APIRouter(
    prefix="/api/templates",
    tags=["templates"]
)

class TemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    icon_name: Optional[str]
    required_keys: Optional[List[str]]
    workflow_config: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True

class SaveTemplateRequest(BaseModel):
    name: str
    description: str
    icon_name: str
    required_keys: List[str]
    workflow_config: Dict[str, Any]

@router.get("", response_model=List[TemplateResponse])
def get_all_templates(current_user: str = Depends(get_current_user)):
    with get_db_session() as db:
        templates = db.query(Template).filter(Template.user_id == current_user).all()
        return templates

@router.post("/save")
def save_template(req: SaveTemplateRequest, current_user: str = Depends(get_current_user)):
    with get_db_session() as db:
        existing = db.query(Template).filter(
            Template.name == req.name,
            Template.user_id == current_user
        ).first()
        if existing:
            existing.description = req.description
            existing.icon_name = req.icon_name
            existing.required_keys = req.required_keys
            existing.workflow_config = req.workflow_config
            db.add(existing)
        else:
            new_template = Template(
                user_id=current_user,
                name=req.name,
                description=req.description,
                icon_name=req.icon_name,
                required_keys=req.required_keys,
                workflow_config=req.workflow_config
            )
            db.add(new_template)
        
        db.commit()
        return {"status": "success", "message": f"Template '{req.name}' saved."}

@router.post("/seed")
def seed_default_templates(current_user: str = Depends(get_current_user)):
    default_templates = [
        {
            "name": "Viral Thread Creator",
            "description": "Turns any news link into a Twitter/X thread with hashtags.",
            "icon_name": "PenTool",
            "required_keys": ["openai", "serper"],
            "workflow_config": {
                "agentConfig": [
                    {
                        "id": "agent-thread",
                        "role": "Social Media Copywriter",
                        "goal": "Write viral Twitter threads from news articles.",
                        "backstory": "Expert social media strategist specialized in engagement.",
                        "provider": "openai",
                        "tools": ["Web Search"]
                    }
                ],
                "taskConfig": [
                    {
                        "id": "task-thread",
                        "description": "Read the provided article link and generate a 5-tweet thread summarizing it.",
                        "expected_output": "A compelling, formatted thread with emojis and hashtags.",
                        "is_structured": False
                    }
                ]
            }
        },
        {
            "name": "Code Refactor & Doc Gen",
            "description": "Cleans up messy code, adds comments, and generates a README.md.",
            "icon_name": "Code2",
            "required_keys": ["openai"],
            "workflow_config": {
                "agentConfig": [
                    {
                        "id": "agent-coder",
                        "role": "Senior Developer",
                        "goal": "Refactor code perfectly and document it.",
                        "backstory": "Staff software engineer with a strict eye for clean code principles.",
                        "provider": "openai",
                        "tools": []
                    }
                ],
                "taskConfig": [
                    {
                        "id": "task-coder",
                        "description": "Analyze the codebase, fix anti-patterns, and write comprehensive markdown documentation.",
                        "expected_output": "Refactored code snippets and a well-structured README.",
                        "is_structured": False
                    }
                ]
            }
        },
        {
            "name": "Market & Competitor Researcher",
            "description": "Analyzes a company, finds competitors, and generates a pricing comparison table.",
            "icon_name": "Search",
            "required_keys": ["openai", "serper"],
            "workflow_config": {
                "agentConfig": [
                    {
                        "id": "agent-researcher",
                        "role": "Market Analyst",
                        "goal": "Map out the competitive landscape.",
                        "backstory": "Veteran business analyst matching companies by value propositions.",
                        "provider": "openai",
                        "tools": ["Web Search"]
                    }
                ],
                "taskConfig": [
                    {
                        "id": "task-researcher",
                        "description": "Search the web for top 3 direct competitors to the requested product and summarize their pricing models.",
                        "expected_output": "A markdown table comparing features and pricing of the 3 competitors.",
                        "is_structured": False
                    }
                ]
            }
        }
    ]

    with get_db_session() as db:
        inserted = 0
        for t in default_templates:
            existing = db.query(Template).filter(
                Template.name == t["name"],
                Template.user_id == current_user
            ).first()
            if not existing:
                new_template = Template(
                    user_id=current_user,
                    name=t["name"],
                    description=t["description"],
                    icon_name=t["icon_name"],
                    required_keys=t["required_keys"],
                    workflow_config=t["workflow_config"]
                )
                db.add(new_template)
                inserted += 1
        
        if inserted > 0:
            db.commit()
            
    return {"status": "success", "message": f"Seeded {inserted} templates."}
