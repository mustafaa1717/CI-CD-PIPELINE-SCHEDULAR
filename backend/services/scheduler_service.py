import json
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import SessionLocal
import sys
import os

# Add parent directory to path so we can import scheduler
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scheduler.models import Task as SchedTask, Pipeline as SchedPipeline, Runner as SchedRunner
from scheduler.simulator import run_pipeline, run_all_algorithms
from scheduler.algorithms import Algorithm

def run_simulation(pipeline_id: int, algorithm: str, db: Session):
    db_pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        return None

    db_runners = db.query(models.Runner).all()
    
    sched_tasks = []
    for t in db_pipeline.tasks:
        depends_on = json.loads(t.depends_on) if t.depends_on else []
        sched_tasks.append(SchedTask(
            id=str(t.id),
            name=t.name,
            duration=t.duration,
            priority=t.priority,
            required_cpu=t.required_cpu,
            required_ram=t.required_ram,
            depends_on=[str(dep) for dep in depends_on]
        ))
        
    sched_pipeline = SchedPipeline(id=str(db_pipeline.id), name=db_pipeline.name, tasks=sched_tasks)
    
    sched_runners = [SchedRunner(
        id=str(r.id),
        name=r.name,
        cpu_cores=r.cpu_cores,
        ram_gb=r.ram_gb
    ) for r in db_runners]
    
    # Convert string algorithm to enum
    try:
        algo_enum = Algorithm(algorithm)
    except ValueError:
        algo_enum = Algorithm.fcfs

    metrics = run_pipeline(sched_pipeline, sched_runners, algo_enum, speed_multiplier=1.0)
    
    # Save results to DB
    run_record = models.PipelineRun(
        pipeline_id=pipeline_id,
        algorithm=algorithm,
        makespan=metrics.get('makespan'),
        avg_wait_time=metrics.get('average_wait_time'),
        overall_utilization=metrics.get('overall_utilization'),
        status="completed"
    )
    db.add(run_record)
    db.commit()
    db.refresh(run_record)
    
    # Save task executions
    for t_exec in metrics.get('task_executions', []):
        db_exec = models.TaskExecution(
            run_id=run_record.id,
            task_id=int(t_exec['task_id']),
            runner_id=int(t_exec['runner_id']) if t_exec['runner_id'] else None,
            status=t_exec['status'],
            wait_time=t_exec['wait_time'],
            execution_time=t_exec['execution_time'],
            start_time=t_exec.get('start_time'),
            end_time=t_exec.get('end_time')
        )
        db.add(db_exec)
    
    db.commit()
    
    return {
        "run_id": run_record.id,
        "metrics": metrics
    }

def compare_algorithms(pipeline_id: int, db: Session):
    db_pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not db_pipeline:
        return None

    db_runners = db.query(models.Runner).all()
    
    sched_tasks = []
    for t in db_pipeline.tasks:
        depends_on = json.loads(t.depends_on) if t.depends_on else []
        sched_tasks.append(SchedTask(
            id=str(t.id),
            name=t.name,
            duration=t.duration,
            priority=t.priority,
            required_cpu=t.required_cpu,
            required_ram=t.required_ram,
            depends_on=[str(dep) for dep in depends_on]
        ))
        
    sched_pipeline = SchedPipeline(id=str(db_pipeline.id), name=db_pipeline.name, tasks=sched_tasks)
    
    sched_runners = [SchedRunner(
        id=str(r.id),
        name=r.name,
        cpu_cores=r.cpu_cores,
        ram_gb=r.ram_gb
    ) for r in db_runners]

    results = run_all_algorithms(sched_pipeline, sched_runners, speed_multiplier=1.0)
    
    # Do we save to DB? The prompt says "returns side-by-side metrics", saving is optional but let's just return
    formatted_results = []
    for algo, metrics in results.items():
        formatted_results.append({
            "algorithm": algo,
            "makespan": metrics.get("makespan", 0),
            "avg_wait_time": metrics.get("average_wait_time", 0),
            "overall_utilization": metrics.get("overall_utilization", 0)
        })
        
    return formatted_results
