from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/pipelines",
    tags=["pipelines"],
)

@router.post("/", response_model=schemas.Pipeline)
def create_pipeline(pipeline: schemas.PipelineCreate, db: Session = Depends(get_db)):
    db_pipeline = models.Pipeline(name=pipeline.name)
    db.add(db_pipeline)
    db.commit()
    db.refresh(db_pipeline)
    
    for task in pipeline.tasks:
        db_task = models.Task(
            pipeline_id=db_pipeline.id,
            name=task.name,
            duration=task.duration,
            priority=task.priority,
            required_cpu=task.required_cpu,
            required_ram=task.required_ram,
            depends_on=json.dumps(task.depends_on)
        )
        db.add(db_task)
    db.commit()
    db.refresh(db_pipeline)
    return db_pipeline

@router.get("/", response_model=List[schemas.Pipeline])
def read_pipelines(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    pipelines = db.query(models.Pipeline).offset(skip).limit(limit).all()
    # Process tasks depends_on JSON
    for pipeline in pipelines:
        for task in pipeline.tasks:
            try:
                task.depends_on = json.loads(task.depends_on)
            except:
                task.depends_on = []
    return pipelines

@router.get("/{pipeline_id}", response_model=schemas.Pipeline)
def read_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    for task in pipeline.tasks:
        try:
            task.depends_on = json.loads(task.depends_on)
        except:
            task.depends_on = []
    return pipeline

@router.delete("/{pipeline_id}")
def delete_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # Delete associated tasks and runs
    db.query(models.Task).filter(models.Task.pipeline_id == pipeline_id).delete()
    db.query(models.PipelineRun).filter(models.PipelineRun.pipeline_id == pipeline_id).delete()
    db.delete(pipeline)
    db.commit()
    return {"message": "Pipeline deleted"}

@router.post("/{pipeline_id}/tasks", response_model=schemas.Task)
def add_task(pipeline_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
        
    db_task = models.Task(
        pipeline_id=pipeline_id,
        name=task.name,
        duration=task.duration,
        priority=task.priority,
        required_cpu=task.required_cpu,
        required_ram=task.required_ram,
        depends_on=json.dumps(task.depends_on)
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    db_task.depends_on = json.loads(db_task.depends_on)
    return db_task

@router.get("/{pipeline_id}/tasks", response_model=List[schemas.Task])
def get_tasks(pipeline_id: int, db: Session = Depends(get_db)):
    tasks = db.query(models.Task).filter(models.Task.pipeline_id == pipeline_id).all()
    for task in tasks:
        try:
            task.depends_on = json.loads(task.depends_on)
        except:
            task.depends_on = []
    return tasks
