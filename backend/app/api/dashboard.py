from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Project, Review, Judge, HumanRating, AIRating, HumanQuestion, JudgeStats
from datetime import datetime

router = APIRouter()


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """看板统计数据"""
    total_projects = db.query(Project).count()
    total_reviews = db.query(Review).count()
    completed_reviews = db.query(Review).filter(Review.status == 'completed').count()
    total_judges = db.query(Judge).count()
    
    # 计算平均项目评审评分（基于AI评审评分）
    avg_rating = 0.0
    ai_ratings = db.query(AIRating).filter(
        AIRating.total_score.isnot(None)
    ).all()
    if ai_ratings:
        total_score = sum(float(r.total_score) for r in ai_ratings)
        avg_rating = round(total_score / len(ai_ratings), 2)
    
    # 顶级评委（按提问质量评分）
    top_judges_query = db.query(JudgeStats).join(Judge).filter(
        JudgeStats.avg_quality_score.isnot(None)
    ).order_by(
        JudgeStats.avg_quality_score.desc()
    ).limit(5).all()
    
    top_judges = [
        {
            "id": stat.judge.id,
            "judge_id": stat.judge.id,
            "name": stat.judge.name,
            "organization": stat.judge.organization,
            "total_questions": stat.total_questions,
            "avg_rating": float(stat.avg_quality_score) if stat.avg_quality_score else 0.0
        }
        for stat in top_judges_query
    ]
    
    return {
        "total_projects": total_projects,
        "total_reviews": total_reviews,
        "completed_reviews": completed_reviews,
        "total_judges": total_judges,
        "avg_rating": avg_rating,
        "top_judges": top_judges
    }


@router.get("/projects/{project_id}")
def get_project_dashboard(project_id: int, db: Session = Depends(get_db)):
    """项目维度看板"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 获取该项目的所有评审
    reviews = db.query(Review).filter(Review.project_id == project_id).all()
    
    # 统计数据
    total_reviews = len(reviews)
    completed_reviews = [r for r in reviews if r.status == 'completed']
    
    # 计算平均分
    avg_score = None
    if completed_reviews:
        scores = []
        for review in completed_reviews:
            if review.human_ratings:
                for rating in review.human_ratings:
                    scores.append(float(rating.total_score))
        if scores:
            avg_score = sum(scores) / len(scores)
    
    # 最新评审日期
    latest_review = None
    if reviews:
        latest_review = max([r.created_at for r in reviews])
    
    return {
        "project": project,
        "total_reviews": total_reviews,
        "completed_reviews": len(completed_reviews),
        "avg_score": avg_score,
        "latest_review_date": latest_review,
        "reviews": reviews
    }


@router.get("/judges/{judge_id}")
def get_judge_dashboard(judge_id: int, db: Session = Depends(get_db)):
    """评委维度看板"""
    judge = db.query(Judge).filter(Judge.id == judge_id).first()
    if not judge:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="评委不存在")
    
    # 获取评委统计
    stats = judge.stats
    
    # 获取评委的所有提问
    from app.models import HumanQuestion
    questions = db.query(HumanQuestion).filter(
        HumanQuestion.judge_id == judge_id
    ).order_by(HumanQuestion.created_at.desc()).limit(10).all()
    
    # 获取评委的所有评分
    ratings = db.query(HumanRating).filter(
        HumanRating.judge_id == judge_id
    ).order_by(HumanRating.created_at.desc()).all()
    
    return {
        "judge": judge,
        "stats": stats,
        "recent_questions": questions,
        "ratings": ratings
    }


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    """总览看板"""
    total_projects = db.query(Project).count()
    total_reviews = db.query(Review).count()
    total_judges = db.query(Judge).count()
    
    return {
        "total_projects": total_projects,
        "total_reviews": total_reviews,
        "total_judges": total_judges
    }