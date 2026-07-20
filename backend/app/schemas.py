from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict
from datetime import datetime
from decimal import Decimal
import json


# ==================== 项目相关 ====================
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    reviews_count: Optional[int] = 0
    
    class Config:
        from_attributes = True


# ==================== 评委相关 ====================
class JudgeCreate(BaseModel):
    name: str
    organization: Optional[str] = None
    expertise: Optional[List[str]] = None


class JudgeResponse(BaseModel):
    id: int
    name: str
    organization: Optional[str]
    expertise: Optional[List[str]]
    created_at: datetime
    
    @field_validator('expertise', mode='before')
    @classmethod
    def parse_expertise(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v
    
    class Config:
        from_attributes = True


# ==================== 评审相关 ====================
class ReviewCreate(BaseModel):
    project_id: int
    review_type: str  # product_launch / product_commercial
    meeting_date: Optional[datetime] = None
    judge_ids: List[int] = []  # 评委ID列表


class ReviewUpdate(BaseModel):
    status: Optional[str] = None
    meeting_date: Optional[datetime] = None
    judge_ids: Optional[List[int]] = None


class ReviewResponse(BaseModel):
    id: int
    project_id: int
    review_type: str
    status: str
    meeting_date: Optional[datetime]
    created_at: datetime
    judges: Optional[List[JudgeResponse]] = []
    
    class Config:
        from_attributes = True


# ==================== 文档相关 ====================
class DocumentResponse(BaseModel):
    id: int
    review_id: int
    file_name: str
    file_path: str
    content: Optional[str]
    uploaded_at: datetime
    
    class Config:
        from_attributes = True


# ==================== AI提问相关 ====================
class AIQuestionCreate(BaseModel):
    review_id: int
    question_type: str  # full_text / paragraph
    question_content: str
    paragraph_reference: Optional[str] = None
    answer_content: Optional[str] = None


class AIQuestionResponse(BaseModel):
    id: int
    review_id: int
    question_type: str
    question_content: str
    paragraph_reference: Optional[str]
    answer_content: Optional[str]
    sequence: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 人类提问相关 ====================
class HumanQuestionCreate(BaseModel):
    review_id: int
    judge_id: int
    question_content: str
    answer_content: Optional[str] = None


class HumanQuestionResponse(BaseModel):
    id: int
    review_id: int
    judge_id: int
    question_content: str
    answer_content: Optional[str]
    quality_score: Optional[Decimal]
    quality_dimensions: Optional[str]
    sequence: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 评委相关 ====================
class JudgeCreate(BaseModel):
    name: str
    organization: Optional[str] = None
    expertise: Optional[List[str]] = None


class JudgeResponse(BaseModel):
    id: int
    name: str
    organization: Optional[str]
    expertise: Optional[List[str]]
    created_at: datetime
    
    @field_validator('expertise', mode='before')
    @classmethod
    def parse_expertise(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v
    
    class Config:
        from_attributes = True


# ==================== 评分相关 ====================
class AIRatingCreate(BaseModel):
    review_id: int
    total_score: Optional[Decimal] = None
    dimensions: Optional[str] = None  # JSON格式
    reasoning: Optional[str] = None


class HumanRatingCreate(BaseModel):
    review_id: int
    judge_id: int
    total_score: Decimal
    dimensions: Optional[str] = None  # JSON格式


class AIRatingResponse(BaseModel):
    id: int
    review_id: int
    total_score: Optional[Decimal]
    dimensions: Optional[str]
    reasoning: Optional[str]
    created_at: datetime
    # 解析后的字段（方便前端使用）
    overall_score: Optional[float] = None
    innovation_score: Optional[float] = None
    feasibility_score: Optional[float] = None
    impact_score: Optional[float] = None
    presentation_score: Optional[float] = None
    comments: Optional[str] = None
    # 动态维度字段
    dimensions_meta: Optional[List[Dict]] = None
    dimension_1_score: Optional[float] = None
    dimension_2_score: Optional[float] = None
    dimension_3_score: Optional[float] = None
    dimension_4_score: Optional[float] = None
    
    @classmethod
    def from_orm_with_parse(cls, obj):
        """从ORM对象创建，并解析dimensions字段"""
        data = {
            'id': obj.id,
            'review_id': obj.review_id,
            'total_score': obj.total_score,
            'dimensions': obj.dimensions,
            'reasoning': obj.reasoning,
            'created_at': obj.created_at,
        }
        
        # 解析dimensions JSON
        if obj.dimensions:
            try:
                dims = json.loads(obj.dimensions)
                data['overall_score'] = float(dims.get('total', 0))
                data['comments'] = dims.get('reasoning', '')
                
                # 检查是否有维度元数据（新逻辑）
                if 'dimensions_meta' in dims:
                    # 动态解析配置的维度
                    for i, meta in enumerate(dims.get('dimensions_meta', [])):
                        key = f"dim_{i+1}"
                        field_name = f"dimension_{i+1}_score"
                        data[field_name] = float(dims.get(key, 0))
                    # 保存维度元数据供前端使用
                    data['dimensions_meta'] = dims['dimensions_meta']
                else:
                    # 兼容旧逻辑
                    data['innovation_score'] = float(dims.get('innovation', 0))
                    data['feasibility_score'] = float(dims.get('feasibility', 0))
                    data['impact_score'] = float(dims.get('market_prospect', 0))
                    data['presentation_score'] = float(dims.get('team_capability', 0))
            except:
                pass
        
        return cls(**data)
    
    class Config:
        from_attributes = True


class HumanRatingResponse(BaseModel):
    id: int
    review_id: int
    judge_id: int
    total_score: Decimal
    dimensions: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 看板统计相关 ====================
class JudgeStatsResponse(BaseModel):
    id: int
    judge_id: int
    total_questions: int
    avg_quality_score: Optional[Decimal]
    review_count: int
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProjectStatsResponse(BaseModel):
    project_id: int
    project_name: str
    total_reviews: int
    avg_score: Optional[Decimal]
    latest_review_date: Optional[datetime]


# ==================== AI对话相关 ====================
class ChatRequest(BaseModel):
    review_id: int
    conversation_history: Optional[List[dict]] = []


class ChatResponse(BaseModel):
    question: str
    answer: Optional[str] = None