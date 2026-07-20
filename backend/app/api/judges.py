from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Judge, HumanQuestion, HumanRating, Review, JudgeStats
from app.schemas import JudgeCreate, JudgeResponse, HumanQuestionCreate
from app.ai_service import get_ai_service
import json

router = APIRouter()


@router.post("/", response_model=JudgeResponse)
def create_judge(judge: JudgeCreate, db: Session = Depends(get_db)):
    """创建评委"""
    import json
    db_judge = Judge(
        name=judge.name,
        organization=judge.organization,
        expertise=json.dumps(judge.expertise, ensure_ascii=False) if judge.expertise else None
    )
    db.add(db_judge)
    db.commit()
    db.refresh(db_judge)
    
    # 初始化统计记录
    stats = JudgeStats(judge_id=db_judge.id)
    db.add(stats)
    db.commit()
    
    return db_judge


@router.get("/", response_model=list[JudgeResponse])
def list_judges(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取评委列表"""
    judges = db.query(Judge).offset(skip).limit(limit).all()
    return judges


@router.get("/{judge_id}", response_model=JudgeResponse)
def get_judge(judge_id: int, db: Session = Depends(get_db)):
    """获取评委详情"""
    judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    return judge


@router.put("/{judge_id}", response_model=JudgeResponse)
def update_judge(judge_id: int, judge: JudgeCreate, db: Session = Depends(get_db)):
    """更新评委信息"""
    db_judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not db_judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    db_judge.name = judge.name
    db_judge.organization = judge.organization
    db_judge.expertise = json.dumps(judge.expertise, ensure_ascii=False) if judge.expertise else None
    
    db.commit()
    db.refresh(db_judge)
    return db_judge


@router.delete("/{judge_id}")
def delete_judge(judge_id: int, db: Session = Depends(get_db)):
    """删除评委"""
    judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 删除关联的统计数据
    db.query(JudgeStats).filter(JudgeStats.judge_id == judge_id).delete()
    
    # 删除关联的提问记录
    db.query(HumanQuestion).filter(HumanQuestion.judge_id == judge_id).delete()
    
    # 删除关联的评分记录
    db.query(HumanRating).filter(HumanRating.judge_id == judge_id).delete()
    
    # 删除评委
    db.delete(judge)
    db.commit()
    return {"message": "评委已删除"}


@router.post("/questions/evaluate")
async def evaluate_question_quality(
    question_id: int,
    db: Session = Depends(get_db)
):
    """评价评委提问质量"""
    # 获取问题
    question = db.query(HumanQuestion).filter(HumanQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    # 获取评审信息
    review = db.query(Review).filter(Review.id == question.review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    # 获取AI服务
    try:
        ai_service = get_ai_service()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 评价提问质量
    try:
        evaluation = await ai_service.evaluate_judge_question(
            question_content=question.question_content,
            document_content=review.document.content,
            review_type=review.review_type
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI评价失败: {str(e)}")
    
    # 更新问题评分
    question.quality_score = evaluation.get("total")
    question.quality_dimensions = json.dumps(evaluation, ensure_ascii=False)
    db.commit()
    
    # 更新评委统计
    stats = db.query(JudgeStats).filter(JudgeStats.judge_id == question.judge_id).first()
    if stats:
        stats.total_questions += 1
        stats.review_count = db.query(HumanQuestion).filter(
            HumanQuestion.judge_id == question.judge_id
        ).count()
        
        # 重新计算平均分
        all_questions = db.query(HumanQuestion).filter(
            HumanQuestion.judge_id == question.judge_id,
            HumanQuestion.quality_score.isnot(None)
        ).all()
        
        if all_questions:
            avg_score = sum([float(q.quality_score) for q in all_questions]) / len(all_questions)
            stats.avg_quality_score = avg_score
    
    db.commit()
    
    return {
        "message": "评价完成",
        "evaluation": evaluation
    }


@router.post("/questions")
def create_human_question(question: HumanQuestionCreate, db: Session = Depends(get_db)):
    """录入评委提问"""
    # 验证评审存在
    review = db.query(Review).filter(Review.id == question.review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    
    # 验证评委存在
    judge = db.query(Judge).filter(Judge.id == question.judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 获取当前最大序列号
    max_sequence = db.query(HumanQuestion).filter(
        HumanQuestion.review_id == question.review_id
    ).count()
    
    # 创建提问记录
    human_question = HumanQuestion(
        review_id=question.review_id,
        judge_id=question.judge_id,
        question_content=question.question_content,
        answer_content=question.answer_content,
        sequence=max_sequence + 1
    )
    db.add(human_question)
    db.commit()
    db.refresh(human_question)
    
    return human_question


@router.get("/{judge_id}/stats")
def get_judge_stats(judge_id: int, db: Session = Depends(get_db)):
    """获取评委统计数据"""
    judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    return judge.stats


@router.get("/{judge_id}/questions")
def get_judge_questions(
    judge_id: int, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """获取评委的所有提问记录（含评分详情）"""
    judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 查询该评委的所有提问
    questions = db.query(HumanQuestion).filter(
        HumanQuestion.judge_id == judge_id
    ).order_by(HumanQuestion.created_at.desc()).offset(skip).limit(limit).all()
    
    # 组装返回数据
    result = []
    for q in questions:
        # 获取评审信息
        review = db.query(Review).filter(Review.id == q.review_id).first()
        
        # 解析质量维度
        dimensions = None
        if q.quality_dimensions:
            try:
                dimensions = json.loads(q.quality_dimensions)
            except:
                pass
        
        result.append({
            "id": q.id,
            "review_id": q.review_id,
            "project_name": review.project.name if review and review.project else None,
            "review_type": review.review_type if review else None,
            "question_content": q.question_content,
            "quality_score": float(q.quality_score) if q.quality_score else None,
            "quality_dimensions": dimensions,
            "created_at": q.created_at.isoformat() if q.created_at else None
        })
    
    return result


@router.get("/{judge_id}/summary")
def get_judge_summary(judge_id: int, db: Session = Depends(get_db)):
    """获取评委综合评分汇总"""
    judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not judge:
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 获取所有已评价的提问
    questions = db.query(HumanQuestion).filter(
        HumanQuestion.judge_id == judge_id,
        HumanQuestion.quality_score.isnot(None)
    ).all()
    
    if not questions:
        return {
            "judge": {
                "id": judge.id,
                "name": judge.name,
                "organization": judge.organization
            },
            "total_questions": 0,
            "avg_score": None,
            "dimension_scores": None
        }
    
    # 计算总分和平均分
    total_score = sum([float(q.quality_score) for q in questions])
    avg_score = total_score / len(questions)
    
    # 计算各维度平均分
    dimension_totals = {
        "relevance": [],
        "depth": [],
        "inspiration": [],
        "clarity": []
    }
    
    for q in questions:
        if q.quality_dimensions:
            try:
                dims = json.loads(q.quality_dimensions)
                for key in dimension_totals.keys():
                    if key in dims and dims[key] is not None:
                        dimension_totals[key].append(float(dims[key]))
            except:
                pass
    
    dimension_scores = {}
    for key, values in dimension_totals.items():
        if values:
            dimension_scores[key] = round(sum(values) / len(values), 2)
    
    return {
        "judge": {
            "id": judge.id,
            "name": judge.name,
            "organization": judge.organization
        },
        "total_questions": len(questions),
        "avg_score": round(avg_score, 2),
        "dimension_scores": dimension_scores
    }