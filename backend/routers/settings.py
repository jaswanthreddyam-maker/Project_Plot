"""
Settings Router — LLM Connections CRUD
GET / POST / DELETE endpoints for managing LLM API key connections.
Keys are stored base64-encoded in SQLite (use a proper secrets manager in production).
"""

import uuid
import base64
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from db_config import SessionLocal, LLMConnection

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


# ── Request / Response Models ──────────────────────────────────
class CreateConnectionRequest(BaseModel):
    provider: str
    alias: Optional[str] = None
    api_key: str  # raw key from frontend


class ConnectionResponse(BaseModel):
    id: str
    provider: str
    alias: str
    api_key_masked: str
    created_at: str


# ── Helpers ────────────────────────────────────────────────────
def mask_key(raw_b64: str) -> str:
    """Decode base64 key and mask it for safe display."""
    try:
        decoded = base64.b64decode(raw_b64).decode("utf-8")
        if len(decoded) <= 8:
            return decoded[:2] + "•" * (len(decoded) - 2)
        return decoded[:4] + "•••" + decoded[-4:]
    except Exception:
        return "••••••••"


def to_response(conn: LLMConnection) -> dict:
    return {
        "id": conn.id,
        "provider": conn.provider,
        "alias": conn.alias or "",
        "api_key_masked": mask_key(conn.api_key_encrypted),
        "created_at": conn.created_at.isoformat() if conn.created_at else "",
    }


# ── Endpoints ──────────────────────────────────────────────────
@settings_router.get("/llm-connections")
def get_connections():
    """Return all LLM connections with masked API keys."""
    session = SessionLocal()
    try:
        connections = session.query(LLMConnection).order_by(LLMConnection.created_at.desc()).all()
        return {"connections": [to_response(c) for c in connections]}
    finally:
        session.close()


@settings_router.post("/llm-connections")
def create_connection(req: CreateConnectionRequest):
    """Store a new LLM connection (API key base64-encoded)."""
    if not req.api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required.")

    session = SessionLocal()
    try:
        conn = LLMConnection(
            id=str(uuid.uuid4()),
            provider=req.provider.lower().strip(),
            alias=req.alias or f"{req.provider}-default",
            api_key_encrypted=base64.b64encode(req.api_key.encode("utf-8")).decode("utf-8"),
            created_at=datetime.utcnow(),
        )
        session.add(conn)
        session.commit()
        session.refresh(conn)
        return {"connection": to_response(conn)}
    finally:
        session.close()


@settings_router.delete("/llm-connections/{connection_id}")
def delete_connection(connection_id: str):
    """Delete an LLM connection by ID."""
    session = SessionLocal()
    try:
        conn = session.query(LLMConnection).filter_by(id=connection_id).first()
        if not conn:
            raise HTTPException(status_code=404, detail="Connection not found.")
        session.delete(conn)
        session.commit()
        return {"status": "deleted", "id": connection_id}
    finally:
        session.close()
