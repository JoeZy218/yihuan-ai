@echo off
chcp 65001 >nul
title YiHuan - Launching...

echo ==============================================
echo         YiHuan AI Assistant - Launch Script
echo ==============================================
echo.

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "FRONTEND_DIR=%BASE_DIR%frontend"
set "PID_FILE=%BASE_DIR%running.pid"

REM === Python 环境检测与自修复（支持异机/拷贝部署）===
REM 随包 .venv 绑定原机器 Python 路径，直接拷贝到别的电脑无法使用，
REM 这里会“实际运行测试”，失败则用该电脑的系统 Python 自动重建。
set "VENV_SCRIPTS=%BACKEND_DIR%\.venv\Scripts"
set "PYTHON_CMD="

REM 1) 实测随包 venv 是否可用（不能只看 python.exe 文件是否存在）
if exist "%VENV_SCRIPTS%\python.exe" (
    "%VENV_SCRIPTS%\python.exe" -c "import sys" >nul 2>&1
    if not errorlevel 1 (
        set "PATH=%VENV_SCRIPTS%;%PATH%"
        set "PYTHON_CMD=%VENV_SCRIPTS%\python.exe"
        echo [OK] Using bundled Python venv.
        goto :py_ready
    )
    echo [WARNING] Bundled .venv does not work on this PC ^(its base Python is missing^).
)

REM 2) 查找系统 Python：优先 py 启动器，再查 PATH（排除微软商店占位符）
echo [INFO] Looking for a system Python installation...
set "SYS_PY="
py -3 -c "import sys" >nul 2>&1
if not errorlevel 1 set "SYS_PY=py -3"
if not defined SYS_PY (
    for /f "delims=" %%p in ('where python 2^>nul ^| findstr /v /i "WindowsApps"') do (
        if not defined SYS_PY (
            "%%p" -c "import sys" >nul 2>&1
            if not errorlevel 1 set SYS_PY="%%p"
        )
    )
)

if not defined SYS_PY goto :no_python

REM 要求 Python 3.10 及以上版本
%SYS_PY% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto :old_python

REM 3) 用系统 Python 重建 venv 并安装后端依赖
echo [INFO] Rebuilding backend .venv with: %SYS_PY%
if exist "%BACKEND_DIR%\.venv" rmdir /s /q "%BACKEND_DIR%\.venv"
%SYS_PY% -m venv "%BACKEND_DIR%\.venv"
if errorlevel 1 goto :venv_fail
"%VENV_SCRIPTS%\python.exe" -m pip install --upgrade pip
"%VENV_SCRIPTS%\python.exe" -m pip install -r "%BACKEND_DIR%\requirements.txt"
if errorlevel 1 goto :pip_fail
set "PATH=%VENV_SCRIPTS%;%PATH%"
set "PYTHON_CMD=%VENV_SCRIPTS%\python.exe"
echo [OK] Backend Python environment repaired.
goto :py_ready

:no_python
echo.
echo [ERROR] Python was not found on this computer.
echo Please install Python 3.10 or newer from https://www.python.org/downloads/
echo ^(tick "Add python.exe to PATH" during installation^), then run this script again.
echo.
pause
exit /b 1

:old_python
echo.
echo [ERROR] Python 3.10 or newer is required ^(this app was built with Python 3.14^).
echo Please upgrade Python from https://www.python.org/downloads/ then run again.
echo.
pause
exit /b 1

:venv_fail
echo.
echo [ERROR] Failed to create the Python virtual environment.
pause
exit /b 1

:pip_fail
echo.
echo [ERROR] Failed to install backend dependencies ^(pip^). Check your network and run again.
pause
exit /b 1

:py_ready

if exist "%PID_FILE%" (
    echo [INFO] Found old PID file, cleaning up...
    for /f "usebackq tokens=1,2 delims==" %%a in ("%PID_FILE%") do (
        if not "%%b"=="" taskkill /F /T /PID %%b >nul 2>&1
    )
    del "%PID_FILE%" >nul 2>&1
)

echo [INFO] Killing leftover port listeners (8000 / 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr LISTENING') do taskkill /F /T /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr LISTENING') do taskkill /F /T /PID %%a >nul 2>&1

echo [INFO] Loading API configuration from .env...
if exist "%BASE_DIR%.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%BASE_DIR%.env") do (
        set "%%a=%%b"
    )
    echo [OK] API configuration loaded
) else (
    echo [WARNING] .env file not found
)

echo.
echo [1/4] Initializing database...
cd /d "%BACKEND_DIR%"
"%PYTHON_CMD%" init_db.py
if errorlevel 1 (
    echo Database init failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Importing configuration data...
"%PYTHON_CMD%" init_sets.py
if errorlevel 1 (
    echo Data import failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Starting backend service...
cd /d "%BACKEND_DIR%"

start "YiHuan-Backend" cmd /c ""%PYTHON_CMD%" main.py"

echo   Waiting for backend...
timeout /t 4 /nobreak >nul

echo [4/4] Starting frontend service...
set "FRONTEND_OK="
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Node.js/npm not found - skipping frontend.
    echo           Install Node.js LTS from https://nodejs.org/ then re-run.
    echo           Backend API stays available at http://localhost:8000
    goto :frontend_done
)
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [INFO] Installing frontend dependencies ^(first run^)...
    cd /d "%FRONTEND_DIR%"
    call npm.cmd install
    if errorlevel 1 (
        echo [WARNING] npm install failed - skipping frontend. Check your network.
        goto :frontend_done
    )
)
cd /d "%FRONTEND_DIR%"

start "YiHuan-Frontend" cmd /c "npm.cmd run dev"

echo   Waiting for frontend...
timeout /t 6 /nobreak >nul
set "FRONTEND_OK=1"

:frontend_done

set "BACKEND_PID="
set "FRONTEND_PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr LISTENING') do set "BACKEND_PID=%%a"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr LISTENING') do set "FRONTEND_PID=%%a"

echo backend_pid=%BACKEND_PID%> "%PID_FILE%"
echo frontend_pid=%FRONTEND_PID%>> "%PID_FILE%"

echo.
echo ==============================================
echo              Services Started!
echo ==============================================
echo.
echo   Backend : http://localhost:8000  (PID: %BACKEND_PID%)
echo   Frontend: http://localhost:3000  (PID: %FRONTEND_PID%)
echo.
echo   Stop with: stop.bat
echo ==============================================
echo.

if defined FRONTEND_OK start http://localhost:3000
exit