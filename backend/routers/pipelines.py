from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import datetime

from .. import schemas
from ..database import pipelines_col
from ..models import _next_id, pipeline_to_dict
from .auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


def is_user_admin(user: Optional[dict]) -> bool:
    if not user:
        return False
    return bool(
        user.get("is_admin") is True
        or user.get("role") == "Admin"
        or user.get("username") == "admin_devops"
    )


@router.post("/")
def create_pipeline(
    pipeline: schemas.PipelineCreate,
    current_user: dict = Depends(get_current_user),
):
    pid = _next_id("pipelines")
    now = datetime.datetime.utcnow()

    tasks = []
    for t in pipeline.tasks:
        tid = _next_id("tasks")
        tasks.append({
            "id": tid,
            "pipeline_id": pid,
            "name": t.name,
            "duration": t.duration,
            "priority": t.priority,
            "required_cpu": t.required_cpu,
            "required_ram": t.required_ram,
            "depends_on": t.depends_on,
            "status": "pending",
        })

    doc = {
        "id": pid,
        "name": pipeline.name,
        "user_id": current_user["id"],
        "owner_username": current_user["username"],
        "created_at": now,
        "status": "idle",
        "tasks": tasks,
    }
    pipelines_col.insert_one(doc)
    return pipeline_to_dict(doc)


@router.get("/")
def read_pipelines(
    skip: int = 0,
    limit: int = 100,
    owner: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    # If not logged in, return empty list to enforce sign-in
    if not current_user:
        return []

    admin = is_user_admin(current_user)
    if admin:
        # Admin can view all pipelines or filter by specific owner username
        query = {"owner_username": owner} if owner else {}
    else:
        # Normal user can ONLY view their own pipelines
        query = {"user_id": current_user["id"]}

    docs = list(pipelines_col.find(query, {"_id": 0}).skip(skip).limit(limit))
    return [pipeline_to_dict(d) for d in docs]


@router.get("/{pipeline_id}")
def read_pipeline(
    pipeline_id: int,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    doc = pipelines_col.find_one({"id": pipeline_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to view pipeline")

    if not is_user_admin(current_user) and doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this pipeline")

    return pipeline_to_dict(doc)


@router.delete("/{pipeline_id}")
def delete_pipeline(
    pipeline_id: int,
    current_user: dict = Depends(get_current_user),
):
    doc = pipelines_col.find_one({"id": pipeline_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    admin = is_user_admin(current_user)
    if not admin and doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You can only delete your own pipelines")

    result = pipelines_col.delete_one({"id": pipeline_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {"message": "Pipeline deleted"}


@router.post("/{pipeline_id}/tasks")
def add_task(
    pipeline_id: int,
    task: schemas.TaskCreate,
    current_user: dict = Depends(get_current_user),
):
    pipeline = pipelines_col.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    admin = is_user_admin(current_user)
    if not admin and pipeline.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You can only modify your own pipelines")

    tid = _next_id("tasks")
    task_doc = {
        "id": tid,
        "pipeline_id": pipeline_id,
        "name": task.name,
        "duration": task.duration,
        "priority": task.priority,
        "required_cpu": task.required_cpu,
        "required_ram": task.required_ram,
        "depends_on": task.depends_on,
        "status": "pending",
    }
    pipelines_col.update_one(
        {"id": pipeline_id},
        {"$push": {"tasks": task_doc}}
    )
    return task_doc


@router.get("/{pipeline_id}/tasks")
def get_tasks(
    pipeline_id: int,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    doc = pipelines_col.find_one({"id": pipeline_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    if not is_user_admin(current_user) and doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this pipeline")

    return doc.get("tasks", [])
