# Hugging Face Spaces Dockerfile for 异环 AI 后端
# 基于官方 Python 3.11 镜像，uvicorn 作为 ASGI 服务器
FROM python:3.11-slim

# 设工作目录
WORKDIR /app

# 先复制依赖声明，利用 Docker 缓存
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端全部代码
COPY backend/ ./

# Hugging Face Spaces 默认暴露 7860 端口
ENV PORT=7860

# 启动 uvicorn（--host 0.0.0.0 让 Docker 外部能访问）
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
