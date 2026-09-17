from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime
import json

class TaskBase(BaseModel):
    name: str
    duration: float
    priority: int
    required_cpu: float
    required_ram: float
    depends_on: List[int] = []

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    pipeline_id: int
    status: str
    
    class Config:
        orm_mode = True
        
class PipelineBase(BaseModel):
    name: str

class PipelineCreate(PipelineBase):
    tasks: List[TaskCreate] = []

class Pipeline(PipelineBase):
    id: int
    created_at: datetime
    status: str
    tasks: List[Task] = []

    class Config:
        orm_mode = True

class RunnerBase(BaseModel):
    name: str
    cpu_cores: float
    ram_gb: float

class RunnerCreate(RunnerBase):
    pass

class Runner(RunnerBase):
    id: int
    is_busy: bool

    class Config:
        orm_mode = True

class RunRequest(BaseModel):
    algorithm: str

class TaskExecutionBase(BaseModel):
    task_id: int
    runner_id: Optional[int]
    status: str
    wait_time: float
    execution_time: Optional[float]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    
class TaskExecution(TaskExecutionBase):
    id: int
    run_id: int
    
    class Config:
        orm_mode = True

class PipelineRunBase(BaseModel):
    pipeline_id: int
    algorithm: str
    
class PipelineRun(PipelineRunBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    makespan: Optional[float]
    avg_wait_time: Optional[float]
    overall_utilization: Optional[float]
    status: str
    task_executions: List[TaskExecution] = []
    
    class Config:
        orm_mode = True

class ComparisonMetrics(BaseModel):
    algorithm: str
    makespan: float
    avg_wait_time: float
    overall_utilization: float
