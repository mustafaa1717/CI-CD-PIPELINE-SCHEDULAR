"""
Admin Management Router
CI/CD Pipeline Scheduler
Provides administrative overview, user management, cluster telemetry, and global pipeline controls.
Requires administrative privileges (require_admin).
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import datetime

from ..database import users_col, pipelines_col, runners_col, pipeline_runs_col
from .auth import require_admin, sanitize_user
from ..models import pipeline_to_dict

router = APIRouter(prefix="/admin", tags=["admin"])


class UpdateUserRoleRequest(BaseModel):
    role: str
    is_admin: Optional[bool] = False


@router.get("/stats")
def get_admin_stats(current_admin: dict = Depends(require_admin)):
    total_users = users_col.count_documents({})
    total_pipelines = pipelines_col.count_documents({})
    total_runs = pipeline_runs_col.count_documents({})
    
    runners = list(runners_col.find({}))
    total_runners = len(runners)
    total_cpu = sum(r.get("cpu_cores", 0) for r in runners)
    total_ram = sum(r.get("ram_gb", 0) for r in runners)
    busy_runners = sum(1 for r in runners if r.get("is_busy"))

    return {
        "total_users": total_users,
        "total_pipelines": total_pipelines,
        "total_runs": total_runs,
        "total_runners": total_runners,
        "total_cpu_cores": total_cpu,
        "total_ram_gb": total_ram,
        "busy_runners": busy_runners,
    }


@router.get("/users")
def get_all_users(current_admin: dict = Depends(require_admin)):
    users = list(users_col.find({}, {"password_hash": 0}).sort("id", 1))
    enriched = []
    for u in users:
        uid = u.get("id")
        pipe_count = pipelines_col.count_documents({"user_id": uid})
        sanitized = sanitize_user(u)
        sanitized["pipeline_count"] = pipe_count
        enriched.append(sanitized)
    return enriched


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    req: UpdateUserRoleRequest,
    current_admin: dict = Depends(require_admin),
):
    target = users_col.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting the primary admin_devops account
    if target.get("username") == "admin_devops" and not req.is_admin:
        raise HTTPException(status_code=400, detail="Cannot revoke admin rights from primary admin account")

    users_col.update_one(
        {"id": user_id},
        {"$set": {"role": req.role.strip(), "is_admin": bool(req.is_admin)}}
    )
    updated = users_col.find_one({"id": user_id}, {"password_hash": 0})
    return {
        "message": f"Updated user @{updated['username']} role to {req.role}",
        "user": sanitize_user(updated)
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_admin: dict = Depends(require_admin),
):
    if user_id == current_admin.get("id"):
        raise HTTPException(status_code=400, detail="Admins cannot delete their own active account")

    target = users_col.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.get("username") == "admin_devops":
        raise HTTPException(status_code=400, detail="Cannot delete root system administrator")

    # Delete user's pipelines or reassign
    pipelines_col.delete_many({"user_id": user_id})
    users_col.delete_one({"id": user_id})

    return {"message": f"User @{target.get('username')} and associated pipelines deleted successfully"}


@router.get("/pipelines")
def get_all_pipelines_admin(current_admin: dict = Depends(require_admin)):
    docs = list(pipelines_col.find({}, {"_id": 0}).sort("id", -1))
    return [pipeline_to_dict(d) for d in docs]


@router.delete("/pipelines/{pipeline_id}")
def delete_pipeline_admin(pipeline_id: int, current_admin: dict = Depends(require_admin)):
    target = pipelines_col.find_one({"id": pipeline_id})
    if not target:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    pipelines_col.delete_one({"id": pipeline_id})
    return {"message": f"Admin removed pipeline #{pipeline_id} ('{target.get('name')}')"}
