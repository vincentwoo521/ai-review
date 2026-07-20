from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Review, AIQuestion, ReviewDimensionConfig
from app.schemas import ChatRequest, ChatResponse, AIQuestionCreate
from app.ai_service import get_ai_service
import json

router = APIRouter()


@router.post("/generate-question")
async def generate_ai_question(request: ChatRequest, db: Session = Depends(get_db)):
    """生成AI提问 - 返回结构化的问题列表"""
    # 获取评审信息
    review = db.query(Review).filter(Review.id == request.review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=400, detail="请先上传评审文档")
    
    # 获取AI服务
    try:
        ai_service = get_ai_service()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 准备文档内容
    document_content = review.document.content
    
    # 调试日志：打印文档内容长度和前200字符
    print(f"[DEBUG] review_id={request.review_id}, document_content长度={len(document_content) if document_content else 0}")
    print(f"[DEBUG] document_content前200字符: {document_content[:200] if document_content else 'None'}")
    
    # 准备对话历史
    conversation_history = None
    if request.conversation_history:
        conversation_history = request.conversation_history
    
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
    
    # 生成问题
    try:
        questions_text = await ai_service.generate_question(
            document_content=document_content,
            review_type=review.review_type,
            conversation_history=conversation_history,
            dimensions_config=dimensions_list
        )
        print(f"[DEBUG] AI返回的原始文本: {questions_text[:300]}...")
    except Exception as e:
        print(f"[ERROR] AI生成问题失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI生成问题失败: {str(e)}")
    
    # 解析问题列表（按行分割并提取编号的问题）
    questions = []
    lines = questions_text.strip().split('\n')
    for line in lines:
        line = line.strip()
        if line and (line[0].isdigit() or line.startswith('-') or line.startswith('•')):
            # 移除编号前缀
            question = line
            for prefix in ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '-', '•']:
                if question.startswith(prefix):
                    question = question[len(prefix):].strip()
                    break
            if question:
                questions.append(question)
    
    # 如果解析失败，将整个文本作为单个问题
    if not questions:
        questions = [questions_text]
    
    # 获取当前最大序列号
    max_sequence = db.query(AIQuestion).filter(
        AIQuestion.review_id == request.review_id
    ).count()
    
    # 保存每个问题到数据库
    saved_questions = []
    for idx, question in enumerate(questions):
        ai_question = AIQuestion(
            review_id=request.review_id,
            question_type="full_text",
            question_content=question,
            paragraph_reference=None,
            sequence=max_sequence + idx + 1
        )
        db.add(ai_question)
        saved_questions.append(ai_question)
    
    db.commit()
    for q in saved_questions:
        db.refresh(q)
    
    return {
        "questions": saved_questions,
        "raw_text": questions_text
    }


@router.post("/questions/{question_id}/answer")
async def answer_ai_question(
    question_id: int,
    answer: str,
    db: Session = Depends(get_db)
):
    """记录AI提问的回答并生成追问"""
    question = db.query(AIQuestion).filter(AIQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    # 保存回答
    question.answer_content = answer
    db.commit()
    
    # 获取评审信息
    review = db.query(Review).filter(Review.id == question.review_id).first()
    if not review or not review.document:
        return {"message": "回答已记录", "followup": None}
    
    # 生成追问
    try:
        ai_service = get_ai_service()
        followup = await ai_service.generate_followup_question(
            document_content=review.document.content,
            review_type=review.review_type,
            question=question.question_content,
            answer=answer
        )
        
        # 保存追问
        max_sequence = db.query(AIQuestion).filter(
            AIQuestion.review_id == question.review_id
        ).count()
        
        followup_question = AIQuestion(
            review_id=question.review_id,
            question_type="followup",
            question_content=followup,
            paragraph_reference=None,
            sequence=max_sequence + 1
        )
        db.add(followup_question)
        db.commit()
        db.refresh(followup_question)
        
        return {
            "message": "回答已记录",
            "followup": followup_question
        }
    except Exception as e:
        # 追问失败不影响回答保存
        return {"message": "回答已记录", "followup": None, "error": str(e)}


@router.get("/reviews/{review_id}/questions")
def get_review_questions(review_id: int, db: Session = Depends(get_db)):
    """获取评审的所有AI提问记录"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    questions = db.query(AIQuestion).filter(
        AIQuestion.review_id == review_id
    ).order_by(AIQuestion.sequence).all()
    
    return {
        "review_id": review_id,
        "questions": questions
    }


@router.get("/questions/{question_id}")
def get_question_detail(question_id: int, db: Session = Depends(get_db)):
    """获取单个问题的详情"""
    question = db.query(AIQuestion).filter(AIQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    return question