from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # 大模型API配置
    openai_api_key: Optional[str] = None
    openai_api_base: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4"
    
    # 数据库配置 - 本地部署使用相对路径
    database_url: Optional[str] = None
    
    # 文件上传配置 - 本地部署使用相对路径
    upload_dir: str = "./uploads"
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 如果没有显式设置 database_url，使用本地数据库文件
        if not self.database_url:
            self.database_url = "sqlite:///./ai_review.db"


settings = Settings()