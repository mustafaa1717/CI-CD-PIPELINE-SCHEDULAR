# CHAPTER 5 — SPRINT 2 STUDENT HANDBOOK
## Broader Engine Implementation & Mandatory Partial Testing
**Separate student evidence workbook | Hybrid SDLC execution window: primary maturity focus on S5 implementation and S6 engine-level testing; S7 corrective refinement begins where needed | Weeks 10–13 | Gate 3 / Review 4**

---

### 5.1 Team and Engine Register

| Field | Student Entry |
| :--- | :--- |
| **Team Number** | 18 |
| **Theme** | Dependency & Resource-Aware CI/CD Pipeline Scheduler |
| **Artefact** | Web-Based CI/CD Pipeline Scheduling System |
| **Guide** | Sumayya Kadampur Mam |
| **Department** | Computer Science & Engineering |
| **Repository URL** | `https://github.com/mustafaa1717/CI-CD-PIPELINE-SCHEDULAR.git` (Branch: `branch-1`) |
| **Latest Commit** | `4841942` (`HEAD -> branch-4, origin/branch-1`) |
| **Date** | 25-11-2026 |

#### Student Responsibilities
| Student | SRN / USN | Student Name | Engine / Responsibility |
| :--- | :--- | :--- | :--- |
| **Student 1** | 01FE24BCS227 | Mohammed Ansar | **E2 — Scheduling & Resource Management** |
| **Student 2** | 01FE24BCS236 | Mustafa | **E1 — Dependency Analysis** |
| **Student 3** | 01FE24BCS212 | Nandan | **E3 — Pipeline Data Management** |
| **Student 4** | 01FE24BCS243 | Vihaan | **E4 — Interface & Visualization** |

#### Approved Engine Directory
| Engine ID | Approved Engine Name | Owner | Main Function | Key Implementation Files |
| :--- | :--- | :--- | :--- | :--- |
| **E1** | Dependency Analysis | Mustafa | Represent pipeline tasks as a DAG; detect cycles using 3-color DFS; compute topological sort order via Kahn's algorithm; identify unblocked ready tasks. | `scheduler/graph.py`<br>`scheduler/ready_finder.py` |
| **E2** | Scheduling & Resource Management | Mohammed Ansar | Schedule ready tasks across heterogeneous runners using 4 comparative heuristics (FCFS, Priority, Dependency-Aware, Resource-Aware); enforce CPU/RAM constraints; parallel execution via `ThreadPoolExecutor`. | `scheduler/algorithms.py`<br>`scheduler/runner_manager.py`<br>`scheduler/simulator.py`<br>`backend/services/scheduler_service.py` |
| **E3** | Pipeline Data Management | Nandan | Multi-tenant persistence in MongoDB (`cicd_scheduler`); atomic auto-increment counters; user authentication (bcrypt + JWT); role-based access control (Admin vs DevOps Engineer). | `backend/database.py`<br>`backend/models.py`<br>`backend/routers/auth.py`<br>`backend/routers/pipelines.py`<br>`backend/routers/runners.py`<br>`backend/routers/admin.py` |
| **E4** | Interface & Visualization | Vihaan | React 19 + Vite 8 glassmorphic dashboard; interactive DAG pipeline builder; concurrent Gantt execution replay; comparative telemetry metrics; Admin Control Center. | `frontend/src/pages/RunScheduler.jsx`<br>`frontend/src/pages/Home.jsx`<br>`frontend/src/pages/PipelineBuilder.jsx`<br>`frontend/src/pages/RunnerSetup.jsx`<br>`frontend/src/pages/ComparisonDashboard.jsx`<br>`frontend/src/pages/AdminDashboard.jsx`<br>`frontend/src/components/Navbar.jsx` |

---

## PART B — STUDENT EVIDENCE TEMPLATES

### 1. Sprint 2 Plan and Backlog

| Task / FR ID | Engine / Owner | Work to Implement | Done When... | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01 / E1** | E1 / Mustafa | Implement DAG representation, 3-color DFS cycle detection ($O(V+E)$), and Kahn's topological sort. | Valid DAG produces valid dependency sequence; cyclic input raises `ValueError` and prevents scheduling. | **Completed (Pass)** |
| **FR-02 / E1** | E1 / Mustafa | Dynamic ready-task resolution: identify tasks whose in-degree reaches 0 upon upstream prerequisite completion. | `get_ready_tasks()` returns only unblocked tasks whose dependencies have succeeded. | **Completed (Pass)** |
| **FR-03 / E2** | E2 / Mohammed Ansar | Implement 4 scheduling heuristics: FCFS, Strict Priority, Dependency-Aware (Critical Path / In-degree), and Resource-Aware (Best-Fit Capacity Matching). | All 4 algorithms simulate identical workloads concurrently and output verifiable makespan, waiting time, and runner utilization metrics. | **Completed (Pass)** |
| **FR-04 / E2** | E2 / Mohammed Ansar | Heterogeneous runner resource matching with CPU/RAM capacity bounds. | Tasks are never placed on runners lacking required CPU cores or RAM; incompatible runners remain unallocated. | **Completed (Pass)** |
| **FR-05 / E2** | E2 / Mohammed Ansar | Concurrent 4-algorithm simulation engine using Python `ThreadPoolExecutor(max_workers=4)`. | Backend runs all 4 algorithms in parallel, aggregates individual metrics, and automatically recommends the optimal algorithm. | **Completed (Pass)** |
| **FR-06 / E3** | E3 / Nandan | Migrate database persistence layer from SQLite to native MongoDB (`cicd_scheduler`). | Collections `pipelines`, `runners`, `pipeline_runs`, `users`, and `counters` persist data with atomic integer IDs. | **Completed (Pass)** |
| **FR-07 / E3** | E3 / Nandan | JWT Authentication & Multi-Tenant Pipeline Isolation with RBAC (Admin vs DevOps Engineer). | Regular users only view/execute their own pipelines; Admins have cluster-wide governance and user management. | **Completed (Pass)** |
| **FR-08 / E4** | E4 / Vihaan | Synchronized 4-tab Gantt chart execution replay with dynamic runner swimlanes and live clock. | Gantt renders task execution timelines; timer counts elapsed time (`⏱️ X.Xs running`) without spoiling final makespan. | **Completed (Pass)** |
| **FR-09 / E4** | E4 / Vihaan | Admin Control Center (`/admin`) and 1-Click Fast Access authentication on login screen. | Admin can view system telemetry, promote/demote user roles, and delete any pipeline; 1-click admin login bypasses manual typing for evaluation. | **Completed (Pass)** |

**Evidence Filename / Repository Link**: `https://github.com/mustafaa1717/CI-CD-PIPELINE-SCHEDULAR/tree/branch-1` (Commit: `4841942`)

---

### 2. Sprint 1 Design Handoff

| Engine ID | Approved Design Reference | Implementation Dependency | Approved Change & Refinement |
| :--- | :--- | :--- | :--- |
| **E1** | Sprint 1 DAG Model & Topological Sort Architecture | Provides validated graph adjacency structure and dependency constraints to E2 scheduler. | Retained 3-color DFS cycle validation ($O(V+E)$) and Kahn's algorithm; integrated dynamic ready task finder (`scheduler/ready_finder.py`). |
| **E2** | Sprint 1 Multi-Algorithm Comparative Heuristics Specification | Consumes E1 ready tasks; matches against E3 runner pool; emits telemetry consumed by E4. | Enhanced from single-algorithm sequential execution to concurrent 4-algorithm execution via `ThreadPoolExecutor(max_workers=4)` with automated winner recommendation. |
| **E3** | Sprint 1 Relational Database & Entity Schema Specification | Supplies persistent task, runner, pipeline, and run metrics to backend engines. | **Major Approved Architectural Upgrade**: Migrated from SQLite/SQLAlchemy to MongoDB (`cicd_scheduler`) via `pymongo` to support flexible nested task DAG schemas and multi-tenancy. |
| **E4** | Sprint 1 UI Wireframe & Gantt Visualizer Design | Consumes FastAPI REST endpoints; renders live execution state. | Built on React 19 + Vite 8 with dark glassmorphic DevOps styling, real-time Gantt replay animation, and dedicated Admin Control Center. |

**Evidence Filename / Repository Link**: `C:\Mini-project CI-CD\CI-CD-PIPELINE-SCHEDULAR\PROJECT_DOCUMENTATION.md`

---

### 3. Engine-wise Implementation Register

| Engine ID | Module / Core Operation | Implemented Behaviour | Code / Commit Reference | Status |
| :--- | :--- | :--- | :--- | :--- |
| **E1** | DAG Construction & 3-Color Cycle Detection | Constructs directed adjacency list from task dependency declarations; utilizes WHITE (0), GRAY (1), and BLACK (2) vertex states to detect back-edges and reject cyclic graphs. | `scheduler/graph.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E1** | Kahn's Topological Ordering & Ready Queue | Computes in-degree counts for all tasks; initializes FIFO queue of zero-in-degree vertices; emits topological ordering. | `scheduler/graph.py`<br>`scheduler/ready_finder.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E2** | 4 Comparative Scheduling Algorithms | Implements FCFS (arrival order), Strict Priority ($P_{task}$ desc), Dependency-Aware (critical-path unblocking), and Resource-Aware (best-fit runner allocation minimizing leftover compute capacity). | `scheduler/algorithms.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E2** | Heterogeneous Runner Capacity Matching | Matches tasks against available runners verifying $CPU_{task} \le CPU_{runner}$ and $RAM_{task} \le RAM_{runner}$. Binds runner and simulates execution time. | `scheduler/runner_manager.py`<br>`scheduler/simulator.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E2** | Concurrent Multi-Pipeline Simulation Service | Concurrently executes all 4 heuristics on identical copies of workload DAGs using `ThreadPoolExecutor(max_workers=4)`; compiles comparative makespan, waiting time, and runner utilization metrics. | `backend/services/scheduler_service.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E3** | MongoDB Persistence & Schema Normalization | Native `pymongo` layer managing `pipelines`, `runners`, `pipeline_runs`, `users`, and `counters`. Uses atomic `find_one_and_update` with `{"$inc": {"seq": 1}}` for clean integer IDs. | `backend/database.py`<br>`backend/models.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E3** | Authentication & Multi-Tenant Pipeline Isolation | Bcrypt password hashing (12 rounds) + PyJWT signed tokens (HS256). Normal users only view/run their own pipelines; Admins have full access. Unauthorized execution blocked with HTTP 401/403. | `backend/routers/auth.py`<br>`backend/routers/pipelines.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E3** | System Administration Governance Endpoints | REST endpoints for cluster statistics (`/admin/stats`), user directory management (`/admin/users`), role promotion/demotion, and global pipeline deletion. | `backend/routers/admin.py`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E4** | Real-Time Gantt Chart & Simulation Replay | Renders runner swimlanes with color-coded task blocks, animated progress bars, live clock (`⏱️ 2.4s running`), and delayed trophy reveal upon simulation completion. | `frontend/src/pages/RunScheduler.jsx`<br>`commit 4841942` | **Fully Implemented & Verified** |
| **E4** | Admin Control Center & Fast Demo Auth | Dedicated admin interface (`/admin`) displaying telemetry cards, user account table with promote/delete actions, cluster runner provisioning, and 1-click login buttons. | `frontend/src/pages/AdminDashboard.jsx`<br>`frontend/src/pages/Login.jsx`<br>`commit 4841942` | **Fully Implemented & Verified** |

**Evidence Filename / Repository Link**: `https://github.com/mustafaa1717/CI-CD-PIPELINE-SCHEDULAR/tree/branch-1`

---

### 4. Algorithm and Data Structure Implementation

#### A. Engine E1: 3-Color DFS Cycle Detection & Kahn's Topological Sort
* **Data Structures**: Adjacency list `dict[str, list[str]]`, Color array `dict[str, int]` (WHITE=0, GRAY=1, BLACK=2), In-degree table `dict[str, int]`, FIFO queue (`collections.deque`).
* **Input**: Tasks with declared prerequisites:
  - Task A (`depends_on: []`), Task B (`depends_on: ["A"]`), Task C (`depends_on: ["B"]`)
* **Observed Output**:
  - `is_cyclic()` $\rightarrow$ `False`
  - `topological_sort()` $\rightarrow$ `['A', 'B', 'C']`
* **Edge Case Handled**:
  - Cyclic Dependency: Task C adds dependency on Task A (`A` $\rightarrow$ `B` $\rightarrow$ `C` $\rightarrow$ `A`).
  - DFS encounters a back-edge to a vertex currently in `GRAY` (ancestor on recursion stack), immediately detects cycle, returns `True`, and blocks execution with validation error.

#### B. Engine E2: Multi-Heuristic Comparative Scheduling on Heterogeneous Cluster
* **Heterogeneous Cluster Setup**:
  - `Runner-Alpha`: 2 vCPU, 4 GB RAM
  - `Runner-Beta`: 4 vCPU, 8 GB RAM
  - `Runner-Gamma`: 8 vCPU, 16 GB RAM
* **Benchmark Workload**: 3 Conflicting Pipelines (14 tasks total):
  1. `Production-Hotfix` (4 tasks, Priority 9–10)
  2. `Core-Backend` (5 tasks, Priority 3–4, heavy compute: 7 vCPU / 14 GB RAM test)
  3. `Web-Frontend` (5 tasks, Priority 5–7)
* **Comparative Execution Results (Observed Terminal Output)**:
  ```json
  {
    "best_algorithm": "resource_aware",
    "speed_multiplier": 5.0,
    "results": {
      "resource_aware": {
        "makespan": 3.62,
        "avg_wait_time": 0.84,
        "overall_utilization": 78.3,
        "successful_tasks": 14,
        "total_tasks": 14
      },
      "fcfs": {
        "makespan": 3.73,
        "avg_wait_time": 1.12,
        "overall_utilization": 72.1,
        "successful_tasks": 14,
        "total_tasks": 14
      },
      "priority": {
        "makespan": 3.93,
        "avg_wait_time": 1.25,
        "overall_utilization": 68.4,
        "successful_tasks": 14,
        "total_tasks": 14
      },
      "dependency_aware": {
        "makespan": 4.23,
        "avg_wait_time": 1.48,
        "overall_utilization": 65.2,
        "successful_tasks": 14,
        "total_tasks": 14
      }
    }
  }
  ```
* **Edge Case Handled**:
  - Insufficient Capacity: A task requiring 12 vCPU against max runner of 8 vCPU is trapped before scheduling and marked `UNSCHEDULABLE` without causing deadlock or runner starvation.

**Evidence Filename / Repository Link**: `scheduler/algorithms.py`, `scheduler/graph.py`

---

### 5. API / Interface and Data Exchange

All interfaces are live, active FastAPI REST endpoints returning structured JSON.

#### Real Request & Response Samples

##### 1. User Authentication (`POST /auth/login`)
* **Request**:
  ```http
  POST /auth/login HTTP/1.1
  Host: localhost:8000
  Content-Type: application/json

  {"username_or_email": "demo_devops", "password": "demo123"}
  ```
* **Response (`HTTP 200 OK`)**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 2,
      "username": "demo_devops",
      "email": "demo@cicd-simulator.local",
      "full_name": "Alex Rivera",
      "role": "DevOps Engineer",
      "is_admin": false,
      "avatar_color": "#6366f1"
    }
  }
  ```

##### 2. Multi-Tenant Pipeline Retrieval (`GET /pipelines/`)
* **Request (Authenticated as `demo_devops`)**:
  ```http
  GET /pipelines/ HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer <demo_token>
  ```
* **Response (`HTTP 200 OK`)**:
  ```json
  [
    {"id": 5, "name": "Production-Hotfix", "owner_username": "demo_devops", "tasks": [4], "status": "idle"},
    {"id": 6, "name": "Core-Backend", "owner_username": "demo_devops", "tasks": [5], "status": "idle"},
    {"id": 7, "name": "Web-Frontend", "owner_username": "demo_devops", "tasks": [5], "status": "idle"}
  ]
  ```

##### 3. Mandatory Sign-In Protection (`POST /run/multi-all`)
* **Request (Unauthenticated)**:
  ```http
  POST /run/multi-all HTTP/1.1
  Host: localhost:8000
  Content-Type: application/json

  {"pipeline_ids": [5, 6, 7]}
  ```
* **Response (`HTTP 401 Unauthorized`)**:
  ```json
  {
    "detail": "Authentication token required"
  }
  ```

##### 4. Admin Telemetry Overview (`GET /admin/stats`)
* **Request (Authenticated as `admin_devops`)**:
  ```http
  GET /admin/stats HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer <admin_token>
  ```
* **Response (`HTTP 200 OK`)**:
  ```json
  {
    "total_users": 2,
    "total_pipelines": 3,
    "total_runs": 6,
    "total_runners": 3,
    "total_cpu_cores": 14.0,
    "total_ram_gb": 28.0,
    "busy_runners": 0
  }
  ```

**Evidence Filename / Repository Link**: `backend/routers/auth.py`, `backend/routers/scheduler.py`, `backend/routers/admin.py`

---

### 6. Database, State and Transaction Implementation

| Engine | Operation / State | Expected Change | Actual Observed Change | Proof |
| :--- | :--- | :--- | :--- | :--- |
| **E1** | Graph Validation State | Reject cyclic graph; accept valid DAG. | Cyclic input raises validation error; acyclic graph proceeds to Kahn's ordering. | Verified via unit test `TC-E1-02` |
| **E2** | Task Lifecycle States | `PENDING` $\rightarrow$ `READY` $\rightarrow$ `RUNNING` $\rightarrow$ `SUCCESS` / `FAILED` | Tasks remain `PENDING` until all prerequisite tasks finish with `SUCCESS`. Then move to `READY` and bind to runner. | Verified in `scheduler/simulator.py` execution logs |
| **E3** | Atomic ID Generation | Thread-safe sequential ID generation for documents. | MongoDB `counters` collection increments `seq` atomically using `$inc` operator without collisions. | Document IDs 1, 2, 3... generated cleanly |
| **E3** | Pipeline Ownership Isolation | Pipeline documents scoped to owner `user_id`. | Query `{user_id: current_user.id}` strictly isolates records. Only Admin can query across all owners. | Verified in `backend/routers/pipelines.py` |
| **E3** | Runner State Lock | Prevent runner double-allocation. | Runner marked `is_busy: true` upon task binding; released to `is_busy: false` upon completion. | Verified in `scheduler/runner_manager.py` |
| **E4** | UI Gantt Timeline State | Live visual clock and delayed trophy reveal. | Timer displays live running time (`⏱️ 2.4s running`); Trophy icon appears only when simulation completes (`phase === 'done'`). | Verified in `frontend/src/pages/RunScheduler.jsx` |

**Evidence Filename / Repository Link**: `backend/models.py`, `backend/database.py`

---

### 7. Concurrency, Security and Data Movement

| Mechanism | Engine | Implementation / Decision | Test or Proof |
| :--- | :--- | :--- | :--- |
| **Concurrency / Parallel Simulation** | E2 | Python `ThreadPoolExecutor(max_workers=4)` executes FCFS, Priority, Dependency-Aware, and Resource-Aware simulations simultaneously on dedicated workload copies. | Simulation completes in parallel; all 4 algorithm result sets compiled concurrently. |
| **Authentication & Password Security** | E3 | Passwords hashed using `bcrypt` with salt rounds = 12. JWT tokens signed using HMAC-SHA256 (`HS256`) with a 7-day expiration timestamp. | Passwords never stored in plaintext; invalid/expired tokens rejected with HTTP 401. |
| **Role-Based Access Control (RBAC)** | E3 / Backend | `require_admin` dependency inspects token payload and MongoDB `users` record. Administrative routes (`/admin/*`, `POST /runners/`) restricted to `is_admin: true`. | Non-admin user attempting runner provisioning receives `HTTP 403 Forbidden: Administrative privileges required`. |
| **Cross-Tenant Pipeline Protection** | E2 / E3 | `verify_pipeline_access()` checks that all requested pipeline IDs match `current_user["id"]` unless the caller has admin rights. | Tampering with foreign pipeline IDs returns `HTTP 403 Forbidden`. |
| **Input Validation** | E1 / E3 | Pydantic v2 request models validate field types, minimum password length ($\ge 4$), and non-empty task graphs before backend execution. | Malformed payloads return `HTTP 422 Unprocessable Entity`. |
| **Data Movement** | E2 / E3 / E4 | In-memory JSON serialization across REST endpoints. Zero-Copy is not claimed; standard copying is justified given sub-second simulation execution time. | Verified via network inspector and uvicorn access logs. |

**Evidence Filename / Repository Link**: `backend/routers/auth.py`, `backend/routers/scheduler.py`

---

### 8. Build, Run and Git Evidence

```
========================================================================
             CI/CD Pipeline Scheduler - Build & Run Evidence
========================================================================
Repository URL : https://github.com/mustafaa1717/CI-CD-PIPELINE-SCHEDULAR.git
Branch         : branch-1 (HEAD -> branch-4, origin/branch-1)
Commit Hash    : 4841942
Date           : 25-11-2026
========================================================================
```

#### Step 1: Start MongoDB
```powershell
mongod --dbpath "C:\data\db" --port 27017
# Output: [initandlisten] waiting for connections on port 27017
```

#### Step 2: Start FastAPI Backend Server
```powershell
cd "C:\Mini-project CI-CD\CI-CD-PIPELINE-SCHEDULAR"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
*Observed Terminal Output*:
```
INFO:     Will watch for changes in these directories: ['C:\\Mini-project CI-CD\\CI-CD-PIPELINE-SCHEDULAR']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process [24264]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

#### Step 3: Start React 19 + Vite 8 Frontend
```powershell
cd "C:\Mini-project CI-CD\CI-CD-PIPELINE-SCHEDULAR\frontend"
npm run dev -- --port 5173
```
*Observed Terminal Output*:
```
  VITE v8.3.0  ready in 469 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

#### Step 4: Frontend Production Build Check
```powershell
npm run build
```
*Observed Terminal Output*:
```
vite v8.3.0 building client environment for production...
✓ 2649 modules transformed.
dist/index.html                   0.45 kB │ gzip:   0.29 kB
dist/assets/index-Ddzl5Fez.css   28.77 kB │ gzip:   5.94 kB
dist/assets/index-BBQJTju2.js   960.81 kB │ gzip: 287.93 kB
✓ built in 1.78s
```

**Evidence Filename / Repository Link**: `start.bat`, `frontend/package.json`

---

### 9. Testing — Mandatory Test Case Register

| Test ID | Engine / Focus | Input / Precondition | Expected Result | Actual Observed Result | Pass / Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-E1-01** | E1 / Normal DAG | Tasks A, B, C with dependencies $A \rightarrow B \rightarrow C$. | Graph accepted; topological sort output $[A, B, C]$. | `is_cyclic() == False`; order $[A, B, C]$ verified. | **PASS** |
| **TC-E1-02** | E1 / Cyclic Input | Tasks with circular dependency $A \rightarrow B \rightarrow C \rightarrow A$. | Cycle detected by 3-color DFS; graph rejected with `ValueError`. | `is_cyclic() == True`; execution halted with cycle error. | **PASS** |
| **TC-E1-03** | E1 / Disconnected DAG | Independent tasks X, Y alongside dependency chain $A \rightarrow B$. | Both components correctly traversed; zero-in-degree tasks identified simultaneously. | Kahn's algorithm outputs valid sequence containing all 4 tasks. | **PASS** |
| **TC-E2-01** | E2 / 4-Algorithm Simulation | 3 conflict pipelines (14 tasks) scheduled across 3 heterogeneous runners. | All 4 heuristics run concurrently; metrics compiled; winner recommended. | Resource-Aware won with 3.62s makespan, 78.3% utilization. | **PASS** |
| **TC-E2-02** | E2 / Resource Boundary Check | Task requests 7 vCPU / 14 GB RAM; Candidate runner has 4 vCPU / 8 GB RAM. | Task blocked from incompatible runner; assigned only to compatible 8 vCPU runner. | Task allocated exclusively to `Runner-Gamma` (8C/16G). | **PASS** |
| **TC-E2-03** | E2 / Dependency Readiness Lock | Task T3 depends on T1 and T2. T1 finishes; T2 still executing. | T3 remains in `PENDING` state; never promoted to `READY` until T2 succeeds. | T3 scheduled only after both T1 and T2 emit `SUCCESS`. | **PASS** |
| **TC-E3-01** | E3 / Multi-Tenant Isolation | User `demo_devops` queries `/pipelines/`. | Returns only pipelines owned by `demo_devops` (IDs 5, 6, 7). | Exactly 3 owned pipelines returned; 0 foreign pipelines leaked. | **PASS** |
| **TC-E3-02** | E3 / Mandatory Sign-In | Unauthenticated request to `POST /run/multi-all`. | Blocked with `HTTP 401 Unauthorized`. | `HTTP 401: Authentication token required` returned. | **PASS** |
| **TC-E3-03** | E3 / Admin RBAC Enforcement | Non-admin user calls `POST /runners/` to add cluster node. | Blocked with `HTTP 403 Forbidden`. | `HTTP 403: Administrative privileges required` returned. | **PASS** |
| **TC-E4-01** | E4 / Gantt Winner Reveal | User executes multi-algorithm simulation on dashboard. | Trophy icon (🏆) remains hidden during run; reveals only upon completion. | Trophy rendered strictly when `phase === 'done'`. | **PASS** |
| **TC-E4-02** | E4 / Realistic Timer Display | Live Gantt replay running. | Elapsed running seconds displayed (`⏱️ 2.4s running`); no total spoiler (`/ 18.1s`). | Displays elapsed time live; final makespan shown only when completed. | **PASS** |
| **TC-E4-03** | E4 / 1-Click Admin Access | User clicks "1-Click Admin Login" on `/login`. | Authenticates as `admin_devops` and redirects directly to `/admin`. | Immediate sign-in with full Admin Console access. | **PASS** |

---

### 10. Testing — Test Execution Evidence

#### Automated API Test Script Output (`test_api.py`)
```
========================================================================
              CI/CD SCHEDULER SYSTEM VERIFICATION SUITE
========================================================================
1. Unauthenticated /pipelines/ status & count:
   --> Status: 200, Count: 0 (No pipelines leaked to guests)

2. Unauthenticated /run/multi-all status:
   --> Status: 401, Detail: {'detail': 'Authentication token required'}

3. Login as demo_devops:
   --> Status: 200, User: @demo_devops, Role: DevOps Engineer, is_admin: False

4. demo_devops GET /pipelines/:
   --> Status: 200, Pipelines: ['Production-Hotfix', 'Core-Backend', 'Web-Frontend'], IDs: [5, 6, 7]

5. demo_devops tries to provision runner (should be 403 Forbidden):
   --> Status: 403, Detail: {'detail': 'Administrative privileges required'}

6. Login as admin_devops:
   --> Status: 200, User: @admin_devops, Role: Admin, is_admin: True

7. admin_devops GET /admin/stats:
   --> Status: 200, Stats: {'total_users': 2, 'total_pipelines': 3, 'total_runs': 6, 'total_runners': 3, 'total_cpu_cores': 14.0, 'total_ram_gb': 28.0, 'busy_runners': 0}

8. admin_devops GET /admin/users:
   --> Status: 200, Users: [('admin_devops', 'Admin', 0, True), ('demo_devops', 'DevOps Engineer', 3, False)]

9. demo_devops executes /run/multi-all simulation:
   --> Status: 200, Winner: resource_aware, Multiplier: 5.0

========================================================================
              ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!
========================================================================
```

**Evidence Filename / Repository Link**: `test_api.py`, `backend/routers/scheduler.py`

---

### 11. Defect, Correction and Retest Register

| Defect ID | Observed Problem | Root Cause | Correction & Fix Reference | Retest ID / Result |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | Vite 8 / Rolldown build crashed: `Objects are not valid as a React child` on style props. | Rolldown parser flagged string concatenations inside inline JSX `style={{ }}` as AST syntax errors. | Refactored dynamic styles to module-scope helper functions (`hexAlpha`, `solidBorder`, `pxVal`, `pctVal`). (`Commit ca901c7`) | `npm run build` $\rightarrow$ **PASS** |
| **DEF-02** | PyMongo threw `ValueError: update only works with $ operators` on counter increment. | Attempted raw dictionary update without explicit atomic update operator. | Updated counter call to `db["counters"].find_one_and_update({"_id": col}, {"$inc": {"seq": 1}}, upsert=True)`. (`Commit 273c372`) | Document creation $\rightarrow$ **PASS** |
| **DEF-03** | React 19 warning: `Cannot update a component while rendering a different component`. | Called `setPhase('done')` inside the reducer updater of `setTabState(prev => ...)`. | Decoupled completion checking into a dedicated ref (`doneAlgosRef = useRef(new Set())`) outside the state updater. (`Commit 7081379`) | Console clean; 0 warnings $\rightarrow$ **PASS** |
| **DEF-04** | Trophy icon (🏆) and makespan total (`/ 18.1s`) displayed prematurely before simulation finished. | Condition evaluated `isBest` immediately upon API return; ticker rendered `${visualMakespan}` ahead of replay completion. | Conditioned trophy strictly on `phase === 'done'`; clock modified to show live elapsed seconds (`⏱️ 2.4s running`). (`Commit 7081379`) | `TC-E4-01`, `TC-E4-02` $\rightarrow$ **PASS** |
| **DEF-05** | Form placeholder text collided with left input icons in Sign Up and Login pages. | `index.css` had `padding: 10px 14px !important;` on global `input` selector, overriding inline `paddingLeft: 40px`. | Removed `!important` from base padding; added dedicated `.input-icon-left` (`padding-left: 44px !important`) and `pointer-events: none` on icon containers. (`Commit 4841942`) | Input fields render clean gap $\rightarrow$ **PASS** |

**Evidence Filename / Repository Link**: Git commit history (`git log -n 5`)

---

### 12. Engine Readiness and Remaining Work

| Engine ID | Works Now | Mocked / Incomplete | Not Yet Tested | Sprint 3 Next Steps |
| :--- | :--- | :--- | :--- | :--- |
| **E1** | DAG adjacency builder, 3-color DFS cycle detector, and Kahn's topological sort fully functional. | None. Real implementation; zero mocks. | None. Edge cases verified via unit tests. | Advanced graph export (Mermaid/DOT) and live dependency graph re-layout. |
| **E2** | All 4 scheduling heuristics (FCFS, Priority, Dep-Aware, Resource-Aware), heterogeneous capacity matching, and parallel execution fully working. | None. Real implementation; zero mocks. | None. Conflict benchmark dataset verified. | Dynamic task preemption on high-priority burst arrivals and real-time runner agent telemetry. |
| **E3** | MongoDB persistence, atomic counters, JWT auth, multi-tenant isolation, and admin control endpoints fully functional. | None. Real MongoDB instance; zero mocks. | None. API verification suite executed. | Refresh token rotation and user webhook notifications. |
| **E4** | React 19 + Vite 8 dashboard, live Gantt replay visualizer, 1-click admin login, and Admin Control Center fully working. | None. Real UI interacting with live backend. | None. UI flows verified. | Downloadable PDF/CSV benchmark reports and real-time WebSocket runner telemetry. |

**Evidence Filename / Repository Link**: `C:\Mini-project CI-CD\CI-CD-PIPELINE-SCHEDULAR`

---

### 13. Requirements $\rightarrow$ Code $\rightarrow$ Partial Test Mapping

| Functional Requirement (FR) | Engine / Code Implementation Reference | Test ID | Observed Test Result | Traceability Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01**: DAG Dependency Representation & Cycle Detection | `scheduler/graph.py`<br>`Graph.is_cyclic()` | `TC-E1-01`<br>`TC-E1-02` | Normal DAG accepted; cyclic input rejected with cycle flag. | **Verified (Pass)** |
| **FR-02**: Topological Task Ordering & Ready Queue | `scheduler/graph.py`<br>`scheduler/ready_finder.py` | `TC-E1-01`<br>`TC-E1-03` | Kahn's algorithm outputs dependency-valid task sequence. | **Verified (Pass)** |
| **FR-03**: Multi-Heuristic Comparative Scheduling | `scheduler/algorithms.py`<br>`backend/services/scheduler_service.py` | `TC-E2-01` | All 4 algorithms simulate identical workloads concurrently. | **Verified (Pass)** |
| **FR-04**: Heterogeneous Runner Capacity Matching | `scheduler/runner_manager.py`<br>`RunnerManager.find_best_runner()` | `TC-E2-02` | Tasks assigned only to runners meeting CPU & RAM thresholds. | **Verified (Pass)** |
| **FR-05**: Automated Best-Algorithm Recommendation | `backend/services/scheduler_service.py`<br>`run_multi_all_simulation()` | `TC-E2-01` | Resource-Aware identified and recommended (3.62s vs 4.23s). | **Verified (Pass)** |
| **FR-06**: MongoDB Document Persistence | `backend/database.py`<br>`backend/models.py` | `TC-E3-01` | Pipelines, runners, runs, and users persisted in MongoDB. | **Verified (Pass)** |
| **FR-07**: Multi-Tenant Isolation & Mandatory Auth | `backend/routers/auth.py`<br>`backend/routers/pipelines.py` | `TC-E3-01`<br>`TC-E3-02` | Unauthenticated execution blocked; users see only own pipelines. | **Verified (Pass)** |
| **FR-08**: Admin Governance & Cluster Management | `backend/routers/admin.py`<br>`frontend/src/pages/AdminDashboard.jsx` | `TC-E3-03`<br>`TC-E4-03` | Admins can inspect/delete all pipelines and manage users. | **Verified (Pass)** |
| **FR-09**: Synchronized Gantt Execution Replay | `frontend/src/pages/RunScheduler.jsx`<br>`<GanttChart />` | `TC-E4-01`<br>`TC-E4-02` | Replay animates tasks live; trophy displayed only at completion. | **Verified (Pass)** |

**Evidence Filename / Repository Link**: `PROJECT_DOCUMENTATION.md`

---

### 14. Weekly Progress Record — Weeks 10–13

| Academic Week | Expected Output | Student Completed Evidence / Status |
| :--- | :--- | :--- |
| **Week 10** | Sprint 1 Handoff, Sprint 2 Backlog, Core Engine Migration | Migrated persistence from SQLite to MongoDB (`cicd_scheduler`). Implemented 3-color DFS cycle detection and Kahn's topological sort in `scheduler/graph.py`. Established base FastAPI routes. |
| **Week 11** | Core Engine Increments & Heterogeneous Runner Matching | Developed 4 comparative heuristic algorithms (FCFS, Priority, Dependency-Aware, Resource-Aware) in `scheduler/algorithms.py`. Created heterogeneous runner pool (`Runner-Alpha`, `Runner-Beta`, `Runner-Gamma`). Formulated conflict benchmark workload. |
| **Week 12** | Multi-Tenancy, Authentication & Parallel Execution | Built Bcrypt + JWT authentication system (`backend/routers/auth.py`). Enforced multi-tenant pipeline ownership and mandatory auth for execution. Implemented `ThreadPoolExecutor` concurrent 4-algorithm simulation engine. |
| **Week 13** | Admin Control Center, UI Refinements & Gate 3 Evidence Pack | Built Admin Dashboard (`/admin`), 1-Click Fast Access logins, fixed Gantt replay timer and trophy reveal logic, resolved CSS input icon padding conflicts, executed comprehensive automated test suite (`test_api.py`), and completed handbook. |

---

### 15. Gate 3 / Review 4 Checklist

| Review Check | Yes / No / N/A | Evidence Citation |
| :--- | :---: | :--- |
| Approved Sprint 1 design is referenced and changes documented | **YES** | Section 2: Migration to MongoDB and concurrent simulation documented with architectural justification. |
| Working core engine increment covering the mandatory approved responsibility is runnable and tested for each assigned student | **YES** | E1 (Mustafa), E2 (Mohammed Ansar), E3 (Nandan), and E4 (Vihaan) verified runnable and passing. |
| Engine run steps and actual outputs provided | **YES** | Section 8: Exact commands and live terminal outputs for MongoDB, FastAPI, Vite, and build provided. |
| Normal, boundary and failure partial tests executed | **YES** | Section 9: 12 comprehensive test cases spanning normal, boundary, and failure conditions executed. |
| Additional state/concurrency/security/API tests completed where applicable | **YES** | Section 5 & 7: JWT authentication, RBAC, ThreadPool concurrency, and MongoDB states verified. |
| Actual results, failures, corrections and retests recorded | **YES** | Section 11: 5 verified defects, root causes, fix commits, and passing retests recorded. |
| Git history and requirement-to-test mapping available | **YES** | Section 8 & 13: Repository URL, commit `4841942`, and FR-to-test traceability matrix detailed. |
| Mocks, deferred work and Sprint 3 dependencies clearly listed | **YES** | Section 12: Zero mocks; real engines operational; Sprint 3 stretch goals specified. |
| Each student can explain and demonstrate their own engine | **YES** | Ready for live demonstration across all 4 student engine responsibilities. |

**Gate 3 Team Outcome**: **PASS (All Criteria Satisfied)**

---

### 16. One-Page Example — CI/CD Pipeline Scheduler Engine (Team 18)

| Evidence Category | Team 18 Implementation Entry |
| :--- | :--- |
| **Functional Requirement** | **FR-04**: Prevent runner CPU/RAM over-allocation during concurrent pipeline execution. |
| **Implementation** | `scheduler/runner_manager.py`: `find_best_runner()` scans available cluster nodes, validates $CPU_{req} \le CPU_{node}$ and $RAM_{req} \le RAM_{node}$, and assigns the candidate with minimum leftover resource slack. |
| **Partial Test — Normal Case** | Pipeline task requiring 2 vCPU / 4 GB RAM $\rightarrow$ Bound to `Runner-Alpha` (2C/4G); marked `RUNNING`; executed in 1.2s; released to cluster pool. |
| **Partial Test — Boundary Case** | Large compilation task requiring 7 vCPU / 14 GB RAM $\rightarrow$ Rejected by `Runner-Alpha` (2C/4G) and `Runner-Beta` (4C/8G); successfully matched with `Runner-Gamma` (8C/16G). |
| **Partial Test — Concurrency Case** | Simultaneous tasks from `Production-Hotfix` and `Core-Backend` competing for CPU $\rightarrow$ High-priority hotfix tasks prioritized; compute-heavy backend tasks queued until resources free without starvation. |
| **Defect / Retest** | Initial implementation allowed string concatenation syntax errors in Gantt styling; refactored with module-scope style helpers (`commit ca901c7`); retest passed with zero browser warnings. |
| **Sprint 3 Next Steps** | Dynamic real-time runner agent heartbeats via WebSockets and automated build artifact caching. |
