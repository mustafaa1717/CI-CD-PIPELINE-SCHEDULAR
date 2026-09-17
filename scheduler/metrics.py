"""
metrics.py — Collect and return scheduling performance metrics
CI/CD Pipeline Scheduler — Team 18
"""

from typing import List, Dict, Any
from .models import Pipeline, Runner, TaskStatus


def collect_metrics(
    pipeline: Pipeline,
    runners: List[Runner],
    start_time: float,
    end_time: float,
    runner_busy_times: Dict[str, float],   # runner_id -> total seconds busy
) -> Dict[str, Any]:
    """
    Compute performance metrics after a pipeline simulation run.

    Returns a dict with:
        - makespan:             Total pipeline execution time (seconds)
        - avg_wait_time:        Average wait time across all tasks (seconds)
        - runner_utilization:   Per-runner and overall utilization %
        - total_tasks:          Total number of tasks
        - successful_tasks:     Tasks that completed successfully
        - failed_tasks:         Tasks that failed
        - task_details:         Per-task breakdown
    """
    makespan = round(end_time - start_time, 3) if end_time > start_time else 0.0

    # ── Task-level stats ──────────────────────────────────────────────────
    successful = [t for t in pipeline.tasks if t.status == TaskStatus.SUCCESS]
    failed     = [t for t in pipeline.tasks if t.status == TaskStatus.FAILED]

    wait_times = [t.wait_time for t in pipeline.tasks if t.wait_time is not None]
    avg_wait   = round(sum(wait_times) / len(wait_times), 3) if wait_times else 0.0

    task_details = []
    for task in pipeline.tasks:
        execution_time = None
        if task.start_time is not None and task.end_time is not None:
            execution_time = round(task.end_time - task.start_time, 3)

        task_details.append({
            "id":             task.id,
            "name":           task.name,
            "status":         task.status.value,
            "wait_time":      round(task.wait_time, 3),
            "execution_time": execution_time,
            "assigned_runner": task.assigned_runner,
            "start_time":     task.start_time,
            "end_time":       task.end_time,
        })

    # ── Runner utilization ────────────────────────────────────────────────
    runner_stats = []
    total_busy   = 0.0

    for runner in runners:
        busy_time   = runner_busy_times.get(runner.id, 0.0)
        total_busy += busy_time
        utilization = round((busy_time / makespan * 100), 2) if makespan > 0 else 0.0

        runner_stats.append({
            "id":          runner.id,
            "name":        runner.name,
            "busy_time":   round(busy_time, 3),
            "utilization": utilization,
        })

    # Overall utilization = total busy time across all runners / (makespan × num_runners)
    num_runners = len(runners)
    overall_utilization = (
        round(total_busy / (makespan * num_runners) * 100, 2)
        if makespan > 0 and num_runners > 0
        else 0.0
    )

    return {
        "makespan":             makespan,
        "avg_wait_time":        avg_wait,
        "overall_utilization":  overall_utilization,
        "total_tasks":          len(pipeline.tasks),
        "successful_tasks":     len(successful),
        "failed_tasks":         len(failed),
        "runner_stats":         runner_stats,
        "task_details":         task_details,
    }
