"""
ready_finder.py — Find tasks that are READY to execute
CI/CD Pipeline Scheduler — Team 18

A task is READY when:
  1. Its status is PENDING (not already running/done)
  2. ALL of its dependency tasks have status = SUCCESS
"""

from typing import List
from .models import Pipeline, Task, TaskStatus


def find_ready_tasks(pipeline: Pipeline) -> List[Task]:
    """
    Scan all tasks and return those that are ready to be scheduled.

    A task is READY if:
    - It has status PENDING
    - Every task it depends on has status SUCCESS

    Returns list of ready Task objects (not yet READY status — caller sets it).
    """
    # Build a quick lookup: task_id -> status
    status_map = {task.id: task.status for task in pipeline.tasks}

    ready = []
    for task in pipeline.tasks:
        if task.status != TaskStatus.PENDING:
            continue  # Already running, done, or ready

        # Check all dependencies are completed successfully
        all_deps_done = all(
            status_map.get(dep_id) == TaskStatus.SUCCESS
            for dep_id in task.dependencies
        )

        if all_deps_done:
            ready.append(task)

    return ready


def mark_ready(pipeline: Pipeline, current_time: float) -> List[Task]:
    """
    Find PENDING tasks whose dependencies are all done,
    mark them as READY, and record their ready_time.

    Returns newly marked READY tasks.
    """
    newly_ready = []

    for task in find_ready_tasks(pipeline):
        if task.status == TaskStatus.PENDING:
            task.status     = TaskStatus.READY
            task.ready_time = current_time
            newly_ready.append(task)

    return newly_ready


def all_tasks_done(pipeline: Pipeline) -> bool:
    """Return True when every task has reached a terminal state (SUCCESS or FAILED)."""
    terminal = {TaskStatus.SUCCESS, TaskStatus.FAILED}
    return all(task.status in terminal for task in pipeline.tasks)


def has_failed_blocking_task(pipeline: Pipeline) -> bool:
    """
    Check if any FAILED task is blocking other PENDING tasks.
    If so, the pipeline is stuck and cannot complete.
    """
    failed_ids = {task.id for task in pipeline.tasks if task.status == TaskStatus.FAILED}

    for task in pipeline.tasks:
        if task.status == TaskStatus.PENDING:
            if any(dep in failed_ids for dep in task.dependencies):
                return True  # This task is blocked by a failed dependency

    return False
