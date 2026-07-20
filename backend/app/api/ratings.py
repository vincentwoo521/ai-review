from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Review, AIRating, HumanRating, AIQuestion, Judge, HumanQuestion, ReviewDimensionConfig
from app.schemas import AIRatingCreate, HumanRatingCreate, AIRatingResponse, HumanRatingResponse
from app.ai_service import get_ai_service
import json

router = APIRouter()


@router.post("/human-questions/{question_id}/evaluate")
async def evaluate_human_question(question_id: int, db: Session = Depends(get_db)):
    """评价人类评委提问质量"""
    # 获取提问
    question = db.query(HumanQuestion).filter(HumanQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="提问不存在")
    
    # 获取评审和文档
    review = db.query(Review).filter(Review.id == question.review_id).first()
    if not review or not review.document:
        raise HTTPException(status_code=400, detail="无法评价：评审或文档不存在")
    
    # 获取AI服务
    try:
        ai_service = get_ai_service()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 评价提问
    try:
        evaluation = await ai_service.evaluate_judge_question(
            question_content=question.question_content,
            document_content=review.document.content,
            review_type=review.review_type
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"评价失败: {str(e)}")
    
    # 保存评价结果
    question.quality_score = evaluation.get("total")
    question.quality_dimensions = json.dumps(evaluation, ensure_ascii=False)
    db.commit()
    db.refresh(question)
    
    return evaluation


@router.post("/ai-rating")
async def generate_ai_rating(review_id: int, db: Session = Depends(get_db)):
    """生成AI建议评分"""
    # 获取评审信息
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=400, detail="请先上传评审文档")
    
    # 获取AI服务
    try:
        ai_service = get_ai_service()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 准备问答历史
    ai_questions = db.query(AIQuestion).filter(
        AIQuestion.review_id == review_id
    ).order_by(AIQuestion.sequence).all()
    
    qa_history = [
        {
            "question": q.question_content,
            "answer": q.answer_content or "未回答"
        }
        for q in ai_questions
    ]
    
    # 调试日志
    print(f"[DEBUG] 生成AI评分 - review_id: {review_id}")
    print(f"[DEBUG] 文档内容前200字: {review.document.content[:200] if review.document else 'None'}")
    print(f"[DEBUG] 问答历史数量: {len(qa_history)}")
    
    # 获取评审维度配置
    dimension_config = db.query(ReviewDimensionConfig).filter(
        ReviewDimensionConfig.review_type == review.review_type
    ).first()
    
    dimensions_list = None
    if dimension_config:
        try:
            dimensions_list = json.loads(dimension_config.dimensions)
        except:
            pass
    
    # 生成评分
    try:
        rating_result = await ai_service.generate_rating(
            document_content=review.document.content,
            qa_history=qa_history,
            review_type=review.review_type,
            dimensions_config=dimensions_list
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI评分生成失败: {str(e)}")
    
    # 如果已存在评分,先删除
    existing_rating = db.query(AIRating).filter(AIRating.review_id == review_id).first()
    if existing_rating:
        db.delete(existing_rating)
        db.flush()  # 确保删除操作完成后再添加新记录
    
    # 保存AI评分记录
    ai_rating = AIRating(
        review_id=review_id,
        total_score=rating_result.get("total"),
        dimensions=json.dumps(rating_result, ensure_ascii=False),
        reasoning=rating_result.get("reasoning")
    )
    
    db.add(ai_rating)
    db.commit()
    db.refresh(ai_rating)
    
    return {
        "message": "AI评分生成成功",
        "rating": rating_result
    }


@router.get("/ai-rating/{review_id}")
def get_ai_rating(review_id: int, db: Session = Depends(get_db)):
    """获取AI建议评分"""
    rating = db.query(AIRating).filter(AIRating.review_id == review_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="AI评分不存在")
    
    return AIRatingResponse.from_orm_with_parse(rating)


@router.post("/human-rating", response_model=HumanRatingResponse)
def create_human_rating(rating: HumanRatingCreate, db: Session = Depends(get_db)):
    """创建人类评委评分"""
    # 验证评审存在
    review = db.query(Review).filter(Review.id == rating.review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    # 验证评委存在
    judge = db.query(Judge).filter(Judge.id == rating.judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 检查是否已评分
    existing = db.query(HumanRating).filter(
        HumanRating.review_id == rating.review_id,
        HumanRating.judge_id == rating.judge_id
    ).first()
    
    if existing:
        # 更新评分
        existing.total_score = rating.total_score
        existing.dimensions = rating.dimensions
        db.commit()
        db.refresh(existing)
        return existing
    
    # 创建新评分
    human_rating = HumanRating(
        review_id=rating.review_id,
        judge_id=rating.judge_id,
        total_score=rating.total_score,
        dimensions=rating.dimensions
    )
    db.add(human_rating)
    db.commit()
    db.refresh(human_rating)
    
    return human_rating


@router.get("/human-rating/{review_id}")
def get_review_human_ratings(review_id: int, db: Session = Depends(get_db)):
    """获取评审的所有人类评委评分"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    ratings = db.query(HumanRating).filter(HumanRating.review_id == review_id).all()
    
    return {
        "review_id": review_id,
        "ratings": ratings
    }