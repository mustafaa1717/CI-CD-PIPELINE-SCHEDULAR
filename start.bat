@echo off
echo ===================================================
echo    Starting CI/CD Pipeline Scheduler Simulator
echo ===================================================
echo.

echo [1/2] Starting Backend (FastAPI on port 8000)...
start "CI/CD Backend" cmd /k "uvicorn backend.main:app --reload"

echo [2/2] Starting Frontend (Vite React App)...
start "CI/CD Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Done! The servers are running in separate windows.
echo Close those windows to stop the servers.
pause
