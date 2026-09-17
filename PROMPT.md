# 🟡 BRANCH-2 — Backend + Database
## Paste this into your Antigravity chat to get started.

---

You are working on the BACKEND + DATABASE for our mini project:
"Dependency & Resource-Aware CI/CD Pipeline Scheduler" (Team 18, CSE Dept).

## What The Project Is:
A web-based CI/CD Pipeline Scheduling SIMULATOR. Users define dummy pipelines
(Build, Test, Deploy tasks) with dependencies, priorities, and resource needs.
The scheduler virtually simulates which task runs on which runner, in what order,
using different scheduling strategies. NO real code compiles. NO real tests run.
Execution is SIMULATED using task duration + success/failure flags.

## Your Module: Backend API + Database (branch-2)
You are the bridge between the Scheduler Engine (branch-1) and the Frontend (branch-3).

## Tech Stack:
- Backend Framework: Python + FastAPI
- Database: SQLite using SQLAlchemy ORM
- API Style: REST

## What You Need to Build:

### 1. Database Schema (SQLAlchemy models)
Tables:
- pipelines: id, name, created_at, status
- tasks: id, pipeline_id, name, duration, priority, required_cpu, required_ram,
         status, depends_on (JSON list of task ids)
- runners: id, name, cpu_cores, ram_gb, is_busy
- pipeline_runs: id, pipeline_id, algorithm_used, start_time, end_time,
                 makespan, avg_wait_time, runner_utilization, status
- task_executions: id, run_id, task_id, runner_id, start_time, end_time,
                   status, wait_time

### 2. REST API Endpoints:

#### Pipelines:
- POST   /pipelines             → Create new pipeline with tasks + dependencies
- GET    /pipelines             → List all pipelines
- GET    /pipelines/{id}        → Get pipeline details with tasks
- DELETE /pipelines/{id}        → Delete pipeline

#### Tasks:
- POST   /pipelines/{id}/tasks  → Add task to pipeline
- GET    /pipelines/{id}/tasks  → Get all tasks of a pipeline

#### Runners:
- POST   /runners               → Register a runner (name, cpu, ram)
- GET    /runners               → List all runners with current status
- DELETE /runners/{id}          → Remove a runner

#### Scheduler:
- POST   /run/{pipeline_id}     → Start a pipeline run
  Body: { "algorithm": "fcfs" | "priority" | "dependency_aware" | "resource_aware" }
- GET    /runs                  → List all past pipeline runs
- GET    /runs/{run_id}         → Get full run details + task execution timeline
- GET    /runs/{run_id}/metrics → Get metrics (makespan, wait time, utilization)
- GET    /runs/{run_id}/status  → Live status of running pipeline

#### Comparison:
- POST   /compare/{pipeline_id} → Run same pipeline with ALL 4 algorithms,
                                   return side-by-side metrics for dashboard

### 3. Integration with Scheduler Engine
- Import the scheduler/ module (branch-1 teammate's code)
- Call simulator.run_pipeline(pipeline, runners, algorithm)
- Save results to DB

### 4. CORS Setup
- Enable CORS for all origins (Frontend teammate needs this)

## File Structure:
backend/
  main.py                    # FastAPI app entry point
  database.py                # DB connection + SQLAlchemy setup
  models.py                  # SQLAlchemy table models
  schemas.py                 # Pydantic request/response schemas
  routers/
    pipelines.py             # Pipeline CRUD routes
    runners.py               # Runner routes
    scheduler.py             # Run + compare routes
  services/
    scheduler_service.py     # Calls scheduler engine, saves results to DB

## Git:
- You are on branch-2
- Repo: https://github.com/mustafaa1717/CI-CD-PIPELINE-SCHEDULAR.git
- Mock the scheduler functions first, replace with real ones when branch-1 merges
- Push regularly, raise PR to main when complete

## Start by:
1. Set up FastAPI project + SQLite DB
2. Create database models
3. Build pipeline + task CRUD endpoints
4. Then runner endpoints
5. Then scheduler run endpoint (mock the scheduler first if branch-1 not ready)
