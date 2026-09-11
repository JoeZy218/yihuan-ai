@echo off
chcp 65001 >nul
title YiHuan - Stopping...

echo ==============================================
echo         YiHuan AI Assistant - Stop Script
echo ==============================================
echo.

set "BASE_DIR=%~dp0"
set "PID_FILE=%BASE_DIR%running.pid"

REM ============================================================
REM Step 1: Close browser pages first (before killing anything)
REM ============================================================
echo [1/4] Closing browser pages...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Get-Process -Name chrome,msedge,firefox -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*YiHuan*' } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } } catch {}" 2>nul

REM ============================================================
REM Step 2: Kill backend on port 8000, then WAIT for port to release
REM ============================================================
echo.
echo [2/4] Stopping backend (port 8000)...

REM First try by running.pid
if exist "%PID_FILE%" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%PID_FILE%") do (
        if /i "%%a"=="backend_pid" (
            if not "%%b"=="" (
                echo   - Killing backend PID %%b ^(from pid file^)
                taskkill /F /PID %%b >nul 2>&1
            )
        )
    )
)

REM Also kill anything listening on port 8000
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr LISTENING') do (
    echo   - Killing backend PID %%a ^(from port scan^)
    taskkill /F /PID %%a >nul 2>&1
)

REM --- Wait for port 8000 to actually be released ---
echo.
echo   Waiting for port 8000 to be released...
set "PORT_FREE=0"
for /l %%i in (1,1,10) do (
    timeout /t 1 /nobreak >nul
    netstat -aon 2>nul | findstr ":8000" | findstr LISTENING >nul
    if errorlevel 1 (
        set "PORT_FREE=1"
        echo   [OK] Port 8000 released after %%i seconds.
        goto port_free
    )
    echo   Still in use... %%i/10
)

if "%PORT_FREE%"=="0" (
    echo   [WARN] Port 8000 still in use after 10 seconds. Forcing cleanup...
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr LISTENING') do (
        taskkill /F /PID %%a /T >nul 2>&1
    )
)

:port_free

REM ============================================================
REM Step 3: Kill launcher bat's cmd.exe
REM   Use PowerShell CIM to find cmd.exe whose CommandLine contains
REM   "start_portable" (ASCII fragment, reliable match).
REM   NOTE: The PowerShell command must NOT contain double quotes -
REM   cmd.exe treats "" as a quote toggle (not escape), which would
REM   break the command at the pipe characters and silently fail.
REM ============================================================
echo.
echo [3/4] Closing launcher window...

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*start_portable*' } | ForEach-Object { Write-Host ('  - Killing cmd PID=' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>nul

timeout /t 1 /nobreak >nul

REM ============================================================
REM Step 4: Cleanup PID file
REM ============================================================
if exist "%PID_FILE%" (
    del "%PID_FILE%" >nul 2>&1
    echo.
    echo [4/4] PID file removed.
) else (
    echo.
    echo [4/4] No PID file to clean.
)

echo.
echo ==============================================
echo                 Stop Complete!
echo ==============================================
echo.

set "LEFT=0"
netstat -aon 2>nul | findstr ":8000" | findstr LISTENING >nul && set "LEFT=1"

if %LEFT%==0 (
    echo   All services stopped successfully.
) else (
    echo   Warning: Port 8000 still in use.
)

echo.
echo This window will close in 2 seconds...
timeout /t 2 /nobreak >nul
exit
