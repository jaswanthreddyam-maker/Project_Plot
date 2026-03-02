import os
import uuid
import logging
import base64
import hashlib
import hmac
import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from cryptography.fernet import Fernet
from typing import List
from passlib.hash import bcrypt

from backend.db_config import get_db_session, VaultKey, GlobalConfig
from backend.auth import get_current_user

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
    created_at: str


class VariableItem(BaseModel):
    key: str
    value: str


class BulkVariableRequest(BaseModel):
    variables: List[VariableItem]

class PinRequest(BaseModel):
    pin: str


PIN_HASH_SCHEME = "pbkdf2_sha256"
PIN_ITERATIONS = 200_000


def hash_pin(pin: str) -> str:
    """Create a durable PIN hash independent of system bcrypt backends."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, PIN_ITERATIONS)
    salt_b64 = base64.urlsafe_b64encode(salt).decode("ascii")
    digest_b64 = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"{PIN_HASH_SCHEME}${PIN_ITERATIONS}${salt_b64}${digest_b64}"


def verify_pin_hash(pin: str, stored_hash: str) -> bool:
    """Verify PBKDF2 hash; supports legacy bcrypt hashes as fallback."""
    if not stored_hash:
        return False

    if stored_hash.startswith(f"{PIN_HASH_SCHEME}$"):
        try:
            _, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
            salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
            expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
            actual = hashlib.pbkdf2_hmac(
                "sha256",
                pin.encode("utf-8"),
                salt,
                int(iterations),
            )
            return hmac.compare_digest(actual, expected)
        except Exception:
            return False

    # Backward compatibility for previously saved bcrypt hashes.
    try:
        return bcrypt.verify(pin, stored_hash)
    except Exception:
        return False


@router.post("/save")
def save_vault_key(req: VaultSaveRequest, current_user: str = Depends(get_current_user)):
    """Encrypts and stores a key in the Vault."""
    if not req.value or not req.value.strip():
        raise HTTPException(status_code=400, detail="Mawa, key empty ga undhi. Paste chesi save cheyi.")
    
    # Optional basic prefix validation for OpenAI
    if req.key_name == "OPENAI_API_KEY" and not req.value.startswith("sk-") and not req.value.startswith("sk-proj-"):
        raise HTTPException(status_code=400, detail="Rey mawa, idhi valid key kaadhu. sk- start ayye OpenAI key ivvu.")
        
    try:
        encrypted_value = fernet.encrypt(req.value.encode()).decode()
        
        with get_db_session() as db:
            # Check if key exists and update, or create new
            existing_key = db.query(VaultKey).filter(
                VaultKey.key_name == req.key_name,
                VaultKey.user_id == current_user
            ).first()
            if existing_key:
                existing_key.encrypted_value = encrypted_value
                existing_key.category = req.category
                db.add(existing_key)
            else:
                new_key = VaultKey(
                    id=str(uuid.uuid4()),
                    user_id=current_user,
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


@router.post("/bulk")
def save_bulk_vault_variables(req: BulkVariableRequest, current_user: str = Depends(get_current_user)):
    """Bulk upsert environment variables in the Vault."""
    if not req.variables:
        raise HTTPException(status_code=400, detail="At least one variable is required.")

    normalized: dict[str, str] = {}
    for item in req.variables:
        key = item.key.strip()
        value = item.value.strip()
        if not key or not value:
            raise HTTPException(status_code=400, detail="Each variable requires both key and value.")
        normalized[key] = value

    try:
        inserted = 0
        with get_db_session() as db:
            for key_name, value in normalized.items():
                encrypted_value = fernet.encrypt(value.encode()).decode()
                existing_key = db.query(VaultKey).filter(
                    VaultKey.key_name == key_name,
                    VaultKey.user_id == current_user
                ).first()

                if existing_key:
                    existing_key.encrypted_value = encrypted_value
                    existing_key.category = "ENV"
                    db.add(existing_key)
                else:
                    db.add(VaultKey(
                        id=str(uuid.uuid4()),
                        user_id=current_user,
                        key_name=key_name,
                        encrypted_value=encrypted_value,
                        category="ENV"
                    ))
                inserted += 1

            db.commit()

        return {"status": "success", "inserted": inserted}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving bulk vault variables: {e}")
        raise HTTPException(status_code=500, detail="Failed to save variables.")

@router.get("/list", response_model=List[VaultKeyResponse])
def list_vault_keys(current_user: str = Depends(get_current_user)):
    """Returns a list of keys with masked values for the UI."""
    with get_db_session() as db:
        keys = db.query(VaultKey).filter(VaultKey.user_id == current_user).all()
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
                masked_value=masked,
                created_at=key.created_at.isoformat() if key.created_at else ""
            ))
        return response

@router.delete("/delete/{key_name}")
def delete_vault_key(key_name: str, current_user: str = Depends(get_current_user)):
    """Deletes a key from the Vault."""
    with get_db_session() as db:
        key = db.query(VaultKey).filter(
            VaultKey.key_name == key_name,
            VaultKey.user_id == current_user
        ).first()
        if key:
            db.delete(key)
            db.commit()
            return {"status": "success", "message": f"Key '{key_name}' deleted."}
        raise HTTPException(status_code=404, detail="Key not found")

@router.post("/set-pin")
def set_vault_pin(req: PinRequest, current_user: str = Depends(get_current_user)):
    """Hashes and saves a 4-6 digit PIN for the user."""
    if not req.pin.isdigit() or not (4 <= len(req.pin) <= 6):
        raise HTTPException(status_code=400, detail="PIN must be 4-6 digits.")

    try:
        hashed_pin = hash_pin(req.pin)

        with get_db_session() as db:
            config = db.query(GlobalConfig).filter(GlobalConfig.user_id == current_user).first()
            if not config:
                # Create a default config if none exists for the user
                config = GlobalConfig(id=str(uuid.uuid4()), user_id=current_user)
                db.add(config)

            config.vault_pin_hash = hashed_pin
            db.commit()
    except Exception as e:
        logging.exception("Failed to set vault PIN: %s", e)
        raise HTTPException(status_code=500, detail="Failed to set vault PIN.")

    return {"status": "success", "message": "Vault PIN set successfully."}

@router.post("/verify-pin")
def verify_vault_pin(req: PinRequest, current_user: str = Depends(get_current_user)):
    """Verifies the PIN against the stored hash."""
    with get_db_session() as db:
        config = db.query(GlobalConfig).filter(GlobalConfig.user_id == current_user).first()
        if not config or not config.vault_pin_hash:
            raise HTTPException(status_code=404, detail="No PIN configured.")

        if verify_pin_hash(req.pin, config.vault_pin_hash):
            return {"unlocked": True}
        raise HTTPException(status_code=400, detail="Incorrect PIN")

@router.get("/has-pin")
def has_vault_pin(current_user: str = Depends(get_current_user)):
    """Checks if the user has a PIN configured."""
    with get_db_session() as db:
        config = db.query(GlobalConfig).filter(GlobalConfig.user_id == current_user).first()
        return {"has_pin": bool(config and config.vault_pin_hash)}
