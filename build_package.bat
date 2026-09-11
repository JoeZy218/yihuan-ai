@echo off
chcp 65001 >nul
title YiHuan - Building Portable Package

echo ==============================================
echo      YiHuan Portable Package Builder
echo ==============================================
echo.

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "FRONTEND_DIR=%BASE_DIR%frontend"

REM === Step 1: 检查后端 Python 环境 ===
echo [1/5] Checking backend Python environment...
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
    echo [ERROR] Backend .venv not found. Please run start.bat first to create it.
    pause
    exit /b 1
)

REM 安装 PyInstaller（如未安装）
"%VENV_PY%" -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    "%VENV_PY%" -m pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] Failed to install PyInstaller. Check your network.
        pause
        exit /b 1
    )
)
echo [OK] PyInstaller ready.
echo.

REM === Step 2: 构建前端 ===
echo [2/5] Building frontend static files...
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js/npm not found. Install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    call npm.cmd install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check your network.
        pause
        exit /b 1
    )
)

cd /d "%FRONTEND_DIR%"
call npm.cmd run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)
echo [OK] Frontend built to frontend\dist\
echo.

REM === Step 3: 预初始化数据库 ===
echo [3/5] Pre-initializing database...
cd /d "%BACKEND_DIR%"
"%VENV_PY%" init_db.py
if errorlevel 1 (
    echo [ERROR] init_db.py failed.
    pause
    exit /b 1
)
"%VENV_PY%" init_sets.py
if errorlevel 1 (
    echo [ERROR] init_sets.py failed.
    pause
    exit /b 1
)
echo [OK] Database ready.
echo.

REM === Step 4: 运行 PyInstaller 打包 ===
echo [4/5] Running PyInstaller...
cd /d "%BACKEND_DIR%"

REM 清理旧的构建产物
if exist "build" rmdir /s /q "build"
if exist "dist\yihuan_assistent" rmdir /s /q "dist\yihuan_assistent"

"%VENV_PY%" -m PyInstaller yihuan.spec --noconfirm
if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    pause
    exit /b 1
)
echo [OK] Package built to backend\dist\yihuan_assistent\
echo.

REM === Step 5: 复制辅助文件到产物目录 ===
echo [5/5] Copying auxiliary files...
set "DIST_DIR=%BACKEND_DIR%\dist\yihuan_assistent"

REM 复制预初始化的数据库
copy "%BACKEND_DIR%\yihuan.db" "%DIST_DIR%\yihuan.db" >nul 2>&1
echo   - yihuan.db

REM 复制 .env.example
copy "%BASE_DIR%.env.example" "%DIST_DIR%\.env.example" >nul 2>&1
echo   - .env.example

REM 如果没有 .env，从 example 创建一个（用户需自行填写 API Key）
if not exist "%DIST_DIR%\.env" (
    copy "%BASE_DIR%.env.example" "%DIST_DIR%\.env" >nul 2>&1
    echo   - .env (from template, please fill in API key)
)

REM 复制便携启动脚本
copy "%BASE_DIR%start_portable.bat" "%DIST_DIR%\start_portable.bat" >nul 2>&1
echo   - start_portable.bat

REM 复制停止脚本
if exist "%BASE_DIR%stop.bat" (
    copy "%BASE_DIR%stop.bat" "%DIST_DIR%\stop.bat" >nul 2>&1
    echo   - stop.bat
)

echo.
echo ==============================================
echo           Package Build Complete!
echo ==============================================
echo.
echo   Output: %DIST_DIR%
echo.
echo   To distribute: Copy the entire "yihuan_assistent" folder
echo   to the target machine and run start_portable.bat
echo.
echo   The target machine does NOT need Python or Node.js.
echo   Just fill in .env with the DeepSeek API key.
echo ==============================================
echo.
pause
