@echo off
chcp 65001 >nul
echo ====================================
echo Starting Hotster Frontend Server...
echo ====================================
cd /d "%~dp0frontend"
npm.cmd run dev
if errorlevel 1 (
    echo.
    echo Failed to start frontend server!
    echo Make sure Node.js and dependencies are installed.
    echo Try running "npm install" in the frontend folder first.
    pause
)
