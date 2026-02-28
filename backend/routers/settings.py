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

from db_config import SessionLocal, LLMConnection, IntegrationToken

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

class IntegrationTokenRequest(BaseModel):
    provider: str
    token: str

class IntegrationResponse(BaseModel):
    id: str
    provider: str
    token_masked: str
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


@settings_router.get("/integrations")
def get_integrations():
    """Return all connected integration tokens with masked keys."""
    session = SessionLocal()
    try:
        tokens = session.query(IntegrationToken).order_by(IntegrationToken.created_at.desc()).all()
        return {
            "integrations": [
                {
                    "id": t.id,
                    "provider": t.provider,
                    "token_masked": mask_key(t.token_encrypted),
                    "created_at": t.created_at.isoformat() if t.created_at else "",
                }
                for t in tokens
            ]
        }
    finally:
        session.close()


@settings_router.post("/integrations")
def save_integration(req: IntegrationTokenRequest):
    """Store or update a third-party integration token."""
    if not req.token.strip():
        raise HTTPException(status_code=400, detail="Token is required.")

    session = SessionLocal()
    try:
        provider = req.provider.lower().strip()
        conn = session.query(IntegrationToken).filter_by(provider=provider).first()
        
        encoded_token = base64.b64encode(req.token.encode("utf-8")).decode("utf-8")
        
        if conn:
            conn.token_encrypted = encoded_token
            conn.created_at = datetime.utcnow()
        else:
            conn = IntegrationToken(
                id=str(uuid.uuid4()),
                provider=provider,
                token_encrypted=encoded_token,
                created_at=datetime.utcnow(),
            )
            session.add(conn)
        
        session.commit()
        session.refresh(conn)
        return {
            "integration": {
                "id": conn.id,
                "provider": conn.provider,
                "token_masked": mask_key(conn.token_encrypted),
                "created_at": conn.created_at.isoformat(),
            }
        }
    finally:
        session.close()


@settings_router.delete("/integrations/{provider}")
def delete_integration(provider: str):
    """Delete an integration token by provider name."""
    session = SessionLocal()
    try:
        conn = session.query(IntegrationToken).filter_by(provider=provider.lower()).first()
        if not conn:
            raise HTTPException(status_code=404, detail="Integration not found.")
        session.delete(conn)
        session.commit()
        return {"status": "deleted", "provider": provider}
    finally:
        session.close()
