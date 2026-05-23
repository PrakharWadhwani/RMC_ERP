@echo off
title Rainbow ERP Server Setup
echo ==================================================
echo   Installing/Updating Missing Local Python Packages
echo ==================================================
cd backend
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install python-jose passlib[bcrypt] watchfiles

echo.
echo ==================================================
echo   Starting Local Server via SQLite + CSV Sync Engine
echo ==================================================
start /b python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
echo Backend server is initializing on port 8000...
echo.
echo ==================================================
echo   Launching Secure Public Tunnel to Vercel Frontend
echo ==================================================
echo (Skipping Ngrok until package installation is verified)
:: ngrok http --url=YOUR_PERMANENT_STATIC_DOMAIN_HERE.ngrok-free.app 8000
pause