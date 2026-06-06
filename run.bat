@echo off
title Rainbow ERP — Full Stack Installer + Desktop Shortcut Creator
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
    echo [OK] node_modules exists.
    :: Always ensure electron is present since it was recently added
    call npm install electron --save-dev --quiet 2>nul
)
echo.

:: ============================================================
::  PHASE 4 — Next.js Production Build
:: ============================================================
echo ==================================================
echo   Phase 4: Building Next.js Production Bundle
echo ==================================================
cd /d "%CLIENT_DIR%"

:: If git pulled new code, purge the old build cache
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
::  PHASE 5 — Create Desktop Shortcut via VBScript
:: ============================================================
echo ==================================================
echo   Phase 5: Creating Desktop Shortcut - Rainbow ERP
echo ==================================================

:: Build a temporary VBScript that creates a Windows shortcut
set VBS_FILE=%TEMP%\create_shortcut_rainbow_erp.vbs

:: The shortcut will launch the Electron app in a hidden window via a small
:: intermediate batch wrapper so the user never sees a dangling cmd.exe.

:: First, create the silent launcher batch file
set LAUNCHER_BAT=%ROOT_DIR%launch_rainbow_erp.bat
(
    echo @echo off
    echo cd /d "%CLIENT_DIR%"
    echo start "" /b npx electron .
) > "%LAUNCHER_BAT%"

:: Now create the VBScript that generates the .lnk shortcut
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo strDesktop = WshShell.SpecialFolders^("Desktop"^)
    echo Set oShortcut = WshShell.CreateShortcut^(strDesktop ^& "\Rainbow ERP.lnk"^)
    echo oShortcut.TargetPath = "%LAUNCHER_BAT%"
    echo oShortcut.WorkingDirectory = "%ROOT_DIR%"
    echo oShortcut.WindowStyle = 7
    echo oShortcut.Description = "Launch Rainbow ERP Desktop Application"
    echo If CreateObject^("Scripting.FileSystemObject"^).FileExists^("%CLIENT_DIR%\public\icon.ico"^) Then
    echo     oShortcut.IconLocation = "%CLIENT_DIR%\public\icon.ico"
    echo End If
    echo oShortcut.Save
) > "%VBS_FILE%"

:: Execute the VBScript to place the shortcut
cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%" 2>nul

if exist "%USERPROFILE%\Desktop\Rainbow ERP.lnk" (
    echo [OK] Desktop shortcut "Rainbow ERP" created successfully!
) else (
    echo [WARNING] Shortcut creation may have failed. You can run the app manually:
    echo           cd client ^&^& npm run electron
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

echo Starting Electron application frame...
echo The app window will appear once all servers are ready.
echo.

cd /d "%CLIENT_DIR%"
start "" /b npm run electron

echo.
echo ==================================================
echo   Rainbow ERP is now running!
echo   Close the app window to shut down all servers.
echo ==================================================
echo.
echo You can close this terminal. The app runs independently.
echo A desktop shortcut "Rainbow ERP" has been placed on your Desktop
echo for future launches without re-running this installer.
echo.
pause