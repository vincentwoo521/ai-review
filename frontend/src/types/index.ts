// 项目相关
export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  reviews_count?: number;
}

export interface ProjectCreate {
  name: string;
  description: string;
}

// 评审相关
export interface Review {
  id: number;
  project_id: number;
  review_type: string;
  status: 'pending' | 'in_progress' | 'completed';
  meeting_date?: string;
  created_at: string;
  document?: Document;
  judges?: Judge[];
}

export interface ReviewCreate {
  project_id: number;
  review_type: string;
  judge_ids: number[];
}

// 文档相关
export interface Document {
  id: number;
  review_id: number;
  file_name: string;
  file_path?: string;
  content?: string;
  uploaded_at: string;
  paragraphs: Paragraph[];
}

export interface Paragraph {
  id: number;
  document_id: number;
  paragraph_index: number;
  content: string;
  page_number: number;
}

// 评委相关
export interface Judge {
  id: number;
  name: string;
  organization?: string | null;
  expertise?: string[] | null;
  created_at: string;
  stats?: JudgeStats;
}

export interface JudgeCreate {
  name: string;
  organization?: string;
  expertise?: string[];
}

export interface JudgeStats {
  id: number;
  judge_id: number;
  total_questions: number;
  avg_relevance_score: number;
  avg_depth_score: number;
  avg_inspiration_score: number;
  avg_quality_score?: number;
  total_ratings: number;
  avg_rating: number;
  name?: string;
  organization?: string;
}

export interface JudgeQuestion {
  id: number;
  review_id: number;
  project_name?: string;
  review_type?: string;
  question_content: string;
  quality_score?: number;
  quality_dimensions?: QualityDimensions;
  created_at: string;
}

export interface JudgeSummary {
  judge: {
    id: number;
    name: string;
    organization?: string;
  };
  total_questions: number;
  avg_score?: number;
  dimension_scores?: {
    relevance?: number;
    depth?: number;
    inspiration?: number;
    clarity?: number;
  };
}

// 提问相关
export interface AIQuestion {
  id: number;
  review_id: number;
  question_content: string;
  answer_content?: string;
  question_type?: string;
  sequence?: number;
  created_at: string;
  paragraph_reference?: number[];
}

export interface HumanQuestion {
  id: number;
  review_id: number;
  judge_id: number;
  question_content: string;
  answer_content?: string;
  quality_score?: number;
  quality_dimensions?: QualityDimensions;
  sequence?: number;
  created_at: string;
}

export interface QualityDimensions {
  relevance?: number;
  depth?: number;
  inspiration?: number;
  clarity?: number;
  feedback?: string;
}

export interface QualityScore {
  relevance_score: number;
  depth_score: number;
  inspiration_score: number;
  feedback: string;
}

// 评分相关
export interface AIRating {
  id: number;
  review_id: number;
  total_score?: number;
  dimensions?: string;  // JSON字符串
  reasoning?: string;
  created_at: string;
  // 解析后的字段（前端使用）
  overall_score?: number;
  innovation_score?: number;
  feasibility_score?: number;
  impact_score?: number;
  presentation_score?: number;
  comments?: string;
  // 动态维度字段
  dimensions_meta?: Array<{name: string; weight: number}>;
  dimension_1_score?: number;
  dimension_2_score?: number;
  dimension_3_score?: number;
  dimension_4_score?: number;
}

export interface HumanRating {
  id: number;
  review_id: number;
  judge_id: number;
  overall_score: number;
  innovation_score: number;
  feasibility_score: number;
  impact_score: number;
  presentation_score: number;
  comments: string;
  created_at: string;
}

// 看板统计
export interface DashboardStats {
  total_projects: number;
  total_reviews: number;
  completed_reviews: number;
  total_judges: number;
  avg_rating: number;
  top_judges: JudgeStats[];
}

// 评审维度配置
export interface DimensionItem {
  name: string;
  weight: number;
  description: string;
}

export interface ReviewDimensionConfig {
  id: number;
  review_type: string;
  name: string;
  description: string;
  dimensions: DimensionItem[];
  prompt_template: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewDimensionConfigCreate {
  review_type: string;
  name: string;
  description?: string;
  dimensions: DimensionItem[];
  prompt_template?: string;
}

// 提问质量评价标准配置
export interface GradeLevel {
  level: string;
  range: string;
  description: string;
}

export interface QuestionQualityConfig {
  id: number;
  name: string;
  description: string;
  dimensions: DimensionItem[];
  grade_levels: GradeLevel[];
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionQualityConfigCreate {
  name: string;
  description?: string;
  dimensions: DimensionItem[];
  grade_levels?: GradeLevel[];
}

// 产品评审相关
export interface ProductReview {
  id: number;
  product_name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  judges?: Judge[];
  document?: ProductDocument;
  ai_questions?: ProductAIQuestion[];
  human_questions?: ProductHumanQuestion[];
  ai_rating?: ProductAIRating;
}

export interface ProductReviewCreate {
  product_name: string;
  description?: string;
  judge_ids?: number[];
}

export interface ProductDocument {
  id: number;
  product_review_id: number;
  file_name: string;
  content?: string;
  uploaded_at: string;
}

export interface ProductAIQuestion {
  id: number;
  product_review_id: number;
  question_content: string;
  answer_content?: string;
  sequence?: number;
  created_at: string;
}

export interface ProductHumanQuestion {
  id: number;
  product_review_id: number;
  judge_id: number;
  question_content: string;
  answer_content?: string;
  sequence?: number;
  created_at: string;
}

export interface ProductAIRating {
  id: number;
  product_review_id: number;
  radar_data: {
    market_potential: number;
    future_roadmap: number;
    feature_expansion: number;
    competitive_moat: number;
  };
  analysis: ProductAnalysisItem[];
  suggestions: string[];
  created_at: string;
}

export interface ProductAnalysisItem {
  dimension: string;
  score: number;
  highlights: string;
  risks: string;
  reasoning: string;
}