# 🟢 BRANCH-3 — Frontend + Dashboard
## Paste this into your Antigravity chat to get started.

---

You are working on the FRONTEND + DASHBOARD for our mini project:
"Dependency & Resource-Aware CI/CD Pipeline Scheduler" (Team 18, CSE Dept).

## What The Project Is:
A web-based CI/CD Pipeline Scheduling SIMULATOR. Users define dummy pipelines
(Build, Test, Deploy tasks) with dependencies, priorities, and resource needs.
The scheduler virtually simulates which task runs on which runner, in what order,
using different scheduling strategies. NO real code compiles. NO real tests run.
Execution is SIMULATED using task duration + success/failure flags.

## Your Module: Frontend Dashboard (branch-3)
You are building what the USER SEES — the entire visual interface.

## Tech Stack:
- React (with Vite)
- CSS: Tailwind CSS
- Charts: Recharts (bar charts, comparisons)
- Graph Visualization: React Flow (for DAG visualization)
- HTTP: Axios (to call Backend APIs)
- Backend URL: http://localhost:8000

## What You Need to Build:

### Page 1 — Pipeline Builder
- Form to create a new pipeline (pipeline name)
- Add tasks: name, duration (seconds), priority (1-10), CPU required, RAM required
- Define dependencies: dropdown "this task depends on" (select from added tasks)
- Visual dependency graph preview using React Flow (live DAG as user adds deps)
- Show error if cycle detected (from backend response)
- Submit → POST to /pipelines

### Page 2 — Runner Setup
- Form to add runners: name, CPU cores, RAM GB
- List of current runners with status (Busy=red / Free=green badges)
- Delete runner option

### Page 3 — Run Scheduler
- Select pipeline from dropdown
- Select algorithm: FCFS / Priority / Dependency-Aware / Resource-Aware
- "Run Pipeline" button → POST to /run/{pipeline_id}
- Live status panel:
  - Each task as a card, color-coded:
    PENDING=grey | READY=blue | RUNNING=yellow+animated | SUCCESS=green | FAILED=red
  - Which runner each task is assigned to
  - Progress bar per task (based on duration)
- Poll GET /runs/{run_id}/status every second for live updates

### Page 4 — Algorithm Comparison Dashboard (MOST IMPORTANT ⭐)
- Select a pipeline
- Click "Compare All Algorithms" → POST to /compare/{pipeline_id}
- Side-by-side comparison for FCFS, Priority, Dependency-Aware, Resource-Aware
- Bar charts (Recharts) comparing:
  - Total Makespan (seconds)
  - Average Task Waiting Time (seconds)
  - Runner Utilization %
- Highlight the BEST algorithm per metric
- Gantt-style execution timeline for each algorithm

### Page 5 — Run History
- Table of all past pipeline runs
- Columns: Pipeline Name, Algorithm, Start Time, Makespan, Status
- Click row → view full run details

## UI Design:
- Clean modern dark or light theme
- Color coding: PENDING=grey, READY=blue, RUNNING=amber, SUCCESS=green, FAILED=red
- Responsive layout, loading spinners, toast notifications

## File Structure:
frontend/
  src/
    components/
      PipelineBuilder.jsx
      RunnerSetup.jsx
      SchedulerRunner.jsx
      ComparisonDashboard.jsx   ← Most important
      RunHistory.jsx
      TaskCard.jsx
      DependencyGraph.jsx       ← React Flow DAG visualization
    services/
      api.js                    ← All Axios API calls
    App.jsx
    main.jsx
  index.html
  tailwind.config.js

## Git:
- You are on branch-3
- Repo: https://github.com/mustafaa1717/CI-CD-PIPELINE-SCHEDULAR.git
- Mock API responses first, plug in real backend later
- Push regularly, raise PR to main when complete

## Start by:
1. Set up React + Vite + Tailwind
2. Build Pipeline Builder page first
3. Then Runner Setup
4. Then Scheduler Runner with live status
5. Algorithm Comparison Dashboard last (needs backend data)
