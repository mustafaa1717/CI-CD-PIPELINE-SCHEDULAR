from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
import datetime
import json

from .database import Base

class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="idle")

    tasks = relationship("Task", back_populates="pipeline")
    runs = relationship("PipelineRun", back_populates="pipeline")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"))
    name = Column(String, index=True)
    duration = Column(Float)
    priority = Column(Integer)
    required_cpu = Column(Float)
    required_ram = Column(Float)
    status = Column(String, default="pending")
    depends_on = Column(String, default="[]") # JSON string of list

    pipeline = relationship("Pipeline", back_populates="tasks")

class Runner(Base):
    __tablename__ = "runners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    cpu_cores = Column(Float)
    ram_gb = Column(Float)
    is_busy = Column(Boolean, default=False)

class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"))
    algorithm = Column(String)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    makespan = Column(Float, nullable=True)
    avg_wait_time = Column(Float, nullable=True)
    overall_utilization = Column(Float, nullable=True)
    status = Column(String, default="running")

    pipeline = relationship("Pipeline", back_populates="runs")
    task_executions = relationship("TaskExecution", back_populates="run")

class TaskExecution(Base):
    __tablename__ = "task_executions"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("pipeline_runs.id"))
    task_id = Column(Integer, ForeignKey("tasks.id"))
    runner_id = Column(Integer, ForeignKey("runners.id"), nullable=True)
    status = Column(String)
    wait_time = Column(Float)
    execution_time = Column(Float, nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)

    run = relationship("PipelineRun", back_populates="task_executions")
