import os
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from cryptography.fernet import Fernet
import requests

from db_config import get_db_session, VaultKey
from auth import get_current_user

router = APIRouter(
    prefix="/api/integrations",
    tags=["integrations"]
)

# Nango Configuration
NANGO_SECRET_KEY = os.environ.get("NANGO_SECRET_KEY")
NANGO_BASE_URL = "https://api.nango.dev"

class ConnectRequest(BaseModel):
    provider_config_key: str
    connection_id: str

class DisconnectRequest(BaseModel):
    provider_config_key: str
    connection_id: str

def get_fernet():
    master_key = os.environ.get("VAULT_MASTER_KEY")
    if not master_key:
        raise HTTPException(status_code=500, detail="VAULT_MASTER_KEY not configured.")
    return Fernet(master_key.encode())

@router.post("/callback")
async def nango_callback(req: ConnectRequest, current_user: str = Depends(get_current_user)):
    """
    Called by the frontend after a successful Nango OAuth flow.
    Fetches the credentials from Nango, encrypts them, and stores them in the Vault.
    """
    if not NANGO_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Nango not configured on backend.")

    # 1. Fetch connection details from Nango
    headers = {"Authorization": f"Bearer {NANGO_SECRET_KEY}"}
    url = f"{NANGO_BASE_URL}/connection/{req.connection_id}?provider_config_key={req.provider_config_key}"
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        credentials = data.get("credentials", {})
        # Depending on the provider, we might store access_token, refresh_token, etc.
        # For simplicity, we store the whole credentials object as JSON encrypted.
        token_str = data.get("credentials", {}).get("access_token") or data.get("credentials", {}).get("api_key")
        
        if not token_str:
            raise HTTPException(status_code=400, detail="No token found in Nango connection.")

        # 2. Encrypt and store in Vault
        fernet = get_fernet()
        encrypted_token = fernet.encrypt(token_str.encode()).decode()
        
        key_name = f"{req.provider_config_key.upper()}_TOKEN"
        
        with get_db_session() as db:
            existing = db.query(VaultKey).filter(
                VaultKey.key_name == key_name,
                VaultKey.user_id == current_user
            ).first()
            
            if existing:
                existing.encrypted_value = encrypted_token
            else:
                new_key = VaultKey(
                    id=str(uuid.uuid4()),
                    user_id=current_user,
                    key_name=key_name,
                    encrypted_value=encrypted_token,
                    category="OAUTH"
                )
                db.add(new_key)
            
            db.commit()
            
        return {"status": "success", "message": f"Connected to {req.provider_config_key} via Nango."}
        
    except requests.exceptions.RequestException as e:
        logging.error(f"Nango API Error: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch connection from Nango.")

@router.post("/disconnect")
async def disconnect_integration(req: DisconnectRequest, current_user: str = Depends(get_current_user)):
    """
    Deletes the connection from Nango and removes the key from the Vault.
    """
    if not NANGO_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Nango not configured on backend.")

    # 1. Delete from Nango
    headers = {"Authorization": f"Bearer {NANGO_SECRET_KEY}"}
    url = f"{NANGO_BASE_URL}/connection/{req.connection_id}?provider_config_key={req.provider_config_key}"
    
    try:
        requests.delete(url, headers=headers)
        # We continue even if Nango delete fails, to ensure local cleanup
    except Exception as e:
        logging.warning(f"Failed to delete Nango connection: {e}")

    # 2. Remove from Vault
    key_name = f"{req.provider_config_key.upper()}_TOKEN"
    with get_db_session() as db:
        key = db.query(VaultKey).filter(
            VaultKey.key_name == key_name,
            VaultKey.user_id == current_user
        ).first()
        if key:
            db.delete(key)
            db.commit()
            
    return {"status": "success", "message": f"Disconnected {req.provider_config_key}."}
