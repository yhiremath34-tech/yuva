@echo off
title Deploy to Vercel
echo ========================================================
echo         Deploy FeedbackHub to Vercel Hosting
echo ========================================================
echo.

set PYTHON_CMD=python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    set PYTHON_CMD=py
)

%PYTHON_CMD% deploy_vercel.py
pause
