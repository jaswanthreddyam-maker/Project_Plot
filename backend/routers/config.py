import shutil
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from db_config import get_db_session, GlobalConfig

router = APIRouter(
    prefix="/api/config",
    tags=["config"]
)

class ConfigUpdateRequest(BaseModel):
    default_model: Optional[str] = None
    temperature: Optional[float] = None
    memory_enabled: Optional[bool] = None

class ConfigResponse(BaseModel):
    default_model: str
    temperature: float
    memory_enabled: bool

@router.get("/", response_model=ConfigResponse)
def get_global_config():
    """Returns the current global configuration."""
    with get_db_session() as db:
        config = db.query(GlobalConfig).first()
        if not config:
            # Create default config if it doesn't exist
            config = GlobalConfig(id="singleton", default_model="gpt-4o", temperature=0.7, memory_enabled=True)
            db.add(config)
            db.commit()
            db.refresh(config)
            
        return ConfigResponse(
            default_model=config.default_model,
            temperature=config.temperature,
            memory_enabled=config.memory_enabled
        )

@router.post("/update")
def update_global_config(req: ConfigUpdateRequest):
    """Updates the global configuration."""
    with get_db_session() as db:
        config = db.query(GlobalConfig).first()
        if not config:
            config = GlobalConfig(id="singleton", default_model="gpt-4o", temperature=0.7, memory_enabled=True)
            db.add(config)
        
        if req.default_model is not None:
            config.default_model = req.default_model
        if req.temperature is not None:
            config.temperature = req.temperature
        if req.memory_enabled is not None:
            config.memory_enabled = req.memory_enabled
            
        db.commit()
        return {"status": "success", "message": "Configuration updated."}

@router.post("/clear-memory")
def clear_vector_store():
    """Wipes the ChromaDB memory store securely."""
    chroma_path = "/app/chroma_db"
    try:
        if os.path.exists(chroma_path):
            shutil.rmtree(chroma_path)
            # Recreate basic empty dir so Chroma doesn't crash on next run
            os.makedirs(chroma_path, exist_ok=True)
            return {"status": "success", "message": "Vector store memory completely cleared."}
        else:
            return {"status": "success", "message": "No memory store found to clear."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear memory: {str(e)}")
