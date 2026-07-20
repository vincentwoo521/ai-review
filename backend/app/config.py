from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # 大模型API配置
    openai_api_key: Optional[str] = None
    openai_api_base: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4"
    
    # 数据库配置
    # 优先使用 DATA_DIR 环境变量（持久化卷挂载点）
    # 如果没有，则使用当前目录
    database_url: Optional[str] = None
    data_dir: str = os.getenv("DATA_DIR", "/app/data")
    
    # 文件上传配置
    upload_dir: str = "./uploads"
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 如果没有显式设置 database_url，则使用持久化目录
        if not self.database_url:
            os.makedirs(self.data_dir, exist_ok=True)
            self.database_url = f"sqlite:///{self.data_dir}/ai_review.db"


settings = Settings()