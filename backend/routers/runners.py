from fastapi import APIRouter, HTTPException, Depends
from typing import List

from .. import schemas
from ..database import runners_col
from ..models import _next_id, runner_to_dict
from .auth import require_admin

router = APIRouter(prefix="/runners", tags=["runners"])


@router.post("/")
def create_runner(
    runner: schemas.RunnerCreate,
    current_admin: dict = Depends(require_admin),
):
    rid = _next_id("runners")
    doc = {
        "id": rid,
        "name": runner.name,
        "cpu_cores": runner.cpu_cores,
        "ram_gb": runner.ram_gb,
        "is_busy": False,
    }
    runners_col.insert_one(doc)
    return runner_to_dict(doc)


@router.get("/")
def read_runners(skip: int = 0, limit: int = 100):
    docs = list(runners_col.find({}, {"_id": 0}).skip(skip).limit(limit))
    return [runner_to_dict(d) for d in docs]


@router.delete("/{runner_id}")
def delete_runner(
    runner_id: int,
    current_admin: dict = Depends(require_admin),
):
    result = runners_col.delete_one({"id": runner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Runner not found")
    return {"message": "Runner deleted"}
