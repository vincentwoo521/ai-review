#!/bin/bash
# 本地开发启动脚本

# 进入后端目录
cd backend

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
if [ ! -f "venv/lib/python3.x/site-packages/fastapi" ]; then
    echo "安装依赖..."
    pip install -r requirements.txt
fi

# 创建必要的目录
mkdir -p uploads
mkdir -p data

# 初始化数据库和配置
python init_configs.py

# 启动后端服务
echo "启动后端服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000