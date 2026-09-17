from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db
from ..services.scheduler_service import run_simulation, compare_algorithms

router = APIRouter(tags=["scheduler"])

# Normalize algorithm string to snake_case enum value
def normalize_algo(algorithm: str) -> str:
    mapping = {
        "FCFS": "fcfs",
        "Priority": "priority",
        "priority": "priority",
        "Dependency-Aware": "dependency_aware",
        "dependency-aware": "dependency_aware",
        "Resource-Aware": "resource_aware",
        "resource-aware": "resource_aware",
    }
    return mapping.get(algorithm, algorithm.lower().replace("-", "_"))


@router.post("/run/{pipeline_id}")
def run_pipeline_endpoint(pipeline_id: int, request: schemas.RunRequest, db: Session = Depends(get_db)):
    algo = normalize_algo(request.algorithm)
    result = run_simulation(pipeline_id, algo, db)

    if result is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    # Cycle or other simulation error
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result.get("message", "Simulation error"))

    return result


@router.get("/runs", response_model=List[schemas.PipelineRun])
def list_runs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.PipelineRun).order_by(
        models.PipelineRun.id.desc()
    ).offset(skip).limit(limit).all()


@router.get("/runs/{run_id}", response_model=schemas.PipelineRun)
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(models.PipelineRun).filter(models.PipelineRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/runs/{run_id}/metrics")
def get_run_metrics(run_id: int, db: Session = Depends(get_db)):
    run = db.query(models.PipelineRun).filter(models.PipelineRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "makespan":            run.makespan,
        "avg_wait_time":       run.avg_wait_time,
        "overall_utilization": run.overall_utilization,
        "status":              run.status,
    }


@router.get("/runs/{run_id}/status")
def get_run_status(run_id: int, db: Session = Depends(get_db)):
    run = db.query(models.PipelineRun).filter(models.PipelineRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    tasks = []
    for te in run.task_executions:
        # Resolve task name from DB
        task_obj = db.query(models.Task).filter(models.Task.id == te.task_id).first()
        runner_obj = db.query(models.Runner).filter(models.Runner.id == te.runner_id).first() if te.runner_id else None
        tasks.append({
            "task_id":     te.task_id,
            "task_name":   task_obj.name if task_obj else str(te.task_id),
            "runner_id":   te.runner_id,
            "runner_name": runner_obj.name if runner_obj else None,
            "status":      te.status,
            "wait_time":   te.wait_time,
            "execution_time": te.execution_time,
        })

    return {
        "run_id":     run.id,
        "run_status": run.status,
        "makespan":   run.makespan,
        "tasks":      tasks,
    }


@router.post("/compare/{pipeline_id}", response_model=List[schemas.ComparisonMetrics])
def compare_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    results = compare_algorithms(pipeline_id, db)
    if results is None:
        raise HTTPException(status_code=404, detail="Pipeline not found or no runners available")
    return results
