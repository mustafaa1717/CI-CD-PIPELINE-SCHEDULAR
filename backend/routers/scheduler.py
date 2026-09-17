from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db
from ..services.scheduler_service import run_simulation, compare_algorithms

router = APIRouter(
    tags=["scheduler"],
)

@router.post("/run/{pipeline_id}")
def run_pipeline_endpoint(pipeline_id: int, request: schemas.RunRequest, db: Session = Depends(get_db)):
    result = run_simulation(pipeline_id, request.algorithm, db)
    if not result:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return result

@router.get("/runs", response_model=List[schemas.PipelineRun])
def list_runs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.PipelineRun).offset(skip).limit(limit).all()

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
        "makespan": run.makespan,
        "avg_wait_time": run.avg_wait_time,
        "overall_utilization": run.overall_utilization
    }

@router.get("/runs/{run_id}/status")
def get_run_status(run_id: int, db: Session = Depends(get_db)):
    run = db.query(models.PipelineRun).filter(models.PipelineRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    tasks = []
    for te in run.task_executions:
        tasks.append({
            "task_id": te.task_id,
            "runner_id": te.runner_id,
            "status": te.status
        })
        
    return {
        "run_id": run.id,
        "run_status": run.status,
        "tasks": tasks
    }

@router.post("/compare/{pipeline_id}", response_model=List[schemas.ComparisonMetrics])
def compare_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    results = compare_algorithms(pipeline_id, db)
    if not results:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return results
