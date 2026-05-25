@echo off
title Rainbow ERP Server Setup
set ROOT_DIR=%~dp0

echo ==================================================
echo   Installing/Updating Missing Local Python Packages
echo ==================================================
cd /d "%ROOT_DIR%\backend"
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install python-jose passlib[bcrypt] watchfiles

echo.
echo ==================================================
echo   Starting Local Server via SQLite + CSV Sync Engine
echo ==================================================
:: Changed --host to 0.0.0.0 so it listens globally on your machine
start /b python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
echo Backend server is initializing on port 8000...
echo.
echo ==================================================
echo   Launching Secure Public Tunnel to Vercel Frontend
echo ==================================================

cd /d "%ROOT_DIR%"

:: 1. Save your authtoken securely
ngrok config add-authtoken 3EBRQ3xWQDzJJsP3aNnomhk2lG9_7Yeep3rJex7LsRx448zf

:: 2. Explicitly target 127.0.0.1 instead of letting it guess 'localhost'
start "Ngrok Tunnel" ngrok http --url=regally-compactly-baffling.ngrok-free.dev 127.0.0.1:8000

echo Tunnel launched successfully!
echo.
pause