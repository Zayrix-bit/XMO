@echo off
chcp 65001 >nul
echo ====================================
echo Starting Hotster (Backend + Frontend)
echo ====================================
echo.

:: Change to project root directory
cd /d "%~dp0"

:: Start Backend in new window
echo Starting Backend Server...
start "Hotster Backend" cmd /k "uvicorn app.main:app --reload"

:: Wait a second to let backend start first
timeout /t 2 /nobreak >nul

:: Start Frontend in new window
echo Starting Frontend Server...
cd frontend
start "Hotster Frontend" cmd /k "npm.cmd run dev"

echo.
echo ====================================
echo Both servers are starting!
echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:5173 (or similar)
echo ====================================
pause
