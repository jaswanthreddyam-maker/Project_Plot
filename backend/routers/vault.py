import os
import uuid
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from cryptography.fernet import Fernet
from typing import List

from db_config import get_db_session, VaultKey

router = APIRouter(
    prefix="/api/vault",
    tags=["vault"]
)

# ── Fernet Encryption Setup ──
# In production, VAULT_MASTER_KEY should be set in the environment.
MASTER_KEY = os.environ.get("VAULT_MASTER_KEY")
if not MASTER_KEY:
    # Generate a key and log a loud warning if running without one
    MASTER_KEY = Fernet.generate_key().decode()
    os.environ["VAULT_MASTER_KEY"] = MASTER_KEY
    logging.warning(
        "\n============================================================\n"
        "WARNING: VAULT_MASTER_KEY environment variable not set!\n"
        "A temporary master key has been generated for this session.\n"
        "Data encrypted with this key will be lost if the server restarts.\n"
        "To fix: Set VAULT_MASTER_KEY to a secure 32-byte url-safe base64 string.\n"
        "============================================================\n"
    )

fernet = Fernet(MASTER_KEY.encode())

class VaultSaveRequest(BaseModel):
    key_name: str
    value: str
    category: str

class VaultKeyResponse(BaseModel):
    id: str
    key_name: str
    category: str
    masked_value: str

@router.post("/save")
def save_vault_key(req: VaultSaveRequest):
    """Encrypts and stores a key in the Vault."""
    if not req.value or not req.value.strip():
        raise HTTPException(status_code=400, detail="Mawa, key empty ga undhi. Paste chesi save cheyi.")
    
    # Optional basic prefix validation for OpenAI
    if req.key_name == "OPENAI_API_KEY" and not req.value.startswith("sk-") and not req.value.startswith("sk-proj-"):
        raise HTTPException(status_code=400, detail="Rey mawa, idhi valid key kaadhu. Proper 'sk-' key ivvu.")
        
    try:
        encrypted_value = fernet.encrypt(req.value.encode()).decode()
        
        with get_db_session() as db:
            # Check if key exists and update, or create new
            existing_key = db.query(VaultKey).filter(VaultKey.key_name == req.key_name).first()
            if existing_key:
                existing_key.encrypted_value = encrypted_value
                existing_key.category = req.category
                db.add(existing_key)
            else:
                new_key = VaultKey(
                    id=str(uuid.uuid4()),
                    key_name=req.key_name,
                    encrypted_value=encrypted_value,
                    category=req.category
                )
                db.add(new_key)
            db.commit()
            if existing_key:
                db.refresh(existing_key)
            else:
                db.refresh(new_key)
            
        return {"status": "success", "message": f"Key '{req.key_name}' saved securely."}
    except Exception as e:
        logging.error(f"Error saving vault key: {e}")
        raise HTTPException(status_code=500, detail="Database is currently busy. Please try saving again in a moment.")

@router.get("/list", response_model=List[VaultKeyResponse])
def list_vault_keys():
    """Returns a list of keys with masked values for the UI."""
    with get_db_session() as db:
        keys = db.query(VaultKey).all()
        response = []
        for key in keys:
            # Masking value (sk-...xxxx)
            try:
                decrypted = fernet.decrypt(key.encrypted_value.encode()).decode()
                # Show first 3 chars if possible (like sk-), then dots, then last 4
                if len(decrypted) > 10:
                    masked = f"{decrypted[:3]}••••••••{decrypted[-4:]}"
                else:
                    masked = "••••••••"
            except Exception:
                masked = "Error Decrypting"
                
            response.append(VaultKeyResponse(
                id=key.id,
                key_name=key.key_name,
                category=key.category,
                masked_value=masked
            ))
        return response

@router.delete("/delete/{key_name}")
def delete_vault_key(key_name: str):
    """Deletes a key from the Vault."""
    with get_db_session() as db:
        key = db.query(VaultKey).filter(VaultKey.key_name == key_name).first()
        if key:
            db.delete(key)
            db.commit()
            return {"status": "success", "message": f"Key '{key_name}' deleted."}
        raise HTTPException(status_code=404, detail="Key not found")
