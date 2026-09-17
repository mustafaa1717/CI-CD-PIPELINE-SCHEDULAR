"""
runner_manager.py — Runner Assignment Logic
CI/CD Pipeline Scheduler — Team 18

Finds the best available runner for a given task based on resource requirements.
"""

from typing import List, Optional
from .models import Task, Runner


def get_available_runners(runners: List[Runner]) -> List[Runner]:
    """Return all runners that are currently free (not busy)."""
    return [r for r in runners if not r.is_busy]


def assign_runner(task: Task, runners: List[Runner]) -> Optional[Runner]:
    """
    Find the best available runner for the task.

    Strategy: Best-Fit
    - Runner must have enough CPU and RAM for the task
    - Among compatible runners, pick the one with LEAST spare resources
      (avoids wasting a powerful runner on a small task)

    Returns the assigned Runner, or None if no suitable runner is available.
    """
    available = [r for r in runners if r.can_run(task)]

    if not available:
        return None  # No runner can take this task right now

    # Best-fit: minimize wasted resources
    best_runner = min(
        available,
        key=lambda r: (r.cpu_cores - task.required_cpu) + (r.ram_gb - task.required_ram)
    )

    return best_runner


def free_runner(runner: Runner) -> None:
    """
    Release a runner after its task completes.
    Marks it as free and clears the current task.
    """
    runner.free()


def runner_utilization(runner: Runner, total_time: float, busy_time: float) -> float:
    """
    Calculate utilization percentage for a single runner.

    Args:
        runner:     The runner object
        total_time: Total pipeline run duration (seconds)
        busy_time:  Seconds the runner was actually executing a task

    Returns:
        Utilization as a percentage (0.0 – 100.0)
    """
    if total_time <= 0:
        return 0.0
    return round((busy_time / total_time) * 100, 2)
