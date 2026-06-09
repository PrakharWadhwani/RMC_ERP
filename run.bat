@echo off
title Rainbow ERP — Full Stack Installer + Chrome Auto-Sync Framework
setlocal enabledelayedexpansion
set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set CLIENT_DIR=%ROOT_DIR%client

:: ============================================================
::  PHASE 1 — Git Auto-Update
:: ============================================================
echo ==================================================
echo   Phase 1: Checking for Developer Updates via Git
echo ==================================================

set OLD_COMMIT=NONE
set NEW_COMMIT=NONE

where git >nul 2>nul
if %errorlevel% equ 0 (
    echo Syncing local repository with remote...
    for /f "delims=" %%i in ('git rev-parse HEAD 2^>nul') do set OLD_COMMIT=%%i
    call git pull
    for /f "delims=" %%i in ('git rev-parse HEAD 2^>nul') do set NEW_COMMIT=%%i

    if "!OLD_COMMIT!" neq "!NEW_COMMIT!" (
        echo [UPDATE] New code pulled from repository.
    ) else (
        echo [OK] Already up to date.
    )
) else (
    echo [WARNING] Git is not installed. Skipping auto-update...
)
echo.

:: ============================================================
::  PHASE 2 — Python Backend Dependencies
:: ============================================================
echo ==================================================
echo   Phase 2: Installing Python Backend Dependencies
echo ==================================================
cd /d "%BACKEND_DIR%"
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
pip install python-jose passlib[bcrypt] watchfiles --quiet
echo [OK] Backend dependencies installed.
echo.

:: ============================================================
::  PHASE 3 — Frontend Dependencies (npm install)
:: ============================================================
echo ==================================================
echo   Phase 3: Installing Frontend Dependencies (npm)
echo ==================================================
cd /d "%CLIENT_DIR%"

if not exist "node_modules" (
    echo [ALERT] node_modules missing. Running npm install...
    call npm install
) else (
    echo [OK] node_modules exists. Skipping Electron install...
)
echo.

:: ============================================================
::  PHASE 4 — Next.js Production Build
:: ============================================================
echo ==================================================
echo   Phase 4: Building Next.js Production Bundle
echo ==================================================
cd /d "%CLIENT_DIR%"

if "!OLD_COMMIT!" neq "!NEW_COMMIT!" (
    if "!OLD_COMMIT!" neq "NONE" (
        echo [UPDATE DETECTED] Purging stale .next build cache...
        if exist ".next" rmdir /s /q ".next"
    )
)

echo Compiling Next.js production build...
echo This may take 1-3 minutes. Please wait...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Next.js build failed! Check errors above.
    pause
    exit /b 1
)
echo [OK] Production build completed successfully.
echo.

:: ============================================================
::  PHASE 5 — Create Desktop Shortcut via VBScript (Auto-Sync Hook)
:: ============================================================
echo ==================================================
echo   Phase 5: Creating Interactive Desktop Shortcut
echo ==================================================

set LAUNCHER_BAT=%ROOT_DIR%launch_rainbow_erp.bat

:: Create the runtime controller engine script
(
    echo @echo off
    echo title Rainbow ERP - Live Terminal Controller
    echo.
    echo echo [1/3] Starting Python API Server via Python Module...
    echo cd /d "%BACKEND_DIR%"
    echo start "Rainbow ERP Backend API" python -m uvicorn main:app --host 127.0.0.1 --port 8000
    echo.
    echo echo [2/3] Starting Next.js Web Server...
    echo cd /d "%CLIENT_DIR%"
    echo start "Rainbow ERP Frontend" /b npm run start
    echo.
    echo echo [3/3] Waiting for servers to initialize...
    echo timeout /t 6 /nobreak ^>nul
    echo.
    echo echo Launching Google Chrome Application Mode...
    echo start "" "chrome.exe" --app=http://localhost:3000
    echo cls
    echo ============================================================
    echo   RAINBOW ERP IS RUNNING normally inside Google Chrome.
    echo ============================================================
    echo.
    echo   DO NOT CLOSE THIS BLACK WINDOW UNTIL YOU ARE DONE WORKING.
    echo.
    echo   When you are completely finished and ready to close the app:
    echo   Press ANY KEY in this terminal to backup data and exit.
    echo.
    echo ============================================================
    echo.
    echo pause ^>nul
    echo.
    echo echo Syncing local changes to Google Cloud Sheets...
    echo cd /d "%BACKEND_DIR%"
    echo python drive_sync.py --push
    echo.
    echo echo Terminating background app processes...
    echo taskkill /f /im node.exe ^>nul 2^>nul
    echo taskkill /f /im python.exe ^>nul 2^>nul
    echo taskkill /f /im chrome.exe /fi "WINDOWTITLE eq Rainbow ERP*" ^>nul 2^>nul
    echo exit
) > "%LAUNCHER_BAT%"

:: Build a temporary VBScript that creates the absolute desktop .lnk file
set VBS_FILE=%TEMP%\create_shortcut_rainbow_erp.vbs
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo strDesktop = WshShell.SpecialFolders^("Desktop"^)
    echo Set oShortcut = WshShell.CreateShortcut^(strDesktop ^& "\Rainbow ERP.lnk"^)
    echo oShortcut.TargetPath = "%LAUNCHER_BAT%"
    echo oShortcut.WorkingDirectory = "%ROOT_DIR%"
    echo oShortcut.WindowStyle = 1
    echo oShortcut.Description = "Launch Rainbow ERP Application"
    echo If CreateObject^("Scripting.FileSystemObject"^).FileExists^("%CLIENT_DIR%\public\icon.ico"^) Then
    echo      oShortcut.IconLocation = "%CLIENT_DIR%\public\icon.ico"
    echo End If
    echo oShortcut.Save
) > "%VBS_FILE%"

:: Execute the VBScript to place the shortcut on the desktop
cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%" 2>nul

if exist "%USERPROFILE%\Desktop\Rainbow ERP.lnk" (
    echo [OK] Desktop shortcut "Rainbow ERP" created successfully!
) else (
    echo [WARNING] Shortcut creation may have failed.
)
echo.


:: ============================================================
::  PHASE 6 — Run Database Sync & Launch the Application
:: ============================================================
echo ==================================================
echo   Phase 6: Syncing Database to Cloud & Launching App
echo ==================================================
echo Running Google Drive/Sheets Cloud Sync...
cd /d "%BACKEND_DIR%"
python drive_sync.py --push
if %errorlevel% neq 0 (
    echo [WARNING] Cloud sync finished with errors or was skipped.
) else (
    echo [OK] Cloud sync completed successfully.
)
echo.

echo ==================================================
echo   Rainbow ERP is now completely configured!
echo ==================================================
echo.
echo A desktop shortcut "Rainbow ERP" has been placed on your Desktop.
echo Please double-click the shortcut on the Desktop to start the app!
echo.
pause