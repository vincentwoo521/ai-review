from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import projects, reviews, ai_chat, ratings, judges, dashboard, configs, product_reviews

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 创建FastAPI应用
app = FastAPI(
    title="AI评审系统 API",
    description="基于大模型的智能评审辅助系统",
    version="1.0.0"
)

# 配置CORS（生产环境允许所有来源，通过 nginx 反向代理）
import os
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if os.getenv("ENVIRONMENT") == "production" else ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(projects.router, prefix="/api/projects", tags=["项目管理"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["评审管理"])
app.include_router(ai_chat.router, prefix="/api/ai", tags=["AI对话"])
app.include_router(ratings.router, prefix="/api/ratings", tags=["评分管理"])
app.include_router(judges.router, prefix="/api/judges", tags=["评委管理"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["数据看板"])
app.include_router(configs.router, prefix="/api/configs", tags=["配置管理"])
app.include_router(product_reviews.router, prefix="/api/product-reviews", tags=["产品评审"])


@app.get("/")
def root():
    """根路径"""
    return {
        "message": "AI评审系统 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy"}


@app.get("/api/config/check")
def check_config():
    """检查API配置状态"""
    from app.config import settings
    
    if not settings.openai_api_key:
        return {
            "configured": False,
            "message": "⚠️  未检测到API Key配置！请按以下步骤配置：\n"
                      "1. 复制 backend/.env.example 为 backend/.env\n"
                      "2. 编辑 .env 文件，设置 OPENAI_API_KEY=your_actual_api_key\n"
                      "3. 重启后端服务\n\n"
                      "如果您使用其他兼容OpenAI格式的API，请同时配置 OPENAI_API_BASE"
        }
    
    return {
        "configured": True,
        "api_base": settings.openai_api_base,
        "model": settings.openai_model,
        "message": "API配置正常"
    }


@app.post("/api/config/set-api-key")
def set_api_key(data: dict):
    """保存API Key到.env文件"""
    import os
    from pathlib import Path
    
    api_key = data.get("api_key")
    api_base = data.get("api_base", "https://api.openai.com/v1")
    model = data.get("model", "gpt-4")
    
    if not api_key:
        return {"success": False, "message": "API Key不能为空"}
    
    # 获取.env文件路径
    env_path = Path(__file__).parent / ".env"
    env_example_path = Path(__file__).parent / ".env.example"
    
    # 如果.env不存在，从.env.example复制
    if not env_path.exists() and env_example_path.exists():
        with open(env_example_path, 'r') as f:
            content = f.read()
    else:
        content = ""
    
    # 更新或添加配置项
    lines = content.strip().split('\n') if content.strip() else []
    config_map = {
        "OPENAI_API_KEY": api_key,
        "OPENAI_API_BASE": api_base,
        "OPENAI_MODEL": model
    }
    
    # 更新现有配置
    updated_keys = set()
    new_lines = []
    for line in lines:
        if '=' in line:
            key = line.split('=')[0].strip()
            if key in config_map:
                new_lines.append(f"{key}={config_map[key]}")
                updated_keys.add(key)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    # 添加新配置
    for key, value in config_map.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}")
    
    # 写入文件
    try:
        with open(env_path, 'w') as f:
            f.write('\n'.join(new_lines) + '\n')
        
        # 重新加载配置
        from app.config import settings
        settings.openai_api_key = api_key
        settings.openai_api_base = api_base
        settings.openai_model = model
        
        return {"success": True, "message": "配置保存成功，已生效"}
    except Exception as e:
        return {"success": False, "message": f"保存失败：{str(e)}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)