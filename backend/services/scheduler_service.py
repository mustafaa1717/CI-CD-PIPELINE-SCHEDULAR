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
            id=t.name,           # Use task NAME as ID so depends_on (names) match
            name=t.name,
            duration=t.duration,
            priority=t.priority,
            required_cpu=t.required_cpu,
            required_ram=t.required_ram,
            dependencies=depends_on  # Already task names
        ))
        
    sched_pipeline = SchedPipeline(id=str(db_pipeline.id), name=db_pipeline.name, tasks=sched_tasks)
    
    sched_runners = [SchedRunner(
        id=str(r.id),
        name=r.name,
        cpu_cores=r.cpu_cores,
        ram_gb=r.ram_gb
    ) for r in db_runners]
    
    try:
        algo_enum = Algorithm(algorithm)
    except ValueError:
        algo_enum = Algorithm.FCFS

    metrics = run_pipeline(sched_pipeline, sched_runners, algo_enum, speed_multiplier=1.0)
    
    if "error" in metrics:
        return {"error": metrics["error"], "message": metrics.get("message")}
    
    run_record = models.PipelineRun(
        pipeline_id=pipeline_id,
        algorithm=algorithm,
        makespan=metrics.get('makespan'),
        avg_wait_time=metrics.get('avg_wait_time'),       # fixed key
        overall_utilization=metrics.get('overall_utilization'),
        status="completed"
    )
    db.add(run_record)
    db.commit()
    db.refresh(run_record)
    
    # Save task executions from task_details
    for t_exec in metrics.get('task_details', []):       # fixed key
        task_db = db.query(models.Task).filter(
            models.Task.pipeline_id == pipeline_id,
            models.Task.name == t_exec['name']
        ).first()
        if task_db:
            runner_db = db.query(models.Runner).filter(
                models.Runner.name == t_exec.get('assigned_runner')
            ).first()
            db_exec = models.TaskExecution(
                run_id=run_record.id,
                task_id=task_db.id,
                runner_id=runner_db.id if runner_db else None,
                status=t_exec['status'],
                wait_time=t_exec.get('wait_time', 0),
                execution_time=t_exec.get('execution_time'),
                start_time=None,
                end_time=None
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
            id=t.name,           # Use task NAME as ID
            name=t.name,
            duration=t.duration,
            priority=t.priority,
            required_cpu=t.required_cpu,
            required_ram=t.required_ram,
            dependencies=depends_on
        ))
        
    sched_pipeline = SchedPipeline(id=str(db_pipeline.id), name=db_pipeline.name, tasks=sched_tasks)
    
    sched_runners = [SchedRunner(
        id=str(r.id),
        name=r.name,
        cpu_cores=r.cpu_cores,
        ram_gb=r.ram_gb
    ) for r in db_runners]

    results = run_all_algorithms(sched_pipeline, sched_runners, speed_multiplier=5.0)
    
    formatted_results = []
    for algo, metrics in results.items():
        if "error" in metrics:
            formatted_results.append({
                "algorithm": algo,
                "error": metrics.get("message", "Error"),
                "makespan": 0, "avg_wait_time": 0, "overall_utilization": 0
            })
        else:
            formatted_results.append({
                "algorithm": algo,
                "makespan": metrics.get("makespan", 0),
                "avg_wait_time": metrics.get("avg_wait_time", 0),     # fixed key
                "overall_utilization": metrics.get("overall_utilization", 0),
                "successful_tasks": metrics.get("successful_tasks", 0),
                "total_tasks": metrics.get("total_tasks", 0),
            })
        
    return formatted_results


def run_multi_simulation(pipeline_ids: list, algorithm: str, db: Session):
    """
    Run MULTIPLE pipelines simultaneously on a SHARED pool of runners.
    This is the core concept: tasks from different pipelines compete for
    the same limited runners, and the scheduler decides who gets what.
    """
    db_runners = db.query(models.Runner).all()
    if not db_runners:
        return {"error": "NO_RUNNERS", "message": "No runners configured. Add runners first."}

    all_sched_tasks = []
    pipeline_info = {}   # pid -> {name, color, tasks}

    PIPELINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

    valid_ids = []
    for i, pid in enumerate(pipeline_ids):
        db_pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pid).first()
        if not db_pipeline:
            continue
        valid_ids.append(pid)
        prefix = f"p{i}_"
        color = PIPELINE_COLORS[i % len(PIPELINE_COLORS)]
        pipeline_info[str(pid)] = {
            "name": db_pipeline.name,
            "color": color,
            "prefix": prefix,
        }

        for t in db_pipeline.tasks:
            depends_on = json.loads(t.depends_on) if t.depends_on else []
            all_sched_tasks.append(SchedTask(
                id=f"{prefix}{t.name}",
                name=t.name,              # Keep short name for display
                duration=t.duration,
                priority=t.priority,
                required_cpu=t.required_cpu,
                required_ram=t.required_ram,
                dependencies=[f"{prefix}{dep}" for dep in depends_on]
            ))

    if not all_sched_tasks:
        return None

    # Combined pipeline: all tasks from all selected pipelines share runners
    combined = SchedPipeline(
        id="multi_run",
        name="Multi-Pipeline Run",
        tasks=all_sched_tasks
    )

    SPEED_MULTIPLIER = 5.0   # tasks run 5x faster; animation scaled back on frontend

    sched_runners = [SchedRunner(
        id=str(r.id), name=r.name, cpu_cores=r.cpu_cores, ram_gb=r.ram_gb
    ) for r in db_runners]

    # Build ID→name map so runner IDs in task_details become display names
    runner_id_to_name = {str(r.id): r.name for r in db_runners}

    try:
        algo_enum = Algorithm(algorithm)
    except ValueError:
        algo_enum = Algorithm.FCFS

    metrics = run_pipeline(combined, sched_runners, algo_enum, speed_multiplier=SPEED_MULTIPLIER)

    if "error" in metrics:
        return {"error": metrics["error"], "message": metrics.get("message")}

    # Enrich task_details: map runner IDs → names, tag pipeline info
    task_details = metrics.get('task_details', [])
    for td in task_details:
        # Map runner ID ("1") → runner name ("Runner 1")
        raw_runner = td.get('assigned_runner')
        if raw_runner is not None:
            td['assigned_runner'] = runner_id_to_name.get(str(raw_runner), str(raw_runner))

        # Tag with pipeline metadata
        for pid, info in pipeline_info.items():
            if td['id'].startswith(info['prefix']):
                td['pipeline_name'] = info['name']
                td['pipeline_color'] = info['color']
                td['pipeline_id'] = int(pid)
                break

    # Save a summary run record
    run_record = models.PipelineRun(
        pipeline_id=valid_ids[0] if valid_ids else pipeline_ids[0],
        algorithm=algorithm,
        makespan=metrics.get('makespan'),
        avg_wait_time=metrics.get('avg_wait_time'),
        overall_utilization=metrics.get('overall_utilization'),
        status="completed"
    )
    db.add(run_record)
    db.commit()
    db.refresh(run_record)

    return {
        "run_id":           run_record.id,
        "metrics":          metrics,
        "pipeline_ids":     valid_ids,
        "pipeline_info":    pipeline_info,
        "total_pipelines":  len(valid_ids),
        "speed_multiplier": SPEED_MULTIPLIER,   # frontend uses this to scale replay animation
    }


def run_multi_all_simulation(pipeline_ids: list, db):
    """
    Run multiple pipelines with ALL 4 algorithms simultaneously (in parallel threads).
    Returns results keyed by algorithm name, plus a 'best' recommendation.
    """
    import concurrent.futures
    import copy as _copy

    db_runners = db.query(models.Runner).all()
    if not db_runners:
        return {"error": "NO_RUNNERS", "message": "No runners configured."}

    PIPELINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    all_sched_tasks_base = []
    pipeline_info = {}
    valid_ids = []

    for i, pid in enumerate(pipeline_ids):
        db_pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pid).first()
        if not db_pipeline:
            continue
        valid_ids.append(pid)
        prefix = f"p{i}_"
        color = PIPELINE_COLORS[i % len(PIPELINE_COLORS)]
        pipeline_info[str(pid)] = {"name": db_pipeline.name, "color": color, "prefix": prefix}
        for t in db_pipeline.tasks:
            depends_on = json.loads(t.depends_on) if t.depends_on else []
            all_sched_tasks_base.append(SchedTask(
                id=f"{prefix}{t.name}",
                name=t.name,
                duration=t.duration,
                priority=t.priority,
                required_cpu=t.required_cpu,
                required_ram=t.required_ram,
                dependencies=[f"{prefix}{dep}" for dep in depends_on]
            ))

    if not all_sched_tasks_base:
        return None

    sched_runners_base = [SchedRunner(id=str(r.id), name=r.name, cpu_cores=r.cpu_cores, ram_gb=r.ram_gb) for r in db_runners]
    runner_id_to_name = {str(r.id): r.name for r in db_runners}
    SPEED_MULTIPLIER = 5.0
    all_algos = list(Algorithm)

    def run_one(algo):
        p_copy = SchedPipeline(id="multi_run", name="Multi", tasks=_copy.deepcopy(all_sched_tasks_base))
        r_copy = _copy.deepcopy(sched_runners_base)
        metrics = run_pipeline(p_copy, r_copy, algo, speed_multiplier=SPEED_MULTIPLIER)
        if "error" in metrics:
            return algo.value, {"error": True, "message": metrics.get("message"), "makespan": 9999}
        for td in metrics.get("task_details", []):
            raw_runner = td.get("assigned_runner")
            if raw_runner is not None:
                td["assigned_runner"] = runner_id_to_name.get(str(raw_runner), str(raw_runner))
            for pid_s, info in pipeline_info.items():
                if td["id"].startswith(info["prefix"]):
                    td["pipeline_name"] = info["name"]
                    td["pipeline_color"] = info["color"]
                    td["pipeline_id"] = int(pid_s)
                    break
        return algo.value, metrics

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(run_one, algo): algo for algo in all_algos}
        for future in concurrent.futures.as_completed(futures):
            key, val = future.result()
            results[key] = val

    valid = {k: v for k, v in results.items() if not v.get("error")}
    best_algo = None
    if valid:
        best_algo = min(valid, key=lambda k: valid[k].get("makespan", float("inf")))

    if best_algo and valid_ids:
        best_metrics = valid[best_algo]
        run_record = models.PipelineRun(
            pipeline_id=valid_ids[0],
            algorithm=best_algo,
            makespan=best_metrics.get("makespan"),
            avg_wait_time=best_metrics.get("avg_wait_time"),
            overall_utilization=best_metrics.get("overall_utilization"),
            status="completed"
        )
        db.add(run_record)
        db.commit()

    return {
        "results": results,
        "best_algorithm": best_algo,
        "pipeline_info": pipeline_info,
        "pipeline_ids": valid_ids,
        "speed_multiplier": SPEED_MULTIPLIER,
    }
