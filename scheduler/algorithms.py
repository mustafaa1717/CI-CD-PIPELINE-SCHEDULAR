"""
algorithms.py — 4 Scheduling Algorithms
CI/CD Pipeline Scheduler — Team 18

Algorithms:
  1. FCFS              — First Come First Serve (order tasks became READY)
  2. Priority          — Highest priority task first (priority 10 = highest)
  3. Dependency-Aware  — Tasks that unblock the most other tasks run first
  4. Resource-Aware    — Best-fit task for available runner resources
"""

from enum import Enum
from typing import List, Optional
from .models import Task, Runner, TaskStatus
from .graph import get_dependency_count
from .models import Pipeline


class Algorithm(str, Enum):
    FCFS             = "fcfs"
    PRIORITY         = "priority"
    DEPENDENCY_AWARE = "dependency_aware"
    RESOURCE_AWARE   = "resource_aware"


# ─────────────────────────────────────────────
# 1. FCFS — First Come First Serve
# ─────────────────────────────────────────────
def fcfs(ready_tasks: List[Task]) -> List[Task]:
    """
    Schedule tasks in the order they became READY.
    Task with the earliest ready_time goes first.
    If ready_time is None (shouldn't happen), it goes last.
    """
    return sorted(
        ready_tasks,
        key=lambda t: t.ready_time if t.ready_time is not None else float("inf")
    )


# ─────────────────────────────────────────────
# 2. Priority-Based
# ─────────────────────────────────────────────
def priority_based(ready_tasks: List[Task]) -> List[Task]:
    """
    Schedule tasks by priority (10 = highest → runs first).
    Ties broken by ready_time (FCFS fallback).
    """
    return sorted(
        ready_tasks,
        key=lambda t: (
            -t.priority,                                              # Higher priority first
            t.ready_time if t.ready_time is not None else float("inf")  # Tie-break: FCFS
        )
    )


# ─────────────────────────────────────────────
# 3. Dependency-Aware
# ─────────────────────────────────────────────
def dependency_aware(ready_tasks: List[Task], pipeline: Pipeline) -> List[Task]:
    """
    Prefer tasks that unblock the most other tasks (critical path awareness).
    A task with more successors should run first to unlock parallel work.
    Ties broken by priority, then FCFS.
    """
    successor_count = get_dependency_count(pipeline)

    return sorted(
        ready_tasks,
        key=lambda t: (
            -successor_count.get(t.id, 0),                            # More successors → first
            -t.priority,                                              # Higher priority → first
            t.ready_time if t.ready_time is not None else float("inf")  # Tie-break: FCFS
        )
    )


# ─────────────────────────────────────────────
# 4. Resource-Aware (Best-Fit)
# ─────────────────────────────────────────────
def resource_aware(ready_tasks: List[Task], available_runners: List[Runner]) -> List[Task]:
    """
    Best-fit scheduling: prefer tasks whose resource requirements
    most closely match the smallest available runner that can handle them.
    This avoids over-allocating large runners to small tasks.

    For each READY task, compute the 'fit score' = how well it fits
    the smallest compatible runner. Lower waste = better fit = runs first.
    """
    if not available_runners:
        return ready_tasks  # No runners — order doesn't matter yet

    def fit_score(task: Task) -> float:
        """
        Find the runner that wastes the least resources for this task.
        Returns the minimum (cpu_waste + ram_waste) across all compatible runners.
        Lower = better fit.
        """
        compatible = [r for r in available_runners if r.can_run(task)]
        if not compatible:
            return float("inf")  # No runner can take this task — deprioritize

        return min(
            (r.cpu_cores - task.required_cpu) + (r.ram_gb - task.required_ram)
            for r in compatible
        )

    return sorted(
        ready_tasks,
        key=lambda t: (
            fit_score(t),                                             # Best fit first
            -t.priority,                                             # Tie-break: priority
            t.ready_time if t.ready_time is not None else float("inf")  # Tie-break: FCFS
        )
    )


# ─────────────────────────────────────────────
# Unified Entry Point
# ─────────────────────────────────────────────
def schedule_tasks(
    ready_tasks: List[Task],
    algorithm: Algorithm,
    pipeline: Optional[Pipeline] = None,
    available_runners: Optional[List[Runner]] = None,
) -> List[Task]:
    """
    Return ready tasks sorted by the chosen scheduling algorithm.

    Args:
        ready_tasks:       Tasks with status READY
        algorithm:         One of FCFS, PRIORITY, DEPENDENCY_AWARE, RESOURCE_AWARE
        pipeline:          Required for DEPENDENCY_AWARE (needs full graph)
        available_runners: Required for RESOURCE_AWARE (needs runner info)

    Returns:
        Sorted list — first element should be assigned to a runner next.
    """
    if not ready_tasks:
        return []

    if algorithm == Algorithm.FCFS:
        return fcfs(ready_tasks)

    elif algorithm == Algorithm.PRIORITY:
        return priority_based(ready_tasks)

    elif algorithm == Algorithm.DEPENDENCY_AWARE:
        if pipeline is None:
            raise ValueError("pipeline is required for DEPENDENCY_AWARE algorithm")
        return dependency_aware(ready_tasks, pipeline)

    elif algorithm == Algorithm.RESOURCE_AWARE:
        if available_runners is None:
            raise ValueError("available_runners is required for RESOURCE_AWARE algorithm")
        return resource_aware(ready_tasks, available_runners)

    else:
        raise ValueError(f"Unknown algorithm: {algorithm}")
