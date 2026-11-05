from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TaskBase(BaseModel):
    name: str
    duration: float
    priority: int
    required_cpu: float
    required_ram: float
    depends_on: List[str] = []


class TaskCreate(TaskBase):
    pass


class Task(TaskBase):
    id: int
    pipeline_id: int
    status: str = "pending"

    class Config:
        from_attributes = True


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
        from_attributes = True


class RunnerBase(BaseModel):
    name: str
    cpu_cores: float
    ram_gb: float


class RunnerCreate(RunnerBase):
    pass


class Runner(RunnerBase):
    id: int
    is_busy: bool = False

    class Config:
        from_attributes = True


class RunRequest(BaseModel):
    algorithm: str


class MultiRunRequest(BaseModel):
    pipeline_ids: List[int]
    algorithm: str


class MultiAllRunRequest(BaseModel):
    pipeline_ids: List[int]


class TaskExecutionBase(BaseModel):
    task_id: int
    runner_id: Optional[int] = None
    status: str
    wait_time: float
    execution_time: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class TaskExecution(TaskExecutionBase):
    id: int
    run_id: int

    class Config:
        from_attributes = True


class PipelineRunBase(BaseModel):
    pipeline_id: int
    algorithm: str


class PipelineRun(PipelineRunBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    makespan: Optional[float] = None
    avg_wait_time: Optional[float] = None
    overall_utilization: Optional[float] = None
    status: str
    task_executions: List[TaskExecution] = []

    class Config:
        from_attributes = True


class ComparisonMetrics(BaseModel):
    algorithm: str
    makespan: float
    avg_wait_time: float
    overall_utilization: float
    successful_tasks: Optional[int] = None
    total_tasks: Optional[int] = None
    error: Optional[str] = None
