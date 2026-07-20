"""初始化评审维度和提问质量评价标准配置"""
import json
from app.database import SessionLocal, Base, engine
from app.models import ReviewDimensionConfig, QuestionQualityConfig

# 确保数据库表已创建
Base.metadata.create_all(bind=engine)


def init_review_dimensions():
    """初始化评审维度配置"""
    db = SessionLocal()
    try:
        # 检查是否已存在
        if db.query(ReviewDimensionConfig).count() > 0:
            print("评审维度配置已存在，跳过初始化")
            return
        
        # 产品立项评审配置
        project_initiation = ReviewDimensionConfig(
            review_type="project_initiation",
            name="产品立项评审",
            description="关注从0到1的可行性与必要性。核心视角：需求真伪、技术落地、资源投入。",
            dimensions=json.dumps([
                {
                    "name": "需求与市场价值",
                    "weight": 30,
                    "description": "痛点是否真实存在？目标用户是否清晰？市场空间与预期收益是否合理？"
                },
                {
                    "name": "技术与资源可行性",
                    "weight": 30,
                    "description": "现有技术栈能否支撑？内外部资源（人力、硬件、数据）是否具备？是否存在不可逾越的技术壁垒？"
                },
                {
                    "name": "产品定位与差异化",
                    "weight": 20,
                    "description": "核心竞争优势是否可靠？与现有竞品或内部老产品的差异化在哪里？"
                },
                {
                    "name": "风险与应对",
                    "weight": 20,
                    "description": "是否识别了核心技术风险、合规风险或供应链风险？应对预案是否有效？"
                }
            ]),
            prompt_template="你现在是一位资深的产品立项评审专家。请阅读以下文档内容，严格按照{dimensions}这些维度进行评估。请给出每个维度的得分（满分10分）以及综合建议分数，并说明扣分原因。",
            is_active=1
        )
        
        # 产品商业化评审配置
        commercialization = ReviewDimensionConfig(
            review_type="commercialization",
            name="产品商业化评审",
            description="关注从1到N的变现能力与商业闭环。核心视角：盈利模式、成本结构、规模化能力。",
            dimensions=json.dumps([
                {
                    "name": "商业模式与闭环",
                    "weight": 30,
                    "description": "盈利路径是否清晰？获客成本（CAC）与客户终身价值（LTV）模型是否健康？商业逻辑是否形成闭环？"
                },
                {
                    "name": "ROI与财务预测",
                    "weight": 30,
                    "description": "投入产出比（ROI）测算是否严谨？盈亏平衡点（BEP）预测是否合理？现金流规划是否安全？"
                },
                {
                    "name": "市场推广与GTM策略",
                    "weight": 20,
                    "description": "销售渠道是否打通？定价策略是否符合市场规律？营销预算是否匹配预期目标？"
                },
                {
                    "name": "规模化与运营壁垒",
                    "weight": 20,
                    "description": "产品是否具备规模化复制的能力？长期运营是否具备护城河（如数据积累、生态绑定）？"
                }
            ]),
            prompt_template="你现在是一位资深的产品商业化评审专家。请阅读以下文档内容，严格按照{dimensions}这些维度进行评估。请给出每个维度的得分（满分10分）以及综合建议分数，并说明扣分原因。",
            is_active=1
        )
        
        db.add(project_initiation)
        db.add(commercialization)
        db.commit()
        print("评审维度配置初始化完成")
    finally:
        db.close()


def init_question_quality():
    """初始化提问质量评价标准配置"""
    db = SessionLocal()
    try:
        # 检查是否已存在
        if db.query(QuestionQualityConfig).count() > 0:
            print("提问质量评价标准配置已存在，跳过初始化")
            return
        
        config = QuestionQualityConfig(
            name="默认提问质量评价标准",
            description="AI在会后分析人类评委提问时的评价标准，基于4个维度进行1-10分打分",
            dimensions=json.dumps([
                {
                    "name": "切题度与准确性",
                    "weight": 30,
                    "description": "提问是否精准命中了汇报材料的痛点或核心逻辑漏洞？是否存在理解偏差或偏离主题？"
                },
                {
                    "name": "深度与启发性",
                    "weight": 30,
                    "description": "是停留在表面的'是什么'，还是深挖了底层的'为什么'和'怎么做'？是否能启发项目负责人进行更深层次的思考？"
                },
                {
                    "name": "建设性与价值",
                    "weight": 20,
                    "description": "提问是否有助于推动项目改进或帮助决策者看清风险？（例如：指出潜在合规风险、提出优化成本的建议）"
                },
                {
                    "name": "表达与逻辑",
                    "weight": 20,
                    "description": "提问是否简明扼要、逻辑清晰？是否存在重复提问、无效提问或情绪化表达？"
                }
            ]),
            grade_levels=json.dumps([
                {
                    "level": "优秀",
                    "range": "8-10分",
                    "description": "直击要害，深度剖析，极具启发性与建设性"
                },
                {
                    "level": "良好",
                    "range": "6-7分",
                    "description": "切中主题，有一定深度，有助于完善方案"
                },
                {
                    "level": "一般",
                    "range": "4-5分",
                    "description": "问题较浅，偏向细节确认，或存在轻微的理解偏差"
                },
                {
                    "level": "较差",
                    "range": "1-4分",
                    "description": "偏离主题、逻辑混乱、重复提问或毫无建设性"
                }
            ]),
            is_active=1
        )
        
        db.add(config)
        db.commit()
        print("提问质量评价标准配置初始化完成")
    finally:
        db.close()


if __name__ == "__main__":
    print("开始初始化配置数据...")
    init_review_dimensions()
    init_question_quality()
    print("配置数据初始化完成")