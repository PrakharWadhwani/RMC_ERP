@echo off
title Rainbow ERP Server Setup (Production Local with Auto-Sync)
set ROOT_DIR=%~dp0

:: CONFIGURATION: Adjusted to match your directory name 'client'
set FRONTEND_DIR=%ROOT_DIR%\client

echo ==================================================
echo   Checking for Developer Updates via GitHub
echo ==================================================
:: Forces git to check your repository and download any code modifications
where git >nul 2>nul
if %errorlevel% equ 0 (
    echo Syncing local repository branches with remote master...
    
    :: Store old commit ID to evaluate if files actually change
    for /f "delims=" %%i in ('git rev-parse HEAD') do set OLD_COMMIT=%%i
    
    call git pull
    
    :: Capture new commit ID after the pull executes
    for /f "delims=" %%i in ('git rev-parse HEAD') do set NEW_COMMIT=%%i
) else (
    echo [WARNING] Git CLI tool not detected. Skipping automatic update pass...
)

echo.
echo ==================================================
echo   Installing/Updating Missing Local Python Packages
echo ==================================================
cd /d "%ROOT_DIR%\backend"
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install python-jose passlib[bcrypt] watchfiles

echo.
echo ==================================================
echo   Starting Local Backend (FastAPI + SQLite)
echo ==================================================
start "FastAPI Backend" /min python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
echo Backend server initializing on http://127.0.0.1:8000...
echo.

echo ==================================================
echo   Checking Frontend Package Dependencies (NPM)
echo ==================================================
cd /d "%FRONTEND_DIR%"

:: Check if node_modules folder exists. If missing, run npm install automatically.
if not exist "node_modules" (
    echo [ALERT] node_modules folder is missing.
    echo Running 'npm install' to fetch required frontend packages...
    echo Please wait, this could take a moment depending on internet speed...
    call npm install
) else (
    echo Frontend dependencies are already installed. Skipping installer...
)

echo.
echo ==================================================
echo   Checking / Preparing Production Build of Frontend
echo ==================================================
:: If your Git Pull brought down modifications, force clear the Next.js production build cache
if "%OLD_COMMIT%" neq "%NEW_COMMIT%" (
    echo [UPDATE DETECTED] New updates fetched from GitHub. Purging old build cache...
    if exist ".next" rmdir /s /q ".next"
)

:: Check if the production build folder (.next) exists or if it was just purged above
if not exist ".next" (
    echo No production build found. Building the application now...
    echo This might take a minute or two, please wait...
    call npm run build
) else (
    echo Existing optimized build detected. Skipping compile stage...
)

echo.
echo ==================================================
echo   Starting Optimized Local Production Server
echo ==================================================
:: 'npm run start' boots up the production build on port 3000
start "NextJS Production Client" /min npm run start
echo Frontend client running in optimized production mode on http://localhost:3000...
echo.

echo ==================================================
echo   Launching App Interface inside Google Chrome
echo ==================================================
echo Giving local production server 3 seconds to spin up...
timeout /t 3 /nobreak >nul

start chrome http://localhost:3000

echo Full Stack Optimized Production Environment Running!
echo.
pause