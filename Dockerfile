# AI Review 应用部署 Dockerfile
# 想象力平台要求：端口 8080，绑定 0.0.0.0

# ==================== 构建前端 ====================
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装依赖
RUN npm ci --quiet --no-fund --no-audit

# 复制前端源码
COPY frontend/ ./

# 构建前端
RUN npm run build

# ==================== 最终镜像 ====================
FROM python:3.11-slim

WORKDIR /app

# 安装 nginx 用于服务前端静态文件
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# 复制后端依赖文件
COPY backend/requirements.txt ./

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端源码
COPY backend/app ./app

# 复制初始化配置脚本
COPY backend/init_configs.py ./init_configs.py

# 创建数据目录和上传目录
RUN mkdir -p /app/uploads /app/data

# 从构建阶段复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist /var/www/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 复制启动脚本
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 暴露端口 8080（想象力平台要求）
EXPOSE 8080

# 启动命令
CMD ["/app/start.sh"]