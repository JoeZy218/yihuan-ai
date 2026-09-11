"""
路径解析器：统一处理开发环境和 PyInstaller 打包环境下的文件路径。

开发环境：
  backend/  ← __file__ 所在目录
  data/     ← backend/data/
  yihuan.db ← backend/yihuan.db
  .env      ← 项目根目录
  前端       ← frontend/dist/

PyInstaller 打包环境（onedir 模式）：
  yihuan_assistent.exe   ← sys.executable
  _internal/             ← sys._MEIPASS（只读资源：data/、frontend/、.pyc）
  yihuan.db              ← .exe 同级目录（可写）
  .env                   ← .exe 同级目录（可写）
"""
import os
import sys


def is_frozen() -> bool:
    """是否运行在 PyInstaller 打包环境中"""
    return getattr(sys, "frozen", False)


def is_vercel() -> bool:
    """
    是否运行在 Vercel Serverless Function 环境中。
    Vercel 环境特有的标志：VERCEL=1 环境变量 + 进程名中有 'vercel'。
    Vercel 上 SQLite 数据库需指向 /tmp（临时文件系统，冷启动会被清空，
    但每次冷启动 _ensure_database() 会从 data/*.json 自动重建，可接受）。
    """
    return os.environ.get("VERCEL") == "1" or "vercel" in os.environ.get("PATH", "").lower()


def get_backend_dir() -> str:
    """
    获取 backend 目录路径。
    开发环境：backend/ 源码目录
    打包环境：sys._MEIPASS（PyInstaller 解包后的内部目录，含 data/ 和 frontend/）
    """
    if is_frozen():
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def get_app_dir() -> str:
    """
    获取应用根目录（可写数据存放位置）。
    开发环境：项目根目录（yihuan_assistent/）
    打包环境：.exe 所在目录
    """
    if is_frozen():
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_resource_path(*parts) -> str:
    """
    获取只读资源路径（data/*.json、knowledge_base.json、前端静态文件等）。
    这些文件在打包时被 PyInstaller 放入 _internal 目录，不可写。
    """
    return os.path.join(get_backend_dir(), *parts)


def get_data_dir() -> str:
    """获取 data 目录路径（角色、材料、知识库等 JSON 数据文件）"""
    return get_resource_path("data")


def get_db_path() -> str:
    """
    获取 SQLite 数据库路径。
    打包时数据库放在 .exe 同级目录（可写），确保用户数据持久化。

    云端部署：
    - Vercel Serverless：用 /tmp（临时文件系统，冷启动清空但每次自动从 JSON 重建）
    - Render/VPS 等：可通过环境变量 YIHUAN_DATA_DIR 指向持久化卷
    桌面本地未设置该变量 → 走原逻辑，零影响。
    """
    env_dir = os.environ.get("YIHUAN_DATA_DIR")
    if env_dir:
        return os.path.join(env_dir, "yihuan.db")
    if is_vercel():
        # Vercel Serverless 临时文件系统：/tmp 在函数生命周期内可写
        return "/tmp/yihuan.db"
    if is_frozen():
        return os.path.join(get_app_dir(), "yihuan.db")
    return os.path.join(get_backend_dir(), "yihuan.db")


def get_env_path() -> str:
    """获取 .env 配置文件路径"""
    return os.path.join(get_app_dir(), ".env")


def get_frontend_dir() -> str:
    """
    获取前端静态文件目录。
    开发环境：frontend/dist/（npm run build 产物）
    打包环境：_internal/frontend/dist/（PyInstaller 打包时包含）
    """
    if is_frozen():
        return os.path.join(sys._MEIPASS, "frontend", "dist")
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "frontend",
        "dist",
    )
