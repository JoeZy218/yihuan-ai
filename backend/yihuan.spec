# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec 文件 —— 异环 AI 战术教学助手打包配置

产物结构（onedir 模式）：
  dist/yihuan_assistent/
    yihuan_assistent.exe          ← 主程序
    _internal/
      ...（Python 运行时 + 依赖库）
      data/                       ← 游戏数据 JSON（只读）
      frontend/dist/              ← 前端构建产物（只读）
    yihuan.db                     ← SQLite 数据库（首次运行自动创建，可写）
    .env                          ← API 配置（用户填写，可写）
    .env.example                  ← 配置模板
    start_portable.bat            ← 便携启动脚本
"""

import os

backend_dir = os.path.abspath('.')

a = Analysis(
    ['main.py'],
    pathex=[backend_dir],
    binaries=[],
    datas=[
        # 数据文件（角色/弧盘/材料/知识库/图片URL）
        ('data', 'data'),
        # 前端构建产物（由 build_package.bat 先执行 npm run build 生成）
        ('../frontend/dist', 'frontend/dist'),
    ],
    hiddenimports=[
        # uvicorn 动态导入
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # 项目内部模块
        'path_resolver',
        'init_db',
        'init_sets',
        'services',
        'services.chat_service',
        'services.intent_service',
        'services.llm_service',
        'services.retrieval_service',
        'services.mock_llm_service',
        'services.stats_service',
        'services.team_service',
        'services.material_service',
        'services.arcdisk_service',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy',
        'pandas',
        'PIL',
        'tkinter',
        'PyQt5',
        'PySide2',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='yihuan_assistent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='yihuan_assistent',
)
