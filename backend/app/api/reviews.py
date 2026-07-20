from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Review, Document, Project, Judge, AIQuestion
from app.schemas import ReviewCreate, ReviewUpdate, ReviewResponse
from app.document_parser import document_parser
import json

router = APIRouter()


@router.post("/", response_model=ReviewResponse)
def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    """创建新评审会"""
    # 验证项目存在
    project = db.query(Project).filter(Project.id == review.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    db_review = Review(
        project_id=review.project_id,
        review_type=review.review_type,
        meeting_date=review.meeting_date
    )
    
    # 添加评委
    if review.judge_ids:
        judges = db.query(Judge).filter(Judge.id.in_(review.judge_ids)).all()
        db_review.judges = judges
    
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review


@router.get("/", response_model=List[ReviewResponse])
def list_reviews(project_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取评审列表"""
    query = db.query(Review)
    if project_id:
        query = query.filter(Review.project_id == project_id)
    reviews = query.offset(skip).limit(limit).all()
    return reviews


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    """获取评审详情"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    return review


@router.put("/{review_id}", response_model=ReviewResponse)
def update_review(review_id: int, review: ReviewUpdate, db: Session = Depends(get_db)):
    """更新评审"""
    db_review = db.query(Review).filter(Review.id == review_id).first()
    if not db_review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    if review.status is not None:
        db_review.status = review.status
    if review.meeting_date is not None:
        db_review.meeting_date = review.meeting_date
    if review.judge_ids is not None:
        judges = db.query(Judge).filter(Judge.id.in_(review.judge_ids)).all()
        db_review.judges = judges
    
    db.commit()
    db.refresh(db_review)
    return db_review


@router.post("/{review_id}/upload-document")
async def upload_document(
    review_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传评审文档"""
    # 验证评审存在
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    # 验证文件类型
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="只支持PDF格式文件")
    
    # 读取文件内容
    file_content = await file.read()
    
    # 保存文件
    file_path = document_parser.save_uploaded_file(file_content, file.filename)
    
    # 解析PDF
    try:
        parsed_result = document_parser.parse_pdf(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文档解析失败: {str(e)}")
    
    # 保存到数据库
    document = Document(
        review_id=review_id,
        file_name=file.filename,
        file_path=file_path,
        content=parsed_result["content"],
        paragraphs=json.dumps(parsed_result["paragraphs"], ensure_ascii=False)
    )
    
    # 如果已存在文档,先删除
    existing_doc = db.query(Document).filter(Document.review_id == review_id).first()
    if existing_doc:
        db.delete(existing_doc)
    
    # 清除旧的AI提问记录，避免数据混淆
    db.query(AIQuestion).filter(AIQuestion.review_id == review_id).delete()
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return {
        "id": document.id,
        "review_id": document.review_id,
        "file_name": document.file_name,
        "file_path": document.file_path,
        "content": document.content,
        "paragraphs": json.loads(document.paragraphs) if document.paragraphs else [],
        "uploaded_at": document.uploaded_at
    }


@router.get("/{review_id}/document")
def get_review_document(review_id: int, db: Session = Depends(get_db)):
    """获取评审文档"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    document = review.document
    
    return {
        "id": document.id,
        "file_name": document.file_name,
        "content": document.content,
        "paragraphs": json.loads(document.paragraphs) if document.paragraphs else [],
        "uploaded_at": document.uploaded_at
    }


@router.delete("/{review_id}/document")
def delete_review_document(review_id: int, db: Session = Depends(get_db)):
    """清空评审文档"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    if not review.document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 删除文档
    document = review.document
    db.delete(document)
    
    # 清除相关的AI提问记录
    db.query(AIQuestion).filter(AIQuestion.review_id == review_id).delete()
    
    db.commit()
    
    return {"message": "文档已清空"}


@router.delete("/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db)):
    """删除评审"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    db.delete(review)
    db.commit()
    return {"message": "评审已删除"}


@router.patch("/{review_id}/status")
def update_review_status(review_id: int, status_data: dict, db: Session = Depends(get_db)):
    """更新评审状态"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    if "status" not in status_data:
        raise HTTPException(status_code=400, detail="缺少状态参数")
    
    review.status = status_data["status"]
    db.commit()
    db.refresh(review)
    return review


@router.get("/{review_id}/ai-questions")
def get_ai_questions(review_id: int, db: Session = Depends(get_db)):
    """获取评审的AI问题列表"""
    from app.models import AIQuestion
    
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    questions = db.query(AIQuestion).filter(
        AIQuestion.review_id == review_id
    ).order_by(AIQuestion.sequence).all()
    
    # 转换为字典列表，确保所有字段正确序列化
    result = []
    for q in questions:
        result.append({
            "id": q.id,
            "review_id": q.review_id,
            "question_type": q.question_type,
            "question_content": q.question_content,
            "answer_content": q.answer_content,
            "paragraph_reference": q.paragraph_reference,
            "sequence": q.sequence,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        })
    
    return result


@router.get("/{review_id}/human-questions")
def get_human_questions(review_id: int, db: Session = Depends(get_db)):
    """获取评审的人类评委提问列表"""
    from app.models import HumanQuestion
    import json
    
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    questions = db.query(HumanQuestion).filter(
        HumanQuestion.review_id == review_id
    ).order_by(HumanQuestion.sequence).all()
    
    # 解析quality_dimensions JSON
    result = []
    for q in questions:
        q_dict = {
            "id": q.id,
            "review_id": q.review_id,
            "judge_id": q.judge_id,
            "question_content": q.question_content,
            "answer_content": q.answer_content,
            "quality_score": float(q.quality_score) if q.quality_score else None,
            "sequence": q.sequence,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
        if q.quality_dimensions:
            try:
                dims = json.loads(q.quality_dimensions)
                q_dict["quality_dimensions"] = {
                    "relevance": dims.get("relevance"),
                    "depth": dims.get("depth"),
                    "inspiration": dims.get("inspiration"),
                    "clarity": dims.get("clarity"),
                    "feedback": dims.get("feedback")
                }
            except:
                q_dict["quality_dimensions"] = None
        else:
            q_dict["quality_dimensions"] = None
        result.append(q_dict)
    
    return result


@router.post("/{review_id}/human-questions")
def create_human_question(
    review_id: int,
    question_data: dict,
    db: Session = Depends(get_db)
):
    """添加人类评委提问"""
    from app.models import HumanQuestion, Judge
    
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    # 验证评委
    judge_id = question_data.get("judge_id")
    if not judge_id:
        raise HTTPException(status_code=400, detail="缺少评委ID")
    
    judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 获取当前最大序列号
    max_sequence = db.query(HumanQuestion).filter(
        HumanQuestion.review_id == review_id
    ).count()
    
    # 兼容前端字段名（question 或 question_content）
    question_content = question_data.get("question") or question_data.get("question_content")
    if not question_content:
        raise HTTPException(status_code=400, detail="缺少提问内容")
    
    # 创建提问
    question = HumanQuestion(
        review_id=review_id,
        judge_id=judge_id,
        question_content=question_content,
        sequence=max_sequence + 1
    )
    
    db.add(question)
    db.commit()
    db.refresh(question)
    
    return question