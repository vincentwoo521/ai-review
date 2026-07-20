#!/bin/bash
set -e

# 设置生产环境变量
export ENVIRONMENT=production

# 创建必要的目录
mkdir -p /app/uploads
mkdir -p /var/log/nginx
mkdir -p /var/run

# 创建数据持久化目录（如果使用持久化卷）
mkdir -p ${DATA_DIR:-/app/data}

# 确保数据库目录存在
DB_DIR=$(dirname ${DATA_DIR:-/app/data}/ai_review.db)
mkdir -p "$DB_DIR"

# 初始化配置数据（评审维度、提问质量评价标准等）
# 注意：init_configs.py会自动创建数据库表
python init_configs.py

# 启动后端 API 服务（在后台运行）
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动 nginx（前台运行，监听 8080）
# nginx 必须在前台运行作为主进程
exec nginx -g 'daemon off;'