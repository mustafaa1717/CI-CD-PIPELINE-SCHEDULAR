"""
simulator.py — Pipeline Simulation Engine
CI/CD Pipeline Scheduler — Team 18

Simulates pipeline execution:
- Tasks run virtually (no real build/test/deploy happens)
- Execution time = task.duration (sleep or timestamp-tracked)
- Success/failure determined by task.success_rate
- Multiple runners execute tasks concurrently using threads
"""

import time
import random
import threading
import copy
from typing import List, Dict, Any, Callable, Optional

from .models import Pipeline, Runner, Task, TaskStatus
from .graph import detect_cycle
from .ready_finder import mark_ready, all_tasks_done, has_failed_blocking_task
from .algorithms import schedule_tasks, Algorithm
from .runner_manager import assign_runner, free_runner
from .metrics import collect_metrics


def run_pipeline(
    pipeline: Pipeline,
    runners: List[Runner],
    algorithm: Algorithm,
    speed_multiplier: float = 1.0,
    on_task_update: Optional[Callable[[Dict], None]] = None,
) -> Dict[str, Any]:
    """
    Simulate a full pipeline execution using the chosen scheduling algorithm.

    Args:
        pipeline:         The pipeline with tasks and dependencies
        runners:          Available runner pool
        algorithm:        FCFS / PRIORITY / DEPENDENCY_AWARE / RESOURCE_AWARE
        speed_multiplier: 1.0 = real time, 10.0 = 10x faster simulation
        on_task_update:   Optional callback called on every task status change
                          (used by backend to stream live updates)

    Returns:
        Full metrics dict from metrics.collect_metrics()
    """

    # ── 1. Validate pipeline (cycle check) ────────────────────────────────
    has_cycle, cycle_path = detect_cycle(pipeline)
    if has_cycle:
        task_names = {t.id: t.name for t in pipeline.tasks}
        readable_cycle = " → ".join(task_names.get(tid, tid) for tid in cycle_path)
        return {
            "error": "CYCLE_DETECTED",
            "message": f"Pipeline rejected: Cyclic dependency detected: {readable_cycle}",
            "cycle": cycle_path,
        }

    # ── 2. Reset pipeline and runners for a clean run ─────────────────────
    pipeline.reset()
    for runner in runners:
        runner.free()

    # ── 3. Tracking variables ──────────────────────────────────────────────
    lock              = threading.Lock()
    runner_busy_times: Dict[str, float] = {r.id: 0.0 for r in runners}
    pipeline_start    = time.time()
    active_threads    = []

    def emit(task: Task, extra: dict = {}):
        """Fire the update callback if provided."""
        if on_task_update:
            on_task_update({
                "task_id":   task.id,
                "task_name": task.name,
                "status":    task.status.value,
                "runner":    task.assigned_runner,
                **extra,
            })

    def execute_task(task: Task, runner: Runner):
        """
        Simulate task execution in a separate thread.
        - Sleep for task.duration / speed_multiplier seconds
        - Then mark SUCCESS or FAILED based on success_rate
        """
        actual_duration = task.duration / speed_multiplier
        time.sleep(actual_duration)

        exec_end = time.time()

        with lock:
            # Determine outcome
            success = random.random() < task.success_rate
            task.status   = TaskStatus.SUCCESS if success else TaskStatus.FAILED
            task.end_time = exec_end

            # Track runner busy time
            if task.start_time:
                runner_busy_times[runner.id] += (exec_end - task.start_time)

            # Free the runner
            free_runner(runner)

        emit(task)

    # ── 4. Main Scheduling Loop ────────────────────────────────────────────
    current_time = pipeline_start

    # Mark initial ready tasks (tasks with no dependencies)
    mark_ready(pipeline, current_time)

    while True:
        current_time = time.time()

        # Check termination conditions
        if all_tasks_done(pipeline):
            break
        if has_failed_blocking_task(pipeline):
            # Mark all remaining PENDING and READY tasks as FAILED (blocked)
            for task in pipeline.tasks:
                if task.status in (TaskStatus.PENDING, TaskStatus.READY):
                    task.status = TaskStatus.FAILED
                    emit(task, {"reason": "blocked_by_failed_dependency"})
            break

        with lock:
            # Get currently READY tasks
            ready_tasks = [t for t in pipeline.tasks if t.status == TaskStatus.READY]
            available_runners = [r for r in runners if not r.is_busy]

            if not ready_tasks or not available_runners:
                pass  # Nothing to schedule right now — keep looping
            else:
                # Sort ready tasks using chosen algorithm
                ordered = schedule_tasks(
                    ready_tasks,
                    algorithm,
                    pipeline=pipeline,
                    available_runners=available_runners,
                )

                # Assign as many tasks as possible to available runners
                for task in ordered:
                    if task.status != TaskStatus.READY:
                        continue  # Already picked up

                    runner = assign_runner(task, runners)
                    if runner is None:
                        continue  # No suitable runner right now

                    # Assign task
                    task_start          = time.time()
                    task.status         = TaskStatus.RUNNING
                    task.start_time     = task_start
                    task.wait_time      = task_start - (task.ready_time or pipeline_start)
                    task.assigned_runner = runner.id
                    runner.assign(task)

                    emit(task)

                    # Launch simulation thread
                    t = threading.Thread(target=execute_task, args=(task, runner), daemon=True)
                    t.start()
                    active_threads.append(t)

            # Mark newly ready tasks after status updates
            mark_ready(pipeline, current_time)

        time.sleep(0.1)  # Small polling interval

    # Wait for all threads to finish
    for t in active_threads:
        t.join()

    pipeline_end = time.time()

    # ── 5. Collect and return metrics ──────────────────────────────────────
    return collect_metrics(
        pipeline=pipeline,
        runners=runners,
        start_time=pipeline_start,
        end_time=pipeline_end,
        runner_busy_times=runner_busy_times,
    )


def run_all_algorithms(
    pipeline: Pipeline,
    runners: List[Runner],
    speed_multiplier: float = 10.0,
) -> Dict[str, Any]:
    """
    Run the same pipeline with all 4 algorithms and return side-by-side metrics.
    Used for the Algorithm Comparison Dashboard.

    Each run gets a deep copy of the pipeline and runners (fresh state).
    """
    results = {}

    for algo in Algorithm:
        # Deep copy to ensure each run is independent
        pipeline_copy = copy.deepcopy(pipeline)
        runners_copy  = copy.deepcopy(runners)

        result = run_pipeline(
            pipeline_copy,
            runners_copy,
            algo,
            speed_multiplier=speed_multiplier,
        )
        results[algo.value] = result

    return results
