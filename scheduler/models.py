"""
models.py — Data classes for Task, Pipeline, Runner
CI/CD Pipeline Scheduler — Team 18
"""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "PENDING"       # Not yet ready (dependencies not done)
    READY   = "READY"         # All dependencies done, waiting for runner
    RUNNING = "RUNNING"       # Assigned to a runner, executing
    SUCCESS = "SUCCESS"       # Completed successfully
    FAILED  = "FAILED"        # Execution failed


@dataclass
class Task:
    id:              str
    name:            str
    duration:        float          # Simulated execution time in seconds
    priority:        int            # 1 (lowest) to 10 (highest)
    required_cpu:    float          # CPU cores needed (e.g. 2.0)
    required_ram:    float          # RAM in GB needed (e.g. 4.0)
    dependencies:    List[str]      = field(default_factory=list)   # List of task IDs this task depends on
    status:          TaskStatus     = TaskStatus.PENDING
    success_rate:    float          = 1.0    # Probability of success (0.0 – 1.0)
    start_time:      Optional[float] = None  # Unix timestamp when execution started
    end_time:        Optional[float] = None  # Unix timestamp when execution ended
    ready_time:      Optional[float] = None  # Unix timestamp when task became READY
    assigned_runner: Optional[str]  = None   # Runner ID assigned to this task
    wait_time:       float          = 0.0    # Time spent waiting for a runner (seconds)

    def reset(self):
        """Reset task to initial state for re-running with different algorithm."""
        self.status          = TaskStatus.PENDING
        self.start_time      = None
        self.end_time        = None
        self.ready_time      = None
        self.assigned_runner = None
        self.wait_time       = 0.0


@dataclass
class Pipeline:
    id:    str
    name:  str
    tasks: List[Task] = field(default_factory=list)

    def get_task(self, task_id: str) -> Optional[Task]:
        """Return task by ID."""
        return next((t for t in self.tasks if t.id == task_id), None)

    def reset(self):
        """Reset all tasks for a fresh simulation run."""
        for task in self.tasks:
            task.reset()


@dataclass
class Runner:
    id:           str
    name:         str
    cpu_cores:    float     # Total CPU cores available
    ram_gb:       float     # Total RAM in GB available
    is_busy:      bool      = False
    current_task: Optional[str] = None   # Task ID currently running on this runner

    def can_run(self, task: Task) -> bool:
        """Check if this runner has enough resources for the given task."""
        return (
            not self.is_busy
            and self.cpu_cores >= task.required_cpu
            and self.ram_gb   >= task.required_ram
        )

    def assign(self, task: Task):
        """Mark runner as busy with the given task."""
        self.is_busy      = True
        self.current_task = task.id

    def free(self):
        """Mark runner as free after task completion."""
        self.is_busy      = False
        self.current_task = None
