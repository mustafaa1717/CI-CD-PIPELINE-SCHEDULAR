from fastapi import APIRouter, HTTPException
from typing import List
import datetime

from .. import schemas
from ..database import pipelines_col
from ..models import _next_id, pipeline_to_dict

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


@router.post("/")
def create_pipeline(pipeline: schemas.PipelineCreate):
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
        "created_at": now,
        "status": "idle",
        "tasks": tasks,
    }
    pipelines_col.insert_one(doc)
    return pipeline_to_dict(doc)


@router.get("/")
def read_pipelines(skip: int = 0, limit: int = 100):
    docs = list(pipelines_col.find({}, {"_id": 0}).skip(skip).limit(limit))
    return [pipeline_to_dict(d) for d in docs]


@router.get("/{pipeline_id}")
def read_pipeline(pipeline_id: int):
    doc = pipelines_col.find_one({"id": pipeline_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline_to_dict(doc)


@router.delete("/{pipeline_id}")
def delete_pipeline(pipeline_id: int):
    result = pipelines_col.delete_one({"id": pipeline_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {"message": "Pipeline deleted"}


@router.post("/{pipeline_id}/tasks")
def add_task(pipeline_id: int, task: schemas.TaskCreate):
    pipeline = pipelines_col.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

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
def get_tasks(pipeline_id: int):
    doc = pipelines_col.find_one({"id": pipeline_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return doc.get("tasks", [])
