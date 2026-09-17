"""
graph.py — DAG Builder, Cycle Detection (DFS), Topological Sort (Kahn's Algorithm)
CI/CD Pipeline Scheduler — Team 18
"""

from typing import Dict, List, Tuple, Optional
from .models import Pipeline, Task


def build_adjacency_list(pipeline: Pipeline) -> Dict[str, List[str]]:
    """
    Build a forward adjacency list:
    task_id -> list of task_ids that DEPEND ON it (successors).

    Example:
        Build -> [Test]   means Test depends on Build
        Test  -> [Deploy] means Deploy depends on Test
    """
    graph: Dict[str, List[str]] = {task.id: [] for task in pipeline.tasks}

    for task in pipeline.tasks:
        for dep_id in task.dependencies:
            if dep_id in graph:
                graph[dep_id].append(task.id)

    return graph


def detect_cycle(pipeline: Pipeline) -> Tuple[bool, List[str]]:
    """
    Detect cycles in the dependency graph using DFS.

    Returns:
        (True, cycle_path)  — if a cycle exists
        (False, [])         — if the graph is a valid DAG

    Example cycle: Build -> Test -> Deploy -> Build  ← INVALID
    """
    graph    = build_adjacency_list(pipeline)
    visited  = set()
    rec_stack = set()   # Nodes in the current DFS path
    cycle_path: List[str] = []

    def dfs(node: str) -> bool:
        visited.add(node)
        rec_stack.add(node)
        cycle_path.append(node)

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                # Found cycle — record where it loops back
                cycle_path.append(neighbor)
                return True

        rec_stack.discard(node)
        cycle_path.pop()
        return False

    for task in pipeline.tasks:
        if task.id not in visited:
            if dfs(task.id):
                return True, cycle_path

    return False, []


def topological_sort(pipeline: Pipeline) -> Optional[List[str]]:
    """
    Kahn's Algorithm — BFS-based topological sort.

    Returns:
        List of task IDs in valid execution order, or
        None if the graph has a cycle (shouldn't happen if detect_cycle ran first).

    Example output: ["build", "unit_test", "security_test", "deploy"]
    """
    graph     = build_adjacency_list(pipeline)

    # in_degree = number of unresolved dependencies per task
    in_degree: Dict[str, int] = {task.id: len(task.dependencies) for task in pipeline.tasks}

    # Start with all tasks that have no dependencies
    queue  = [task_id for task_id, deg in in_degree.items() if deg == 0]
    result: List[str] = []

    while queue:
        node = queue.pop(0)
        result.append(node)

        # For every task that depends on this node, reduce its in-degree
        for successor in graph.get(node, []):
            in_degree[successor] -= 1
            if in_degree[successor] == 0:
                queue.append(successor)

    if len(result) == len(pipeline.tasks):
        return result

    return None  # Cycle detected — incomplete sort


def get_dependency_count(pipeline: Pipeline) -> Dict[str, int]:
    """
    For each task, count how many OTHER tasks depend on it (successor count).
    Used by the Dependency-Aware scheduling algorithm.

    Higher count = unblocks more tasks = schedule first.
    """
    graph = build_adjacency_list(pipeline)
    return {task_id: len(successors) for task_id, successors in graph.items()}
