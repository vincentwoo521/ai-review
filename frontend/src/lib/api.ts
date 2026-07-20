import axios from 'axios';
import type {
  Project,
  ProjectCreate,
  Review,
  ReviewCreate,
  Judge,
  JudgeCreate,
  Document,
  AIQuestion,
  HumanQuestion,
  AIRating,
  HumanRating,
  DashboardStats,
  QualityScore,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60秒超时，适应大文件上传和解析
  headers: {
    'Content-Type': 'application/json',
  },
});

// 项目管理API
export const projectApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: number) => api.get<Project>(`/projects/${id}`),
  create: (data: ProjectCreate) => api.post<Project>('/projects/', data),
  update: (id: number, data: Partial<ProjectCreate>) => api.put<Project>(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
};

// 评审管理API
export const reviewApi = {
  list: (projectId?: number) => api.get<Review[]>('/reviews/', { params: { project_id: projectId } }),
  get: (id: number) => api.get<Review>(`/reviews/${id}`),
  create: (data: ReviewCreate) => api.post<Review>('/reviews/', data),
  updateStatus: (id: number, status: Review['status']) => 
    api.patch<Review>(`/reviews/${id}/status`, { status }),
  updateJudges: (id: number, judgeIds: number[]) =>
    api.put<Review>(`/reviews/${id}`, { judge_ids: judgeIds }),
};

// 文档上传API
export const documentApi = {
  upload: (reviewId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Document>(`/reviews/${reviewId}/upload-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 文件上传和PDF解析需要更长超时时间
    });
  },
  get: (reviewId: number) => api.get<Document>(`/reviews/${reviewId}/document`),
  delete: (reviewId: number) => api.delete(`/reviews/${reviewId}/document`),
};

// 评委管理API
export const judgeApi = {
  list: () => api.get<Judge[]>('/judges'),
  get: (id: number) => api.get<Judge>(`/judges/${id}`),
  create: (data: JudgeCreate) => api.post<Judge>('/judges/', data),
  update: (id: number, data: Partial<JudgeCreate>) => api.put<Judge>(`/judges/${id}`, data),
  delete: (id: number) => api.delete(`/judges/${id}`),
  getStats: (id: number) => api.get<import('../types').JudgeStats>(`/judges/${id}/stats`),
  getQuestions: (id: number) => api.get<import('../types').JudgeQuestion[]>(`/judges/${id}/questions`),
  getSummary: (id: number) => api.get<import('../types').JudgeSummary>(`/judges/${id}/summary`),
};

// AI提问API
export const aiQuestionApi = {
  generate: (reviewId: number, conversationHistory?: Array<{role: string, content: string}>) =>
    api.post<{questions: AIQuestion[], raw_text: string}>(`/ai/generate-question`, {
      review_id: reviewId,
      conversation_history: conversationHistory || [],
    }),
  list: (reviewId: number) => api.get<AIQuestion[]>(`/reviews/${reviewId}/ai-questions`),
  answer: (questionId: number, answer: string) =>
    api.post<{message: string; followup?: AIQuestion}>(`/ai/questions/${questionId}/answer`, null, { params: { answer } }),
};

// 人类提问API
export const humanQuestionApi = {
  create: (reviewId: number, judgeId: number, question: string, aiQuestionId?: number) =>
    api.post<HumanQuestion>(`/reviews/${reviewId}/human-questions`, {
      judge_id: judgeId,
      ai_question_id: aiQuestionId,
      question,
    }),
  list: (reviewId: number) => api.get<HumanQuestion[]>(`/reviews/${reviewId}/human-questions`),
  evaluate: (questionId: number) =>
    api.post<QualityScore>(`/ratings/human-questions/${questionId}/evaluate`),
};

// AI评分API
export const aiRatingApi = {
  generate: (reviewId: number) => api.post<{ message: string; rating: AIRating }>(`/ratings/ai-rating?review_id=${reviewId}`),
  get: (reviewId: number) => api.get<AIRating>(`/ratings/ai-rating/${reviewId}`),
};

// 人类评分API
export const humanRatingApi = {
  create: (reviewId: number, judgeId: number, rating: Omit<HumanRating, 'id' | 'review_id' | 'judge_id' | 'created_at'>) =>
    api.post<HumanRating>(`/ratings/human-rating`, {
      review_id: reviewId,
      judge_id: judgeId,
      ...rating,
    }),
  get: (reviewId: number) => api.get<HumanRating>(`/ratings/human-rating/${reviewId}`),
};

// 看板统计API
export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  getReviewsByMonth: (year: number) =>
    api.get<{ month: string; count: number }[]>('/dashboard/reviews-by-month/', { params: { year } }),
  getTopJudges: (limit?: number) =>
    api.get<Judge[]>('/dashboard/top-judges/', { params: { limit } }),
};

// 配置管理API
export const configApi = {
  // 评审维度配置
  listReviewDimensions: () => api.get<import('../types').ReviewDimensionConfig[]>('/configs/review-dimensions'),
  getReviewDimension: (reviewType: string) => api.get<import('../types').ReviewDimensionConfig>(`/configs/review-dimensions/${reviewType}`),
  createReviewDimension: (data: import('../types').ReviewDimensionConfigCreate) => api.post<import('../types').ReviewDimensionConfig>('/configs/review-dimensions', data),
  updateReviewDimension: (reviewType: string, data: Partial<import('../types').ReviewDimensionConfigCreate>) => api.put<import('../types').ReviewDimensionConfig>(`/configs/review-dimensions/${reviewType}`, data),
  deleteReviewDimension: (reviewType: string) => api.delete(`/configs/review-dimensions/${reviewType}`),
  
  // 提问质量评价标准配置
  listQuestionQuality: () => api.get<import('../types').QuestionQualityConfig[]>('/configs/question-quality'),
  getQuestionQuality: (configId: number) => api.get<import('../types').QuestionQualityConfig>(`/configs/question-quality/${configId}`),
  getActiveQuestionQuality: () => api.get<import('../types').QuestionQualityConfig>('/configs/question-quality/active'),
  createQuestionQuality: (data: import('../types').QuestionQualityConfigCreate) => api.post<import('../types').QuestionQualityConfig>('/configs/question-quality', data),
  updateQuestionQuality: (configId: number, data: Partial<import('../types').QuestionQualityConfigCreate>) => api.put<import('../types').QuestionQualityConfig>(`/configs/question-quality/${configId}`, data),
  deleteQuestionQuality: (configId: number) => api.delete(`/configs/question-quality/${configId}`),
  activateQuestionQuality: (configId: number) => api.post<{ message: string }>(`/configs/question-quality/${configId}/activate`),
  
  // API配置检查
  check: () => api.get<{ configured: boolean }>('/config/check'),
  setApiKey: (data: { api_key: string; api_base: string; model: string }) =>
    api.post<{ success: boolean; message: string }>('/config/set-api-key/', data),
};

// 产品评审API
export const productReviewApi = {
  list: () => api.get<import('../types').ProductReview[]>('/product-reviews/'),
  get: (id: number) => api.get<import('../types').ProductReview>(`/product-reviews/${id}`),
  create: (data: import('../types').ProductReviewCreate) => api.post<import('../types').ProductReview>('/product-reviews/', data),
  update: (id: number, data: Partial<import('../types').ProductReviewCreate>) => api.put<import('../types').ProductReview>(`/product-reviews/${id}`, data),
  delete: (id: number) => api.delete(`/product-reviews/${id}`),
  updateStatus: (id: number, status: string) => api.patch(`/product-reviews/${id}/status`, null, { params: { status } }),
  
  // 文档
  uploadDocument: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<import('../types').ProductDocument>(`/product-reviews/${id}/upload-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
  getDocument: (id: number) => api.get<import('../types').ProductDocument>(`/product-reviews/${id}/document`),
  deleteDocument: (id: number) => api.delete(`/product-reviews/${id}/document`),
  
  // AI提问
  generateAIQuestions: (id: number) => api.post<{ message: string; questions: string[] }>(`/product-reviews/${id}/ai-questions/generate`),
  getAIQuestions: (id: number) => api.get<import('../types').ProductAIQuestion[]>(`/product-reviews/${id}/ai-questions`),
  answerAIQuestion: (questionId: number, answer: string) => api.post(`/product-reviews/ai-questions/${questionId}/answer`, null, { params: { answer } }),
  
  // 人类提问
  createHumanQuestion: (id: number, judgeId: number, question: string) => 
    api.post<import('../types').ProductHumanQuestion>(`/product-reviews/${id}/human-questions`, { judge_id: judgeId, question }),
  getHumanQuestions: (id: number) => api.get<import('../types').ProductHumanQuestion[]>(`/product-reviews/${id}/human-questions`),
  
  // AI评价
  generateAIRating: (id: number) => api.post<{ message: string; rating: import('../types').ProductAIRating }>(`/product-reviews/${id}/ai-rating`),
  getAIRating: (id: number) => api.get<import('../types').ProductAIRating>(`/product-reviews/${id}/ai-rating`),
};

export default api;