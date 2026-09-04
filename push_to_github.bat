@echo off
title Push to GitHub
echo ========================================================
echo        Push FeedbackHub to GitHub Repository
echo ========================================================
echo.

set PYTHON_CMD=python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    set PYTHON_CMD=py
)

%PYTHON_CMD% push_to_github.py
pause
