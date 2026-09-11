@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title YiHuan AI Assistant

echo ==============================================
echo      YiHuan AI Assistant - Portable Edition
echo ==============================================
echo.

set "APP_DIR=%~dp0"

REM === Load .env ===
if exist "%APP_DIR%.env" (
    echo [INFO] Loading .env configuration...
    for /f "usebackq tokens=1,* delims==" %%a in ("%APP_DIR%.env") do (
        set "%%a=%%b"
    )
    echo [OK] Configuration loaded
) else (
    echo [WARNING] .env file not found
)

REM === Kill leftover port listeners ===
echo [INFO] Cleaning up leftover port listeners...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr LISTENING') do taskkill /F /T /PID %%a >nul 2>&1

REM === Launch exe directly ===
echo [INFO] Starting application...
start "YiHuan AI Assistant" /min "%APP_DIR%yihuan_assistent.exe"

REM === Health-check loop, wait up to 30 seconds ===
set "READY=0"
set "WAITED=0"
:health_check
if !READY! equ 1 goto health_done
if !WAITED! geq 30 goto health_timeout
timeout /t 1 /nobreak >nul
set /a WAITED+=1
curl.exe -s -o NUL -w "%%{http_code}" http://localhost:8000/api/health 2>nul | findstr "200" >nul
if not errorlevel 1 (
    set "READY=1"
    echo.
    echo [OK] Service is ready ^(took !WAITED! seconds^)
) else (
    echo   Waiting... !WAITED!/30
    goto health_check
)

:health_done
goto health_check_end

:health_timeout
echo.
echo [ERROR] Service failed to start within 30 seconds.
echo         Check if yihuan_assistent.exe exists and can run on this PC.
echo.
pause
exit /b 1

:health_check_end

REM === Record backend PID to running.pid ===
REM Note: We no longer record THIS bat's own cmd.exe PID here.
REM Reason: bat cannot reliably get self PID ($$ does not expand on Win11,
REM         wmic/CommandLine matching also unreliable due to encoding).
REM         stop.bat now uses PowerShell CIM to find this launcher's cmd.exe
REM         by matching CommandLine containing the bat filename - more reliable.
set "BACKEND_PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr LISTENING') do set "BACKEND_PID=%%a"
echo backend_pid=%BACKEND_PID%> "%APP_DIR%running.pid"

echo.
echo ==============================================
echo           Application Started!
echo ==============================================
echo.
echo   URL: http://localhost:8000
echo   PID: %BACKEND_PID%
echo.
echo   Stop with: stop.bat or close the YiHuan window
echo ==============================================
echo.

REM === Open browser via explorer.exe (stable across Windows versions) ===
start "" explorer.exe http://localhost:8000

echo.
echo This window closes automatically when the app stops.
echo.

REM === Monitor backend: auto-close when port 8000 is released ===
REM Self-healing mechanism: once stop.bat kills the backend (or the exe
REM crashes/exits), this loop detects the port going away within 2 seconds
REM and closes this launcher window. Works even if stop.bat's own
REM window-kill step fails.
:monitor_loop
timeout /t 2 /nobreak >nul
netstat -aon 2>nul | findstr ":8000" | findstr LISTENING >nul
if errorlevel 1 (
    echo [INFO] Application stopped. Closing launcher window...
    timeout /t 1 /nobreak >nul
    exit
)
goto monitor_loop
