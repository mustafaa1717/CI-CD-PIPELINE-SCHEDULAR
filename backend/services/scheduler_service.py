import json
import sys
import os
import datetime

# Add parent directory so scheduler package is importable
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from scheduler.models import Task as SchedTask, Pipeline as SchedPipeline, Runner as SchedRunner
from scheduler.simulator import run_pipeline, run_all_algorithms
from scheduler.algorithms import Algorithm

from ..database import pipelines_col, runners_col, pipeline_runs_col
from ..models import _next_id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_pipeline(pipeline_id: int):
    return pipelines_col.find_one({"id": pipeline_id}, {"_id": 0})


def _get_all_runners():
    return list(runners_col.find({}, {"_id": 0}))


def _build_sched_tasks(db_tasks, prefix=""):
    tasks = []
    for t in db_tasks:
        depends_on = t.get("depends_on", [])
        if isinstance(depends_on, str):
            try:
                depends_on = json.loads(depends_on)
            except Exception:
                depends_on = []
        tasks.append(SchedTask(
            id=f"{prefix}{t['name']}",
            name=t["name"],
            duration=t["duration"],
            priority=t["priority"],
            required_cpu=t["required_cpu"],
            required_ram=t["required_ram"],
            dependencies=[f"{prefix}{dep}" for dep in depends_on],
        ))
    return tasks


def _build_sched_runners(db_runners):
    return [SchedRunner(
        id=str(r["id"]),
        name=r["name"],
        cpu_cores=r["cpu_cores"],
        ram_gb=r["ram_gb"],
    ) for r in db_runners]


def _save_run(pipeline_id: int, algorithm: str, metrics: dict) -> int:
    run_id = _next_id("pipeline_runs")
    doc = {
        "id": run_id,
        "pipeline_id": pipeline_id,
        "algorithm": algorithm,
        "start_time": datetime.datetime.utcnow(),
        "end_time": datetime.datetime.utcnow(),
        "makespan": metrics.get("makespan"),
        "avg_wait_time": metrics.get("avg_wait_time"),
        "overall_utilization": metrics.get("overall_utilization"),
        "status": "completed",
        "task_executions": [],
    }
    pipeline_runs_col.insert_one(doc)
    return run_id


# ---------------------------------------------------------------------------
# Single pipeline run
# ---------------------------------------------------------------------------

def run_simulation(pipeline_id: int, algorithm: str):
    db_pipeline = _get_pipeline(pipeline_id)
    if not db_pipeline:
        return None

    db_runners = _get_all_runners()
    sched_tasks    = _build_sched_tasks(db_pipeline.get("tasks", []))
    sched_pipeline = SchedPipeline(id=str(pipeline_id), name=db_pipeline["name"], tasks=sched_tasks)
    sched_runners  = _build_sched_runners(db_runners)

    try:
        algo_enum = Algorithm(algorithm)
    except ValueError:
        algo_enum = Algorithm.FCFS

    metrics = run_pipeline(sched_pipeline, sched_runners, algo_enum, speed_multiplier=1.0)

    if "error" in metrics:
        return {"error": metrics["error"], "message": metrics.get("message")}

    run_id = _save_run(pipeline_id, algorithm, metrics)

    return {"run_id": run_id, "metrics": metrics}


# ---------------------------------------------------------------------------
# Compare all 4 algorithms on a single pipeline
# ---------------------------------------------------------------------------

def compare_algorithms(pipeline_id: int):
    db_pipeline = _get_pipeline(pipeline_id)
    if not db_pipeline:
        return None

    db_runners     = _get_all_runners()
    sched_tasks    = _build_sched_tasks(db_pipeline.get("tasks", []))
    sched_pipeline = SchedPipeline(id=str(pipeline_id), name=db_pipeline["name"], tasks=sched_tasks)
    sched_runners  = _build_sched_runners(db_runners)

    results = run_all_algorithms(sched_pipeline, sched_runners, speed_multiplier=5.0)

    formatted = []
    for algo, m in results.items():
        if "error" in m:
            formatted.append({
                "algorithm": algo, "error": m.get("message", "Error"),
                "makespan": 0, "avg_wait_time": 0, "overall_utilization": 0,
            })
        else:
            formatted.append({
                "algorithm": algo,
                "makespan": m.get("makespan", 0),
                "avg_wait_time": m.get("avg_wait_time", 0),
                "overall_utilization": m.get("overall_utilization", 0),
                "successful_tasks": m.get("successful_tasks", 0),
                "total_tasks": m.get("total_tasks", 0),
            })
    return formatted


# ---------------------------------------------------------------------------
# Multi-pipeline run (single algorithm, shared runners)
# ---------------------------------------------------------------------------

def run_multi_simulation(pipeline_ids: list, algorithm: str):
    db_runners = _get_all_runners()
    if not db_runners:
        return {"error": "NO_RUNNERS", "message": "No runners configured. Add runners first."}

    PIPELINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    all_sched_tasks = []
    pipeline_info   = {}
    valid_ids       = []

    for i, pid in enumerate(pipeline_ids):
        db_pipeline = _get_pipeline(pid)
        if not db_pipeline:
            continue
        valid_ids.append(pid)
        prefix = f"p{i}_"
        color  = PIPELINE_COLORS[i % len(PIPELINE_COLORS)]
        pipeline_info[str(pid)] = {"name": db_pipeline["name"], "color": color, "prefix": prefix}
        all_sched_tasks.extend(_build_sched_tasks(db_pipeline.get("tasks", []), prefix=prefix))

    if not all_sched_tasks:
        return None

    combined      = SchedPipeline(id="multi_run", name="Multi-Pipeline Run", tasks=all_sched_tasks)
    sched_runners = _build_sched_runners(db_runners)
    runner_id_to_name = {str(r["id"]): r["name"] for r in db_runners}
    SPEED_MULTIPLIER  = 5.0

    try:
        algo_enum = Algorithm(algorithm)
    except ValueError:
        algo_enum = Algorithm.FCFS

    metrics = run_pipeline(combined, sched_runners, algo_enum, speed_multiplier=SPEED_MULTIPLIER)
    if "error" in metrics:
        return {"error": metrics["error"], "message": metrics.get("message")}

    for td in metrics.get("task_details", []):
        raw = td.get("assigned_runner")
        if raw is not None:
            td["assigned_runner"] = runner_id_to_name.get(str(raw), str(raw))
        for pid_s, info in pipeline_info.items():
            if td["id"].startswith(info["prefix"]):
                td["pipeline_name"]  = info["name"]
                td["pipeline_color"] = info["color"]
                td["pipeline_id"]    = int(pid_s)
                break

    run_id = _save_run(valid_ids[0] if valid_ids else pipeline_ids[0], algorithm, metrics)

    return {
        "run_id": run_id,
        "metrics": metrics,
        "pipeline_ids": valid_ids,
        "pipeline_info": pipeline_info,
        "total_pipelines": len(valid_ids),
        "speed_multiplier": SPEED_MULTIPLIER,
    }


# ---------------------------------------------------------------------------
# Multi-pipeline run with ALL 4 algorithms simultaneously
# ---------------------------------------------------------------------------

def run_multi_all_simulation(pipeline_ids: list):
    import concurrent.futures
    import copy as _copy

    db_runners = _get_all_runners()
    if not db_runners:
        return {"error": "NO_RUNNERS", "message": "No runners configured."}

    PIPELINE_COLORS    = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    all_sched_tasks_base = []
    pipeline_info      = {}
    valid_ids          = []

    for i, pid in enumerate(pipeline_ids):
        db_pipeline = _get_pipeline(pid)
        if not db_pipeline:
            continue
        valid_ids.append(pid)
        prefix = f"p{i}_"
        color  = PIPELINE_COLORS[i % len(PIPELINE_COLORS)]
        pipeline_info[str(pid)] = {"name": db_pipeline["name"], "color": color, "prefix": prefix}
        all_sched_tasks_base.extend(_build_sched_tasks(db_pipeline.get("tasks", []), prefix=prefix))

    if not all_sched_tasks_base:
        return None

    sched_runners_base = _build_sched_runners(db_runners)
    runner_id_to_name  = {str(r["id"]): r["name"] for r in db_runners}
    SPEED_MULTIPLIER   = 5.0
    all_algos          = list(Algorithm)

    def run_one(algo):
        p_copy = SchedPipeline(id="multi_run", name="Multi", tasks=_copy.deepcopy(all_sched_tasks_base))
        r_copy = _copy.deepcopy(sched_runners_base)
        m = run_pipeline(p_copy, r_copy, algo, speed_multiplier=SPEED_MULTIPLIER)
        if "error" in m:
            return algo.value, {"error": True, "message": m.get("message"), "makespan": 9999}
        for td in m.get("task_details", []):
            raw = td.get("assigned_runner")
            if raw is not None:
                td["assigned_runner"] = runner_id_to_name.get(str(raw), str(raw))
            for pid_s, info in pipeline_info.items():
                if td["id"].startswith(info["prefix"]):
                    td["pipeline_name"]  = info["name"]
                    td["pipeline_color"] = info["color"]
                    td["pipeline_id"]    = int(pid_s)
                    break
        return algo.value, m

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(run_one, algo): algo for algo in all_algos}
        for future in concurrent.futures.as_completed(futures):
            key, val = future.result()
            results[key] = val

    # Pick best by minimum makespan
    valid     = {k: v for k, v in results.items() if not v.get("error")}
    if not valid:
        first_err = next((v.get("message") for v in results.values() if v.get("message")), "Simulation failed: Cycle or runner error detected")
        return {"error": "SIMULATION_FAILED", "message": first_err}

    best_algo = min(valid, key=lambda k: valid[k].get("makespan", float("inf")))

    # Save best run record to MongoDB
    if best_algo and valid_ids:
        best_metrics = valid[best_algo]
        _save_run(valid_ids[0], best_algo, best_metrics)

    return {
        "results":          results,
        "best_algorithm":   best_algo,
        "pipeline_info":    pipeline_info,
        "pipeline_ids":     valid_ids,
        "speed_multiplier": SPEED_MULTIPLIER,
    }
