@echo off
echo =====================================================
echo   CI/CD Pipeline Scheduler - Comparative Analysis
echo =====================================================
echo.

echo [1/2] Starting Backend (FastAPI on port 8000)...
start "CI/CD Backend" cmd /k "cd /d %~dp0 && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend (Vite React App on port 5173)...
start "CI/CD Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =====================================================
echo  Backend  :  http://localhost:8000
echo  Frontend :  http://localhost:5173
echo  API Docs :  http://localhost:8000/docs
echo =====================================================
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
