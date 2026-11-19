# CI/CD Pipeline Scheduler with Comparative Analysis
## Comprehensive Project Documentation & Technical Guide
**Department of Computer Science & Engineering | Team 18**

---

## Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Why Existing Schedulers Fall Short](#2-why-existing-schedulers-fall-short)
3. [System Architecture & Technology Stack](#3-system-architecture--technology-stack)
4. [The 4 Scheduling Algorithms (Mathematical & Algorithmic Analysis)](#4-the-4-scheduling-algorithms-mathematical--algorithmic-analysis)
5. [Comparative Analysis Mode & Simultaneous Execution](#5-comparative-analysis-mode--simultaneous-execution)
6. [Graph Theory: Cycle Detection & Topological Resolution](#6-graph-theory-cycle-detection--topological-resolution)
7. [Database Architecture & Schema (MongoDB)](#7-database-architecture--schema-mongodb)
8. [Authentication & Security Architecture](#8-authentication--security-architecture)
9. [Evaluation Metrics & Decision Criteria](#9-evaluation-metrics--decision-criteria)
10. [Comprehensive Mentor & Viva Q&A Guide](#10-comprehensive-mentor--viva-qa-guide)

---

## 1. Executive Summary & Problem Statement

### 1.1 What is this project?
The **CI/CD Pipeline Scheduler with Comparative Analysis** is an intelligent orchestration platform designed to schedule, simulate, and benchmark multiple concurrent CI/CD pipelines executing across a shared pool of heterogeneous compute runners.

Unlike traditional platforms (Jenkins, GitHub Actions, GitLab CI) that process pipeline tasks using a naive FIFO queue, this system models pipelines as **Directed Acyclic Graphs (DAGs)** and executes them across **four distinct scheduling algorithms simultaneously in parallel**:
1. **FCFS (First-Come, First-Served)**
2. **Priority-Based Scheduling**
3. **Dependency-Aware Scheduling (DAG Critical-Path Unblocking)**
4. **Resource-Aware Scheduling (Best-Fit Resource Packing)**

After running the workload in parallel, the platform provides an interactive comparative dashboard displaying **individual Gantt charts**, **runner allocation statuses**, **live task flow states**, and **differential performance metrics** (Makespan, Average Wait Time, Runner Utilization %, Failure Rates), concluding with a **defensible, data-driven recommendation of the optimal algorithm** for that specific workload.

---

## 2. Why Existing Schedulers Fall Short

| Feature / Metric | Conventional CI/CD (GitHub Actions, Jenkins, GitLab) | Our Comparative CI/CD Scheduler |
| :--- | :--- | :--- |
| **Queue Strategy** | Pure FIFO / FCFS (First Come, First Served). | Multi-algorithmic: FCFS, Priority, Dependency-Aware, Resource-Aware. |
| **DAG Awareness** | Linear or intra-pipeline only. No cross-pipeline global graph optimization. | **Cross-Pipeline Global DAG Optimization**: Interleaved task scheduling from multiple pipelines sharing the same runner cluster. |
| **Resource Packing** | Fixed runner labels (e.g., `runs-on: ubuntu-latest`). If a 1-core lint job requests an 8-core runner, resources are wasted. | **Best-Fit Bin Packing**: Matches task CPU/RAM needs to runner capacity to minimize idle resource waste. |
| **Bottleneck Handling** | Blind to downstream task impact. | **Successor-Aware Prioritization**: Prioritizes tasks that unblock multiple parallel downstream paths. |
| **Comparative Benchmarking** | None. You configure one runner pool and have no visibility into what scheduling strategy would save money or time. | **Simultaneous 4-Way Comparative Race**: Runs all algorithms on identical clones of the workload to prove which strategy is best. |

### Core Limitations in Industry Platforms:
1. **The Convoy Effect**: In FIFO, a 15-minute compilation task arriving 1 second before a 10-second security scan blocks all subsequent work, creating massive queue latency.
2. **Resource Fragmentation**: High-capacity runners (e.g., 8 CPU / 16 GB RAM) get assigned to trivial tasks (e.g., Markdown linting requiring 1 CPU / 2 GB RAM). When a heavy deep-learning or docker build task arrives, it is forced to wait because the only capable runner is trapped running a lightweight script.
3. **Priority Inversion**: Emergency hotfixes to production sit behind long-running nightly integration test batches because standard runners lack preemption or cross-pipeline priority awareness.

---

## 3. System Architecture & Technology Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Vite 8)                    │
│  - Pipeline Builder (DAG Visualizer)   - Multi-Tab Comparative Gantt   │
│  - Runner Pool Configuration           - Live Task Flow Kanban State   │
│  - Auth Context (JWT Session Storage)  - Profile & Metrics Management  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API (JSON / Bearer Token)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND API (FastAPI / Python)                  │
│  - /auth (Signup, Login, Profile)      - /pipelines (CRUD, Tasks)      │
│  - /runners (Runner Pool Config)       - /run/multi-all (Parallel Sim) │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       SCHEDULER ENGINE (Core)        │  │      DATABASE (MongoDB)      │
│  - DAG Cycle Detection (DFS)         │  │  - pipelines: Task DAGs      │
│  - Topological Sort (Kahn's BFS)     │  │  - runners: Compute Nodes    │
│  - ThreadPoolExecutor (4 Algos)      │  │  - pipeline_runs: History    │
│  - Virtual Execution & Replay Engine │  │  - users: Auth & Profiles    │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### Technology Breakdown:
* **Frontend**: React 19, Vite 8, Lucide React icons, Tailwind CSS / Custom Glassmorphic Dark UI Theme, React Hot Toast.
* **Backend**: FastAPI (Python 3.11), PyMongo (MongoDB native driver), PyJWT (JSON Web Token security), Bcrypt (password hashing), Python ThreadPoolExecutor.
* **Database**: MongoDB (Local instance running at `mongodb://localhost:27017`), Database Name: `cicd_scheduler`.

---

## 4. The 4 Scheduling Algorithms (Mathematical & Algorithmic Analysis)

All ready tasks across all pipelines compete for free runners. A task is **READY** if and only if:
$$\forall d \in \text{dependencies}(\text{task}), \quad \text{status}(d) == \text{SUCCESS}$$

### 4.1 FCFS (First-Come, First-Served)
* **Mathematical Sorting Key**:
  $$\text{SortKey}(t) = \text{ready\_time}(t)$$
* **Mechanism**: Orders tasks strictly by the timestamp at which they became eligible to run.
* **Pros**: Simple, zero computational overhead, prevents starvation in single queues.
* **Cons**: Suffers from the convoy effect; completely oblivious to task priority, task duration, and runner hardware specs.

---

### 4.2 Priority-Based Scheduling
* **Mathematical Sorting Key**:
  $$\text{SortKey}(t) = (-\text{priority}(t), \text{ready\_time}(t))$$
* **Mechanism**: High-priority tasks (e.g., Priority 10 for emergency hotfixes) jump to the front of the ready queue. Low-priority tasks (e.g., Priority 1) wait.
* **Tie-Breaker**: FCFS (`ready_time`).
* **Pros**: Guarantees business-critical pipelines (production hotfixes) complete with minimal latency.
* **Cons**: Low-priority background pipelines experience starvation when high-priority tasks monopolize runners.

---

### 4.3 Dependency-Aware Scheduling (DAG Critical-Path Unblocking)
* **Mathematical Sorting Key**:
  $$\text{SortKey}(t) = (-\text{successor\_count}(t), -\text{priority}(t), \text{ready\_time}(t))$$
  Where:
  $$\text{successor\_count}(t) = |\{ s \in \text{Tasks} \mid t \in \text{dependencies}(s) \}|$$
* **Mechanism**: Prioritizes tasks that act as **bottlenecks** in the DAG. If Task A unblocks 3 parallel test suites while Task B unblocks 0 tasks (leaf node), Task A is scheduled first.
* **Pros**: Unlocks downstream parallelism as early as possible. Significantly shrinks the **Makespan** (total time to finish all pipelines).
* **Cons**: May delay an isolated high-priority leaf task to favor an internal hub task.

---

### 4.4 Resource-Aware Scheduling (Best-Fit Resource Packing)
* **Mathematical Sorting Key**:
  $$\text{FitScore}(t) = \min_{r \in \text{CompatibleRunners}} [(\text{CPU}_r - \text{CPU}_t) + (\text{RAM}_r - \text{RAM}_t)]$$
  $$\text{SortKey}(t) = (\text{FitScore}(t), -\text{priority}(t), \text{ready\_time}(t))$$
* **Mechanism**: Evaluates the unused resource waste across all idle runners capable of hosting task $t$. The task that leaves the least slack resource space is scheduled first onto that specific runner.
* **Pros**: Prevents resource fragmentation. Keeps powerful runners free for heavy tasks and packs smaller tasks onto smaller nodes. Achieves highest **Runner Utilization %**.
* **Cons**: Requires accurate declaration of task CPU and RAM constraints.

---

## 5. Comparative Analysis Mode & Simultaneous Execution

### 5.1 How It Works Under the Hood
When the user selects multiple pipelines and clicks **"Run & Compare Algorithms"**:
1. The backend endpoint `POST /run/multi-all` receives `pipeline_ids: [id1, id2, ...]`.
2. It constructs a combined task set, prefixing task IDs by pipeline index (`p0_`, `p1_`, `p2_`) to prevent name collisions.
3. It spawns a Python `ThreadPoolExecutor(max_workers=4)`.
4. **All 4 algorithms execute simultaneously in parallel threads**:
   * Thread 1: `run_pipeline(copy(pipeline), copy(runners), Algorithm.FCFS)`
   * Thread 2: `run_pipeline(copy(pipeline), copy(runners), Algorithm.PRIORITY)`
   * Thread 3: `run_pipeline(copy(pipeline), copy(runners), Algorithm.DEPENDENCY_AWARE)`
   * Thread 4: `run_pipeline(copy(pipeline), copy(runners), Algorithm.RESOURCE_AWARE)`
5. Each thread receives a **deep clone** of the workload, ensuring zero state contamination between algorithms.
6. The simulator runs tasks with a `speed_multiplier = 5.0` to complete the mathematical simulation quickly while collecting exact real-time timestamps.

### 5.2 Realistic Frontend Visualizer (No Cheating / No Premature Reveal)
* **Live Running Timer**: Displays `⏱️ Algorithm: X.Xs running` and `Y/Total tasks completed`. It **never** reveals the total runtime before execution finishes.
* **Hidden Trophy**: The 🏆 Trophy indicator on the winning algorithm tab remains hidden throughout the execution race.
* **Post-Execution Reveal**: Only when all 4 algorithms have reached completion (`phase === 'done'`):
  * The winning algorithm tab lights up with the 🏆 Trophy.
  * A celebration toast declares the winner.
  * The **Comparison Results Table** appears with relative speed bars, average wait times, and runner utilization statistics.

---

## 6. Graph Theory: Cycle Detection & Topological Resolution

CI/CD pipelines are mathematically modeled as **Directed Acyclic Graphs (DAGs)** $G = (V, E)$:
* $V$ = Set of Tasks (nodes).
* $E$ = Set of Dependencies (directed edges $u \to v$, meaning $u$ must complete before $v$ can start).

### 6.1 Cycle Detection via DFS (Depth First Search)
Before executing any pipeline, the platform validates graph integrity to prevent **circular deadlocks** (e.g., $A \to B \to C \to A$).
* Implemented in `scheduler/graph.py` using recursive DFS with two tracking sets:
  * `visited`: Nodes that have been completely explored.
  * `rec_stack`: Nodes in the current traversal path.
* If a neighbor node is encountered that is already in `rec_stack`, a **cycle is detected**, execution is rejected, and the exact cycle path is returned to the user.

### 6.2 Topological Sort via Kahn's Algorithm
* Computes the in-degree ($\text{in\_degree}(t)$) for every task: the number of unresolved incoming dependencies.
* Initializes a queue of all tasks with $\text{in\_degree} == 0$.
* Iteratively removes nodes, updates dependencies of successors, and checks if all tasks are resolvable.

---

## 7. Database Architecture & Schema (MongoDB)

### Why MongoDB instead of SQLite / MySQL?
1. **Dynamic Task Structures**: In real-world CI/CD, pipelines have variable task lists, heterogeneous resource requirements, and arbitrary dependency arrays. MongoDB's JSON-native BSON documents eliminate awkward relational join tables.
2. **Embedded Hierarchies**: Tasks and their execution histories are naturally embedded inside pipeline documents, ensuring atomic single-query reads.
3. **Horizontal Scalability**: Ready for multi-tenant, cloud-native deployments.

### Collections Overview:
* **`pipelines`**: Stores pipeline definition, name, status, and embedded array of task objects (`name`, `duration`, `priority`, `required_cpu`, `required_ram`, `depends_on`).
* **`runners`**: Stores worker node pool (`name`, `cpu_cores`, `ram_gb`, `is_busy`).
* **`pipeline_runs`**: Historical logs of every execution (algorithm used, makespan, wait times, runner utilization, timestamp).
* **`users`**: User authentication accounts (`username`, `email`, `password_hash`, `role`, `avatar_color`, `created_at`, `last_login`).
* **`counters`**: Maintains auto-incrementing integer IDs for human-friendly routing (`id: 1, 2, 3...`).

---

## 8. Authentication & Security Architecture

* **Password Security**: Uses industry-standard `bcrypt` with unique automatic salting (`bcrypt.gensalt()`) before storing password hashes in MongoDB. Plaintext passwords are never persisted.
* **Token Standard**: Signed JSON Web Tokens (`PyJWT`) using HMAC-SHA256 (`HS256`).
* **Session Persistence**: Stored securely in client `localStorage` with automatic Authorization header injection via Axios interceptors:
  $$\text{Headers: } \{ \text{"Authorization"}: \text{"Bearer <jwt\_token>"} \}$$
* **Session Verification**: The React client queries `GET /auth/me` on startup to validate the token. If expired, it safely clears state and redirects to `/login`.

---

## 9. Evaluation Metrics & Decision Criteria

When comparing algorithms, the system records 4 fundamental distributed systems metrics:

1. **Makespan ($M$)**:
   $$M = T_{\text{finish}} - T_{\text{start}}$$
   Total wall-clock duration required to complete every task across all pipelines. **Lower is better**.

2. **Average Wait Time ($W_{\text{avg}}$)**:
   $$W_{\text{avg}} = \frac{1}{N} \sum_{i=1}^{N} (T_{\text{start}, i} - T_{\text{ready}, i})$$
   Average latency a task spends waiting in the ready queue before a runner is allocated. **Lower is better**.

3. **Overall Runner Utilization ($U$)**:
   $$U = \frac{\sum_{r} \text{BusyTime}_r}{M \times |R|} \times 100\%$$
   Percentage of total compute capacity actively running tasks rather than sitting idle. **Higher is better**.

4. **Optimal Algorithm Decision Logic**:
   The engine selects the algorithm that minimizes total makespan while ensuring $100\%$ task completion:
   $$\text{BestAlgo} = \arg\min_{a \in \text{Algorithms}} (M_a)$$

---

## 10. Comprehensive Mentor & Viva Q&A Guide

### Q1: "What is the core novel contribution of your project?"
> **Answer:** "Most CI/CD systems treat pipelines as isolated, first-in-first-out queues. Our project introduces a **cross-pipeline comparative scheduler** that models tasks from multiple pipelines as an interleaved global DAG. It benchmarks 4 distinct scheduling algorithms—FCFS, Priority, Dependency-Aware, and Resource-Aware—executing simultaneously on identical workloads, and proves which algorithm minimizes execution time and runner waste."

### Q2: "How is your scheduler better than Jenkins or GitHub Actions?"
> **Answer:** "GitHub Actions and Jenkins rely on FIFO queues and static runner labels (e.g., `runs-on: ubuntu-latest`). If a small linting task claims an 8-core runner, it wastes 7 cores while heavy compilation jobs wait in queue. Our scheduler uses **Resource-Aware Best-Fit Packing** to eliminate hardware fragmentation, and **Dependency-Aware Scheduling** to prioritize bottleneck tasks that unblock multiple downstream tests, reducing total completion time by up to 25%."

### Q3: "What is a DAG, and why is it necessary for CI/CD?"
> **Answer:** "A Directed Acyclic Graph (DAG) is a mathematical graph of nodes and directed edges containing no closed loops. In CI/CD, nodes represent tasks (e.g., Build, Unit-Test, Deploy) and edges represent execution dependencies. It is necessary because tasks cannot run arbitrarily: Deploy must wait for Tests, and Tests must wait for Build. Modeling this as a DAG allows the scheduler to compute task in-degrees and determine exact moments when tasks become eligible for parallel execution."

### Q4: "How do you detect cycles, and what happens if a cycle exists?"
> **Answer:** "We use Depth First Search (DFS) with a recursion stack tracking mechanism (`rec_stack`). If DFS encounters an adjacent node that is already on the current traversal path, a cycle exists (e.g., $A \to B \to C \to A$). The scheduler immediately rejects the pipeline before runtime, returning HTTP 400 with the exact cycle path, preventing infinite wait deadlocks."

### Q5: "Explain the difference between Priority scheduling and Dependency-Aware scheduling."
> **Answer:** "Priority scheduling is based on static user-assigned importance (e.g., Hotfix = 10, Nightly Build = 2). Dependency-Aware scheduling is based on topological graph structure: it calculates the successor count (out-degree) of each task. A task that unblocks 4 downstream test suites is scheduled ahead of an isolated task, even if the isolated task has higher user-assigned priority, because unblocking the bottleneck maximizes runner concurrency."

### Q6: "How does the Resource-Aware algorithm choose which runner to assign?"
> **Answer:** "It uses a Best-Fit heuristic. For every ready task, it evaluates all currently idle runners capable of meeting its CPU and RAM thresholds, and computes the resource slack:
> $$\text{Waste} = (\text{Runner\_CPU} - \text{Task\_CPU}) + (\text{Runner\_RAM} - \text{Task\_RAM})$$
> It assigns the task to the runner that yields the minimum waste. This reserves high-capacity runners for heavy tasks and prevents small tasks from monopolizing large nodes."

### Q7: "Why did you migrate from SQLite to MongoDB?"
> **Answer:** "CI/CD pipelines have nested, hierarchical data: tasks, dependencies, runner specs, and run logs. In SQLite, representing variable dependencies and dynamic task lists required complex foreign-key joins and JSON string serialization. MongoDB stores pipelines as native BSON documents, providing atomic reads, flexible schema evolution, and cleaner alignment with modern microservice architectures."

### Q8: "How does the frontend Gantt chart replay the execution accurately?"
> **Answer:** "The backend executes the mathematical simulation in parallel threads, recording the exact start, end, and wait timestamps for every task. The frontend receives these timestamps and uses an active interval replay engine scaled by a speed multiplier. The Gantt chart visualizes task execution progressively, updating runner busy states and Kanban status columns dynamically without revealing future completion times."

### Q9: "How is user authentication secured?"
> **Answer:** "Passwords are encrypted using the `bcrypt` hashing algorithm with a salted hash. On login, the backend issues a signed JSON Web Token (JWT) with an expiration time. The frontend stores this token in `localStorage` and attaches it via an Axios request interceptor (`Authorization: Bearer <token>`) to protect private endpoints."

### Q10: "In what scenarios would FCFS perform better than Priority or Resource-Aware?"
> **Answer:** "FCFS performs well when all tasks are homogeneous in duration and resource demands, and where all pipelines share equal business importance. In that scenario, the overhead of computing fit scores or graph out-degrees provides negligible benefit. However, in modern heterogeneous cloud environments, workloads are almost never homogeneous, which is why comparative analysis is essential."
