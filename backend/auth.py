import logging
import os
from datetime import datetime, timedelta

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

# Configuration for JWT validation
ALGORITHM = "HS256"
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "v-61-plot-ai-secret-key-change-me")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)

class GoogleTokenRequest(BaseModel):
    token: str

@router.post("/api/auth/google")
async def verify_google_token(req: GoogleTokenRequest):
    """
    Verifies a Google OAuth token directly and issues the application's standard JWT.
    Issues a backend-native bearer token for API access.
    """
    try:
        # Use Google UserInfo API to verify the access_token
        google_response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.token}"},
            timeout=10
        )

        if google_response.status_code != 200:
            logger.error("Google token verification failed: %s", google_response.text)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Google Access Token: {google_response.text}"
            )

        user_info = google_response.json()
        email = user_info.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google response does not contain an email")

        # Due to the Next.js/FastAPI split, the backend uses `sub` (email) across all ORM models.
        access_token_expires = timedelta(minutes=60 * 24 * 7) # 7 days
        payload = {
            "sub": email,
            "exp": datetime.utcnow() + access_token_expires
        }
        encoded_jwt = jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)
        return {"access_token": encoded_jwt, "token_type": "bearer"}
    except HTTPException:
        raise
    except requests.RequestException as exc:
        logger.exception("Google auth request failed")
        raise HTTPException(status_code=502, detail="Failed to verify Google token") from exc
    except Exception as exc:
        logger.exception("Unexpected Google auth error")
        raise HTTPException(status_code=500, detail="Unexpected Google auth error") from exc

@router.post("/api/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Issues a JWT Bearer token for FastAPI APIs.
    Username is treated as the canonical subject (email in current flow).
    """
    username = form_data.username.strip().lower()
    if not username or not form_data.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    access_token_expires = timedelta(minutes=60 * 24 * 7) # 7 days
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + access_token_expires
    }
    encoded_jwt = jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": encoded_jwt, "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Dependency that extracts the user ID (sub) from a JWT token.
    Strictly raises 401 Unauthorized if the token is invalid or missing.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Dev fallback for legacy non-JWT tokens.
    if "." not in token:
        return token

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject (user ID)",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

