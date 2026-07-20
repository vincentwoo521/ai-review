from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, DECIMAL, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


# 评审-评委关联表（多对多）
review_judges = Table(
    'review_judges',
    Base.metadata,
    Column('review_id', Integer, ForeignKey('reviews.id'), primary_key=True),
    Column('judge_id', Integer, ForeignKey('judges.id'), primary_key=True)
)

# 产品评审-评委关联表（多对多）
product_review_judges = Table(
    'product_review_judges',
    Base.metadata,
    Column('product_review_id', Integer, ForeignKey('product_reviews.id'), primary_key=True),
    Column('judge_id', Integer, ForeignKey('judges.id'), primary_key=True)
)


class Project(Base):
    """项目表"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    reviews = relationship("Review", back_populates="project")


class Review(Base):
    """评审会表"""
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    review_type = Column(String(50), nullable=False)  # project_initiation / commercialization
    status = Column(String(20), default="pending")  # pending / in_progress / completed
    meeting_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    project = relationship("Project", back_populates="reviews")
    document = relationship("Document", back_populates="review", uselist=False)
    ai_questions = relationship("AIQuestion", back_populates="review")
    human_questions = relationship("HumanQuestion", back_populates="review")
    ai_rating = relationship("AIRating", back_populates="review", uselist=False)
    human_ratings = relationship("HumanRating", back_populates="review")
    judges = relationship("Judge", secondary=review_judges, back_populates="reviews")


class Document(Base):
    """评审文档表"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), unique=True, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    content = Column(Text)
    paragraphs = Column(Text)  # JSON格式存储段落信息
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    review = relationship("Review", back_populates="document")


class Judge(Base):
    """评委表"""
    __tablename__ = "judges"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    department = Column(String(100))
    organization = Column(String(100))
    expertise = Column(Text)  # JSON格式存储专业领域列表
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    reviews = relationship("Review", secondary=review_judges, back_populates="judges")
    human_questions = relationship("HumanQuestion", back_populates="judge")
    human_ratings = relationship("HumanRating", back_populates="judge")
    stats = relationship("JudgeStats", back_populates="judge", uselist=False)
    product_reviews = relationship("ProductReview", secondary=product_review_judges, back_populates="judges")
    product_human_questions = relationship("ProductHumanQuestion", back_populates="judge")


class AIQuestion(Base):
    """AI提问记录表"""
    __tablename__ = "ai_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False)
    question_type = Column(String(20), nullable=False)  # full_text / paragraph
    question_content = Column(Text, nullable=False)
    paragraph_reference = Column(Text)
    answer_content = Column(Text)
    sequence = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    review = relationship("Review", back_populates="ai_questions")


class HumanQuestion(Base):
    """人类提问记录表"""
    __tablename__ = "human_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False)
    judge_id = Column(Integer, ForeignKey("judges.id"), nullable=False)
    question_content = Column(Text, nullable=False)
    answer_content = Column(Text)
    quality_score = Column(DECIMAL(3, 2))
    quality_dimensions = Column(Text)  # JSON格式
    sequence = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    review = relationship("Review", back_populates="human_questions")
    judge = relationship("Judge", back_populates="human_questions")


class AIRating(Base):
    """AI评分记录表"""
    __tablename__ = "ai_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), unique=True, nullable=False)
    total_score = Column(DECIMAL(4, 2))
    dimensions = Column(Text)  # JSON格式
    reasoning = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    review = relationship("Review", back_populates="ai_rating")


class HumanRating(Base):
    """人类评分记录表"""
    __tablename__ = "human_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False)
    judge_id = Column(Integer, ForeignKey("judges.id"), nullable=False)
    total_score = Column(DECIMAL(4, 2))
    dimensions = Column(Text)  # JSON格式
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    review = relationship("Review", back_populates="human_ratings")
    judge = relationship("Judge", back_populates="human_ratings")


class JudgeStats(Base):
    """评委统计表"""
    __tablename__ = "judge_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    judge_id = Column(Integer, ForeignKey("judges.id"), unique=True, nullable=False)
    total_questions = Column(Integer, default=0)
    avg_quality_score = Column(DECIMAL(3, 2))
    review_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    judge = relationship("Judge", back_populates="stats")


class ReviewDimensionConfig(Base):
    """评审维度配置表"""
    __tablename__ = "review_dimension_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    review_type = Column(String(50), unique=True, nullable=False)  # project_initiation / commercialization / product_review
    name = Column(String(100), nullable=False)  # 配置名称
    description = Column(Text)  # 配置描述
    dimensions = Column(Text, nullable=False)  # JSON格式的维度配置
    prompt_template = Column(Text)  # Prompt模板
    is_active = Column(Integer, default=1)  # 是否启用
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QuestionQualityConfig(Base):
    """提问质量评价标准配置表"""
    __tablename__ = "question_quality_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # 配置名称
    description = Column(Text)  # 配置描述
    dimensions = Column(Text, nullable=False)  # JSON格式的评价维度配置
    grade_levels = Column(Text)  # JSON格式的等级参考
    is_active = Column(Integer, default=1)  # 是否启用
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProductReview(Base):
    """待发布产品评审表"""
    __tablename__ = "product_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(200), nullable=False)  # 产品名称
    description = Column(Text)  # 产品描述
    status = Column(String(20), default="pending")  # pending / in_progress / completed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    document = relationship("ProductDocument", back_populates="product_review", uselist=False)
    ai_questions = relationship("ProductAIQuestion", back_populates="product_review")
    human_questions = relationship("ProductHumanQuestion", back_populates="product_review")
    ai_rating = relationship("ProductAIRating", back_populates="product_review", uselist=False)
    judges = relationship("Judge", secondary=product_review_judges, back_populates="product_reviews")


class ProductDocument(Base):
    """产品评审文档表"""
    __tablename__ = "product_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    product_review_id = Column(Integer, ForeignKey("product_reviews.id"), unique=True, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    content = Column(Text)
    file_type = Column(String(20))  # pdf / image
    image_base64 = Column(Text)  # 图片类型时存储 base64 数据
    image_type = Column(String(20))  # jpeg / png 等
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    product_review = relationship("ProductReview", back_populates="document")


class ProductAIQuestion(Base):
    """产品评审AI提问记录表"""
    __tablename__ = "product_ai_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    product_review_id = Column(Integer, ForeignKey("product_reviews.id"), nullable=False)
    question_content = Column(Text, nullable=False)
    answer_content = Column(Text)
    sequence = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    product_review = relationship("ProductReview", back_populates="ai_questions")


class ProductHumanQuestion(Base):
    """产品评审人类提问记录表"""
    __tablename__ = "product_human_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    product_review_id = Column(Integer, ForeignKey("product_reviews.id"), nullable=False)
    judge_id = Column(Integer, ForeignKey("judges.id"), nullable=False)
    question_content = Column(Text, nullable=False)
    answer_content = Column(Text)
    sequence = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    product_review = relationship("ProductReview", back_populates="human_questions")
    judge = relationship("Judge", back_populates="product_human_questions")


class ProductAIRating(Base):
    """产品评审AI评分记录表"""
    __tablename__ = "product_ai_ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    product_review_id = Column(Integer, ForeignKey("product_reviews.id"), unique=True, nullable=False)
    radar_data = Column(Text)  # JSON格式存储雷达图数据
    analysis = Column(Text)  # 维度深度解析 JSON
    suggestions = Column(Text)  # 战略建议 JSON
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    product_review = relationship("ProductReview", back_populates="ai_rating")