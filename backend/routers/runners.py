from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/runners",
    tags=["runners"],
)

@router.post("/", response_model=schemas.Runner)
def create_runner(runner: schemas.RunnerCreate, db: Session = Depends(get_db)):
    db_runner = models.Runner(
        name=runner.name,
        cpu_cores=runner.cpu_cores,
        ram_gb=runner.ram_gb
    )
    db.add(db_runner)
    db.commit()
    db.refresh(db_runner)
    return db_runner

@router.get("/", response_model=List[schemas.Runner])
def read_runners(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Runner).offset(skip).limit(limit).all()

@router.delete("/{runner_id}")
def delete_runner(runner_id: int, db: Session = Depends(get_db)):
    runner = db.query(models.Runner).filter(models.Runner.id == runner_id).first()
    if not runner:
        raise HTTPException(status_code=404, detail="Runner not found")
    db.delete(runner)
    db.commit()
    return {"message": "Runner deleted"}
