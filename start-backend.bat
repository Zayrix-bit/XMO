@echo off
echo Starting Backend Server...
uvicorn app.main:app --reload
pause
