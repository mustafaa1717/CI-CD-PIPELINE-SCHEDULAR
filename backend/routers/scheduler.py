from fastapi import APIRouter, HTTPException, Depends
from typing import List
import datetime

from .. import schemas
from ..schemas import MultiAllRunRequest
from ..database import pipelines_col, runners_col, pipeline_runs_col
from ..models import _next_id, run_to_dict
from .auth import get_current_user, require_admin
from ..services.scheduler_service import (
    run_simulation, compare_algorithms,
    run_multi_simulation, run_multi_all_simulation,
)

router = APIRouter(tags=["scheduler"])


def is_user_admin(user: dict) -> bool:
    return bool(
        user.get("is_admin") is True
        or user.get("role") == "Admin"
        or user.get("username") == "admin_devops"
    )


def verify_pipeline_access(pipeline_ids: List[int], user: dict):
    """Enforce that normal users can only execute their own pipelines."""
    if is_user_admin(user):
        return
    foreign_pipe = pipelines_col.find_one({
        "id": {"$in": pipeline_ids},
        "user_id": {"$ne": user["id"]}
    })
    if foreign_pipe:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Pipeline '{foreign_pipe.get('name')}' belongs to another account."
        )


def normalize_algo(algorithm: str) -> str:
    mapping = {
        "FCFS": "fcfs", "fcfs": "fcfs",
        "Priority": "priority", "priority": "priority",
        "Dependency-Aware": "dependency_aware", "dependency-aware": "dependency_aware",
        "dependency_aware": "dependency_aware",
        "Resource-Aware": "resource_aware", "resource-aware": "resource_aware",
        "resource_aware": "resource_aware",
    }
    return mapping.get(algorithm, algorithm.lower().replace("-", "_"))


# IMPORTANT: /run/multi-all and /run/multi MUST be declared BEFORE /run/{pipeline_id}
# Otherwise FastAPI tries to parse "multi" as an integer pipeline_id → 422 error.

@router.post("/run/multi-all")
def run_multi_all_endpoint(
    request: MultiAllRunRequest,
    current_user: dict = Depends(get_current_user),
):
    verify_pipeline_access(request.pipeline_ids, current_user)
    result = run_multi_all_simulation(request.pipeline_ids)
    if result is None:
        raise HTTPException(status_code=404, detail="No pipelines found or no runners configured")
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result.get("message", "Simulation error"))
    return result


@router.post("/run/multi")
def run_multi_pipeline_endpoint(
    request: schemas.MultiRunRequest,
    current_user: dict = Depends(get_current_user),
):
    verify_pipeline_access(request.pipeline_ids, current_user)
    algo = normalize_algo(request.algorithm)
    result = run_multi_simulation(request.pipeline_ids, algo)
    if result is None:
        raise HTTPException(status_code=404, detail="No pipelines found or no runners configured")
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result.get("message", "Simulation error"))
    return result


@router.post("/run/{pipeline_id}")
def run_pipeline_endpoint(
    pipeline_id: int,
    request: schemas.RunRequest,
    current_user: dict = Depends(get_current_user),
):
    verify_pipeline_access([pipeline_id], current_user)
    algo = normalize_algo(request.algorithm)
    result = run_simulation(pipeline_id, algo)
    if result is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result.get("message", "Simulation error"))
    return result


@router.get("/runs")
def list_runs(skip: int = 0, limit: int = 100):
    docs = list(pipeline_runs_col.find({}, {"_id": 0}).sort("id", -1).skip(skip).limit(limit))
    return [run_to_dict(d) for d in docs]


@router.delete("/runs")
def clear_all_runs(current_admin: dict = Depends(require_admin)):
    pipeline_runs_col.delete_many({})
    return {"message": "All run history cleared", "deleted": True}


@router.get("/runs/{run_id}")
def get_run(run_id: int):
    doc = pipeline_runs_col.find_one({"id": run_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Run not found")
    return run_to_dict(doc)


@router.get("/runs/{run_id}/metrics")
def get_run_metrics(run_id: int):
    doc = pipeline_runs_col.find_one({"id": run_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "makespan":            doc.get("makespan"),
        "avg_wait_time":       doc.get("avg_wait_time"),
        "overall_utilization": doc.get("overall_utilization"),
        "status":              doc.get("status"),
    }


@router.get("/runs/{run_id}/status")
def get_run_status(run_id: int):
    doc = pipeline_runs_col.find_one({"id": run_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "run_id":     doc.get("id"),
        "run_status": doc.get("status"),
        "makespan":   doc.get("makespan"),
        "tasks":      doc.get("task_executions", []),
    }


@router.post("/compare/{pipeline_id}")
def compare_pipeline(
    pipeline_id: int,
    current_user: dict = Depends(get_current_user),
):
    verify_pipeline_access([pipeline_id], current_user)
    results = compare_algorithms(pipeline_id)
    if results is None:
        raise HTTPException(status_code=404, detail="Pipeline not found or no runners available")
    return results
