"""
Authentication Router
CI/CD Pipeline Scheduler
Handles signup, login, profile retrieval, and profile updates.
Uses bcrypt for secure password hashing and PyJWT for signed tokens.
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import datetime
import bcrypt
import jwt

from ..database import users_col
from ..models import _next_id

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = "cicd-scheduler-super-secret-key-2026-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    role: Optional[str] = "DevOps Engineer"


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    avatar_color: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


# ── Helper Functions ──────────────────────────────────────────────────────────

def create_access_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def sanitize_user(user: dict) -> dict:
    """Strip password hash and MongoDB internal ID from response."""
    is_admin = bool(
        user.get("is_admin") is True
        or user.get("role") == "Admin"
        or user.get("username") == "admin_devops"
    )
    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "email": user.get("email"),
        "full_name": user.get("full_name") or user.get("username"),
        "role": user.get("role", "DevOps Engineer"),
        "is_admin": is_admin,
        "avatar_color": user.get("avatar_color", "#6366f1"),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
    }


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to extract authenticated user from Bearer header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format (Bearer token expected)")
    
    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token. Please log in again.")

    user = users_col.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User account not found")

    return user


def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Optional dependency: returns user doc if valid Bearer token provided, else None."""
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
        return users_col.find_one({"id": user_id})
    except Exception:
        return None


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency enforcing that current user has administrative rights."""
    is_admin = bool(
        user.get("is_admin") is True
        or user.get("role") == "Admin"
        or user.get("username") == "admin_devops"
    )
    if not is_admin:
        raise HTTPException(status_code=403, detail="Administrative privileges required")
    return user


# ── Auth Endpoints ────────────────────────────────────────────────────────────

@router.post("/signup")
def signup(req: SignupRequest):
    clean_username = req.username.strip().lower()
    clean_email = req.email.strip().lower()

    if not clean_username or not clean_email or not req.password:
        raise HTTPException(status_code=400, detail="Username, email, and password are required")

    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    # Check for existing user
    if users_col.find_one({"username": clean_username}):
        raise HTTPException(status_code=400, detail="Username is already taken")
    if users_col.find_one({"email": clean_email}):
        raise HTTPException(status_code=400, detail="Email is already registered")

    # Hash password
    pw_bytes = req.password.encode("utf-8")
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")

    uid = _next_id("users")
    now = datetime.datetime.utcnow()

    # Pre-assign a pleasant palette color
    colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"]
    avatar_color = colors[uid % len(colors)]

    doc = {
        "id": uid,
        "username": clean_username,
        "email": clean_email,
        "full_name": req.full_name.strip() if req.full_name else clean_username.title(),
        "role": req.role or "DevOps Engineer",
        "avatar_color": avatar_color,
        "password_hash": hashed,
        "created_at": now,
        "last_login": now,
    }

    users_col.insert_one(doc)
    token = create_access_token(uid, clean_username)

    return {
        "message": "Account created successfully",
        "token": token,
        "user": sanitize_user(doc),
    }


@router.post("/login")
def login(req: LoginRequest):
    identifier = req.username_or_email.strip().lower()
    if not identifier or not req.password:
        raise HTTPException(status_code=400, detail="Username/email and password are required")

    user = users_col.find_one({
        "$or": [
            {"username": identifier},
            {"email": identifier},
        ]
    })

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Check password
    stored_hash = user.get("password_hash", "")
    pw_bytes = req.password.encode("utf-8")
    try:
        if not bcrypt.checkpw(pw_bytes, stored_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Invalid username or password")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Update last login
    now = datetime.datetime.utcnow()
    users_col.update_one({"id": user["id"]}, {"$set": {"last_login": now}})
    user["last_login"] = now

    token = create_access_token(user["id"], user["username"])

    return {
        "message": "Login successful",
        "token": token,
        "user": sanitize_user(user),
    }


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {
        "user": sanitize_user(user)
    }


@router.put("/profile")
def update_profile(req: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    updates = {}

    if req.full_name is not None and req.full_name.strip():
        updates["full_name"] = req.full_name.strip()

    if req.role is not None and req.role.strip():
        updates["role"] = req.role.strip()

    if req.avatar_color is not None and req.avatar_color.strip():
        updates["avatar_color"] = req.avatar_color.strip()

    if req.email is not None and req.email.strip():
        new_email = req.email.strip().lower()
        if new_email != current_user.get("email"):
            existing = users_col.find_one({"email": new_email, "id": {"$ne": user_id}})
            if existing:
                raise HTTPException(status_code=400, detail="Email is already used by another account")
            updates["email"] = new_email

    # Change password if requested
    if req.new_password:
        if not req.current_password:
            raise HTTPException(status_code=400, detail="Current password is required to set a new password")
        
        stored_hash = current_user.get("password_hash", "")
        if not bcrypt.checkpw(req.current_password.encode("utf-8"), stored_hash.encode("utf-8")):
            raise HTTPException(status_code=400, detail="Current password incorrect")

        if len(req.new_password) < 4:
            raise HTTPException(status_code=400, detail="New password must be at least 4 characters")

        updates["password_hash"] = bcrypt.hashpw(req.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    if updates:
        users_col.update_one({"id": user_id}, {"$set": updates})

    fresh_user = users_col.find_one({"id": user_id})
    return {
        "message": "Profile updated successfully",
        "user": sanitize_user(fresh_user),
    }
