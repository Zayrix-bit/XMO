@echo off
chcp 65001 >nul
echo ====================================
echo Starting Hotster Backend Server...
echo ====================================
cd /d "%~dp0"
uvicorn app.main:app --reload
if errorlevel 1 (
    echo.
    echo Failed to start backend server!
    echo Make sure Python and dependencies are installed.
    pause
)
