from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import (
    ProductReview, ProductDocument, ProductAIQuestion, 
    ProductHumanQuestion, ProductAIRating, Judge, ReviewDimensionConfig
)
from app.document_parser import document_parser
from app.ai_service import get_ai_service
from pydantic import BaseModel
from datetime import datetime
import json
import os

router = APIRouter()


def get_product_review_dimensions(db: Session) -> List[dict]:
    """获取产品评审的维度配置"""
    config = db.query(ReviewDimensionConfig).filter(
        ReviewDimensionConfig.review_type == "product_review",
        ReviewDimensionConfig.is_active == 1
    ).first()
    
    if config and config.dimensions:
        try:
            return json.loads(config.dimensions)
        except:
            pass
    return None


# Pydantic 模型
class ProductReviewCreate(BaseModel):
    product_name: str
    description: Optional[str] = None
    judge_ids: Optional[List[int]] = None


class ProductReviewUpdate(BaseModel):
    product_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    judge_ids: Optional[List[int]] = None


class JudgeInfo(BaseModel):
    id: int
    name: str
    department: Optional[str]
    organization: Optional[str]
    
    class Config:
        from_attributes = True


class ProductReviewResponse(BaseModel):
    id: int
    product_name: str
    description: Optional[str]
    status: str
    created_at: datetime
    judges: List[JudgeInfo] = []
    
    class Config:
        from_attributes = True


class HumanQuestionCreate(BaseModel):
    judge_id: int
    question: str


@router.post("/", response_model=ProductReviewResponse)
def create_product_review(review: ProductReviewCreate, db: Session = Depends(get_db)):
    """创建新产品评审"""
    db_review = ProductReview(
        product_name=review.product_name,
        description=review.description
    )
    
    # 添加评委
    if review.judge_ids:
        judges = db.query(Judge).filter(Judge.id.in_(review.judge_ids)).all()
        db_review.judges = judges
    
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review


@router.get("/", response_model=List[ProductReviewResponse])
def list_product_reviews(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取产品评审列表"""
    reviews = db.query(ProductReview).offset(skip).limit(limit).all()
    return reviews


@router.get("/{review_id}", response_model=ProductReviewResponse)
def get_product_review(review_id: int, db: Session = Depends(get_db)):
    """获取产品评审详情"""
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    return review


@router.put("/{review_id}", response_model=ProductReviewResponse)
def update_product_review(review_id: int, review: ProductReviewUpdate, db: Session = Depends(get_db)):
    """更新产品评审"""
    db_review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    if review.product_name is not None:
        db_review.product_name = review.product_name
    if review.description is not None:
        db_review.description = review.description
    if review.status is not None:
        db_review.status = review.status
    if review.judge_ids is not None:
        judges = db.query(Judge).filter(Judge.id.in_(review.judge_ids)).all()
        db_review.judges = judges
    
    db.commit()
    db.refresh(db_review)
    return db_review


@router.patch("/{review_id}/status")
def update_product_review_status(review_id: int, status: str, db: Session = Depends(get_db)):
    """更新产品评审状态"""
    db_review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    db_review.status = status
    db.commit()
    db.refresh(db_review)
    return db_review


@router.post("/{review_id}/upload-document")
async def upload_product_document(
    review_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传产品评审文档 - 支持 PDF 和图片格式"""
    # 验证评审存在
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    # 验证文件类型
    allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="只支持 PDF 和图片格式文件")
    
    # 读取文件内容
    file_content = await file.read()
    
    # 保存文件
    file_path = document_parser.save_uploaded_file(file_content, file.filename)
    
    # 判断文件类型并解析
    is_image = file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    
    try:
        if is_image:
            parsed_result = document_parser.parse_image(file_path)
        else:
            parsed_result = document_parser.parse_pdf(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文档解析失败: {str(e)}")
    
    # 保存到数据库
    document = ProductDocument(
        product_review_id=review_id,
        file_name=file.filename,
        file_path=file_path,
        content=parsed_result.get("content", ""),
        file_type="image" if is_image else "pdf",
        image_base64=parsed_result.get("image_base64") if is_image else None,
        image_type=parsed_result.get("image_type") if is_image else None
    )
    
    # 如果已存在文档,先删除
    existing_doc = db.query(ProductDocument).filter(
        ProductDocument.product_review_id == review_id
    ).first()
    if existing_doc:
        db.delete(existing_doc)
    
    # 清除旧的AI提问记录
    db.query(ProductAIQuestion).filter(
        ProductAIQuestion.product_review_id == review_id
    ).delete()
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return {
        "id": document.id,
        "product_review_id": document.product_review_id,
        "file_name": document.file_name,
        "content": document.content,
        "uploaded_at": document.uploaded_at
    }


@router.get("/{review_id}/document")
def get_product_review_document(review_id: int, db: Session = Depends(get_db)):
    """获取产品评审文档"""
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    document = review.document
    return {
        "id": document.id,
        "product_review_id": document.product_review_id,
        "file_name": document.file_name,
        "content": document.content,
        "uploaded_at": document.uploaded_at
    }


@router.delete("/{review_id}/document")
def delete_product_review_document(review_id: int, db: Session = Depends(get_db)):
    """删除产品评审文档"""
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 删除文件
    if os.path.exists(review.document.file_path):
        os.remove(review.document.file_path)
    
    db.delete(review.document)
    db.commit()
    return {"message": "文档已删除"}


@router.delete("/{review_id}")
def delete_product_review(review_id: int, db: Session = Depends(get_db)):
    """删除产品评审"""
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    db.delete(review)
    db.commit()
    return {"message": "产品评审已删除"}


# AI提问相关
@router.post("/{review_id}/ai-questions/generate")
async def generate_product_ai_questions(
    review_id: int,
    db: Session = Depends(get_db)
):
    """生成AI提问 - 支持 PDF 和图片，使用可配置维度"""
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=400, detail="请先上传产品文档")
    
    try:
        ai_service = get_ai_service()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 获取维度配置
    dimensions_config = get_product_review_dimensions(db)
    
    # 生成提问 - 根据文档类型选择方式
    questions = await ai_service.generate_product_questions(
        document_content=review.document.content or "",
        product_name=review.product_name,
        dimensions_config=dimensions_config,
        image_base64=review.document.image_base64,
        image_type=review.document.image_type
    )
    
    # 保存提问记录
    for i, q in enumerate(questions):
        ai_question = ProductAIQuestion(
            product_review_id=review_id,
            question_content=q,
            sequence=i + 1
        )
        db.add(ai_question)
    
    db.commit()
    
    return {"message": f"已生成{len(questions)}个问题", "questions": questions}


@router.get("/{review_id}/ai-questions")
def get_product_ai_questions(review_id: int, db: Session = Depends(get_db)):
    """获取AI提问列表"""
    questions = db.query(ProductAIQuestion).filter(
        ProductAIQuestion.product_review_id == review_id
    ).order_by(ProductAIQuestion.sequence).all()
    return questions


@router.post("/ai-questions/{question_id}/answer")
def answer_product_ai_question(
    question_id: int,
    answer: str,
    db: Session = Depends(get_db)
):
    """回答AI提问"""
    question = db.query(ProductAIQuestion).filter(
        ProductAIQuestion.id == question_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    question.answer_content = answer
    db.commit()
    db.refresh(question)
    return {"message": "回答已保存", "question": question}


# 人类提问相关
@router.post("/{review_id}/human-questions")
def create_product_human_question(
    review_id: int,
    data: HumanQuestionCreate,
    db: Session = Depends(get_db)
):
    """创建人类提问"""
    # 验证评审存在
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    # 验证评委存在
    judge = db.query(Judge).filter(Judge.id == data.judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 获取当前最大序号
    max_seq = db.query(ProductHumanQuestion).filter(
        ProductHumanQuestion.product_review_id == review_id
    ).count()
    
    human_question = ProductHumanQuestion(
        product_review_id=review_id,
        judge_id=data.judge_id,
        question_content=data.question,
        sequence=max_seq + 1
    )
    
    db.add(human_question)
    db.commit()
    db.refresh(human_question)
    return human_question


@router.get("/{review_id}/human-questions")
def get_product_human_questions(review_id: int, db: Session = Depends(get_db)):
    """获取人类提问列表"""
    questions = db.query(ProductHumanQuestion).filter(
        ProductHumanQuestion.product_review_id == review_id
    ).order_by(ProductHumanQuestion.sequence).all()
    return questions


# AI评价相关
@router.post("/{review_id}/ai-rating")
async def generate_product_ai_rating(review_id: int, db: Session = Depends(get_db)):
    """生成AI评价 - 使用可配置维度"""
    review = db.query(ProductReview).filter(ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="产品评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=400, detail="请先上传产品文档")
    
    try:
        ai_service = get_ai_service()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 获取维度配置
    dimensions_config = get_product_review_dimensions(db)
    
    # 获取问答历史
    ai_questions = db.query(ProductAIQuestion).filter(
        ProductAIQuestion.product_review_id == review_id
    ).order_by(ProductAIQuestion.sequence).all()
    
    qa_history = [
        {
            "question": q.question_content,
            "answer": q.answer_content or "未回答"
        }
        for q in ai_questions
    ]
    
    # 生成评价
    rating_result = await ai_service.generate_product_rating(
        document_content=review.document.content or "",
        product_name=review.product_name,
        qa_history=qa_history,
        dimensions_config=dimensions_config,
        image_base64=review.document.image_base64,
        image_type=review.document.image_type
    )
    
    # 如果已存在评价,先删除
    existing_rating = db.query(ProductAIRating).filter(
        ProductAIRating.product_review_id == review_id
    ).first()
    if existing_rating:
        db.delete(existing_rating)
    
    # 保存评价
    ai_rating = ProductAIRating(
        product_review_id=review_id,
        radar_data=json.dumps(rating_result.get("radar_data", {}), ensure_ascii=False),
        analysis=json.dumps(rating_result.get("analysis", []), ensure_ascii=False),
        suggestions=json.dumps(rating_result.get("suggestions", []), ensure_ascii=False)
    )
    
    db.add(ai_rating)
    db.commit()
    db.refresh(ai_rating)
    
    return {
        "message": "AI评价生成成功",
        "rating": rating_result
    }


@router.get("/{review_id}/ai-rating")
def get_product_ai_rating(review_id: int, db: Session = Depends(get_db)):
    """获取AI评价"""
    rating = db.query(ProductAIRating).filter(
        ProductAIRating.product_review_id == review_id
    ).first()
    
    if not rating:
        raise HTTPException(status_code=404, detail="AI评价不存在")
    
    return {
        "id": rating.id,
        "product_review_id": rating.product_review_id,
        "radar_data": json.loads(rating.radar_data) if rating.radar_data else {},
        "analysis": json.loads(rating.analysis) if rating.analysis else [],
        "suggestions": json.loads(rating.suggestions) if rating.suggestions else [],
        "created_at": rating.created_at
    }