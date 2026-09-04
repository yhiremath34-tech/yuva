@echo off
title FeedbackHub Admin Portal Server
echo =========================================================
echo    Starting FeedbackHub Admin Portal & API Key Server...
echo =========================================================
echo.

:: Detect Python
set PYTHON_CMD=python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    set PYTHON_CMD=py
    where py >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Python not found in PATH. Please install Python 3 or add it to PATH.
        pause
        exit /b 1
    )
)

echo Starting server on http://localhost:8000 ...
start "" http://localhost:8000

%PYTHON_CMD% server.py

pause
