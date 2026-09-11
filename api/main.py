"""
Vercel Python Function 入口。
Vercel 会把此文件作为 FastAPI 应用入口，暴露 /api/* 路由。
前端静态文件由 vercel.json routes 指向 frontend/dist 目录，不走 Python。

桌面本地开发（python backend/main.py）和 Vercel 云端部署互不干扰。
"""
import os
import sys

# 确保 backend/ 能被导入（Vercel 函数工作目录是项目根，backend/ 在子目录）
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from main import app  # noqa: E402 — 必须在 sys.path 配置后导入
