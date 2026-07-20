from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import ReviewDimensionConfig, QuestionQualityConfig
from pydantic import BaseModel
import json

router = APIRouter()


# ==================== 评审维度配置 ====================

class DimensionItem(BaseModel):
    name: str
    weight: int
    description: str


class ReviewDimensionConfigCreate(BaseModel):
    review_type: str
    name: str
    description: Optional[str] = None
    dimensions: List[DimensionItem]
    prompt_template: Optional[str] = None


class ReviewDimensionConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    dimensions: Optional[List[DimensionItem]] = None
    prompt_template: Optional[str] = None
    is_active: Optional[int] = None


class ReviewDimensionConfigResponse(BaseModel):
    id: int
    review_type: str
    name: str
    description: Optional[str]
    dimensions: List[dict]
    prompt_template: Optional[str]
    is_active: int
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.get("/review-dimensions", response_model=List[ReviewDimensionConfigResponse])
def list_review_dimensions(db: Session = Depends(get_db)):
    """获取所有评审维度配置"""
    configs = db.query(ReviewDimensionConfig).all()
    return [
        {
            "id": c.id,
            "review_type": c.review_type,
            "name": c.name,
            "description": c.description,
            "dimensions": json.loads(c.dimensions) if c.dimensions else [],
            "prompt_template": c.prompt_template,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat()
        }
        for c in configs
    ]


@router.get("/review-dimensions/{review_type}", response_model=ReviewDimensionConfigResponse)
def get_review_dimension(review_type: str, db: Session = Depends(get_db)):
    """获取指定类型的评审维度配置"""
    config = db.query(ReviewDimensionConfig).filter(
        ReviewDimensionConfig.review_type == review_type
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    return {
        "id": config.id,
        "review_type": config.review_type,
        "name": config.name,
        "description": config.description,
        "dimensions": json.loads(config.dimensions) if config.dimensions else [],
        "prompt_template": config.prompt_template,
        "is_active": config.is_active,
        "created_at": config.created_at.isoformat(),
        "updated_at": config.updated_at.isoformat()
    }


@router.post("/review-dimensions", response_model=ReviewDimensionConfigResponse)
def create_review_dimension(config: ReviewDimensionConfigCreate, db: Session = Depends(get_db)):
    """创建评审维度配置"""
    # 检查是否已存在
    existing = db.query(ReviewDimensionConfig).filter(
        ReviewDimensionConfig.review_type == config.review_type
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该评审类型的配置已存在")
    
    db_config = ReviewDimensionConfig(
        review_type=config.review_type,
        name=config.name,
        description=config.description,
        dimensions=json.dumps([d.dict() for d in config.dimensions]),
        prompt_template=config.prompt_template
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return {
        "id": db_config.id,
        "review_type": db_config.review_type,
        "name": db_config.name,
        "description": db_config.description,
        "dimensions": json.loads(db_config.dimensions),
        "prompt_template": db_config.prompt_template,
        "is_active": db_config.is_active,
        "created_at": db_config.created_at.isoformat(),
        "updated_at": db_config.updated_at.isoformat()
    }


@router.put("/review-dimensions/{review_type}", response_model=ReviewDimensionConfigResponse)
def update_review_dimension(review_type: str, config: ReviewDimensionConfigUpdate, db: Session = Depends(get_db)):
    """更新评审维度配置"""
    db_config = db.query(ReviewDimensionConfig).filter(
        ReviewDimensionConfig.review_type == review_type
    ).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    update_data = config.dict(exclude_unset=True)
    if "dimensions" in update_data and update_data["dimensions"]:
        update_data["dimensions"] = json.dumps([d.dict() if hasattr(d, 'dict') else d for d in update_data["dimensions"]])
    
    for key, value in update_data.items():
        setattr(db_config, key, value)
    
    db.commit()
    db.refresh(db_config)
    
    return {
        "id": db_config.id,
        "review_type": db_config.review_type,
        "name": db_config.name,
        "description": db_config.description,
        "dimensions": json.loads(db_config.dimensions),
        "prompt_template": db_config.prompt_template,
        "is_active": db_config.is_active,
        "created_at": db_config.created_at.isoformat(),
        "updated_at": db_config.updated_at.isoformat()
    }


@router.delete("/review-dimensions/{review_type}")
def delete_review_dimension(review_type: str, db: Session = Depends(get_db)):
    """删除评审维度配置"""
    db_config = db.query(ReviewDimensionConfig).filter(
        ReviewDimensionConfig.review_type == review_type
    ).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    db.delete(db_config)
    db.commit()
    return {"message": "删除成功"}


# ==================== 提问质量评价标准配置 ====================

class QualityDimensionItem(BaseModel):
    name: str
    weight: int
    description: str


class GradeLevel(BaseModel):
    level: str
    range: str
    description: str


class QuestionQualityConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    dimensions: List[QualityDimensionItem]
    grade_levels: Optional[List[GradeLevel]] = None


class QuestionQualityConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    dimensions: Optional[List[QualityDimensionItem]] = None
    grade_levels: Optional[List[GradeLevel]] = None
    is_active: Optional[int] = None


class QuestionQualityConfigResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    dimensions: List[dict]
    grade_levels: Optional[List[dict]]
    is_active: int
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.get("/question-quality", response_model=List[QuestionQualityConfigResponse])
def list_question_quality_configs(db: Session = Depends(get_db)):
    """获取所有提问质量评价标准配置"""
    configs = db.query(QuestionQualityConfig).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "dimensions": json.loads(c.dimensions) if c.dimensions else [],
            "grade_levels": json.loads(c.grade_levels) if c.grade_levels else None,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat()
        }
        for c in configs
    ]


@router.get("/question-quality/{config_id}", response_model=QuestionQualityConfigResponse)
def get_question_quality_config(config_id: int, db: Session = Depends(get_db)):
    """获取指定的提问质量评价标准配置"""
    config = db.query(QuestionQualityConfig).filter(QuestionQualityConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    return {
        "id": config.id,
        "name": config.name,
        "description": config.description,
        "dimensions": json.loads(config.dimensions) if config.dimensions else [],
        "grade_levels": json.loads(config.grade_levels) if config.grade_levels else None,
        "is_active": config.is_active,
        "created_at": config.created_at.isoformat(),
        "updated_at": config.updated_at.isoformat()
    }


@router.get("/question-quality/active", response_model=QuestionQualityConfigResponse)
def get_active_question_quality_config(db: Session = Depends(get_db)):
    """获取当前启用的提问质量评价标准配置"""
    config = db.query(QuestionQualityConfig).filter(
        QuestionQualityConfig.is_active == 1
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="没有启用的配置")
    
    return {
        "id": config.id,
        "name": config.name,
        "description": config.description,
        "dimensions": json.loads(config.dimensions) if config.dimensions else [],
        "grade_levels": json.loads(config.grade_levels) if config.grade_levels else None,
        "is_active": config.is_active,
        "created_at": config.created_at.isoformat(),
        "updated_at": config.updated_at.isoformat()
    }


@router.post("/question-quality", response_model=QuestionQualityConfigResponse)
def create_question_quality_config(config: QuestionQualityConfigCreate, db: Session = Depends(get_db)):
    """创建提问质量评价标准配置"""
    db_config = QuestionQualityConfig(
        name=config.name,
        description=config.description,
        dimensions=json.dumps([d.dict() for d in config.dimensions]),
        grade_levels=json.dumps([g.dict() for g in config.grade_levels]) if config.grade_levels else None,
        is_active=1
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return {
        "id": db_config.id,
        "name": db_config.name,
        "description": db_config.description,
        "dimensions": json.loads(db_config.dimensions),
        "grade_levels": json.loads(db_config.grade_levels) if db_config.grade_levels else None,
        "is_active": db_config.is_active,
        "created_at": db_config.created_at.isoformat(),
        "updated_at": db_config.updated_at.isoformat()
    }


@router.put("/question-quality/{config_id}", response_model=QuestionQualityConfigResponse)
def update_question_quality_config(config_id: int, config: QuestionQualityConfigUpdate, db: Session = Depends(get_db)):
    """更新提问质量评价标准配置"""
    db_config = db.query(QuestionQualityConfig).filter(QuestionQualityConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    update_data = config.dict(exclude_unset=True)
    if "dimensions" in update_data and update_data["dimensions"]:
        update_data["dimensions"] = json.dumps([d.dict() if hasattr(d, 'dict') else d for d in update_data["dimensions"]])
    if "grade_levels" in update_data and update_data["grade_levels"]:
        update_data["grade_levels"] = json.dumps([g.dict() if hasattr(g, 'dict') else g for g in update_data["grade_levels"]])
    
    for key, value in update_data.items():
        setattr(db_config, key, value)
    
    db.commit()
    db.refresh(db_config)
    
    return {
        "id": db_config.id,
        "name": db_config.name,
        "description": db_config.description,
        "dimensions": json.loads(db_config.dimensions),
        "grade_levels": json.loads(db_config.grade_levels) if db_config.grade_levels else None,
        "is_active": db_config.is_active,
        "created_at": db_config.created_at.isoformat(),
        "updated_at": db_config.updated_at.isoformat()
    }


@router.delete("/question-quality/{config_id}")
def delete_question_quality_config(config_id: int, db: Session = Depends(get_db)):
    """删除提问质量评价标准配置"""
    db_config = db.query(QuestionQualityConfig).filter(QuestionQualityConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    db.delete(db_config)
    db.commit()
    return {"message": "删除成功"}


@router.post("/question-quality/{config_id}/activate")
def activate_question_quality_config(config_id: int, db: Session = Depends(get_db)):
    """启用指定的提问质量评价标准配置"""
    # 先禁用所有配置
    db.query(QuestionQualityConfig).update({"is_active": 0})
    
    # 再启用指定配置
    db_config = db.query(QuestionQualityConfig).filter(QuestionQualityConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    db_config.is_active = 1
    db.commit()
    return {"message": "已启用"}