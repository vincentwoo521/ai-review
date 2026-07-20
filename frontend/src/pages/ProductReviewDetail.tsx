import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, Users, MessageSquare, Loader2,
  CheckCircle, Plus, Sparkles, Radar, Lightbulb
} from 'lucide-react';
import { productReviewApi, judgeApi } from '../lib/api';
import type { ProductReview, ProductAIQuestion, ProductHumanQuestion, ProductAIRating, Judge } from '../types';

export default function ProductReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<ProductReview | null>(null);
  const [document, setDocument] = useState<{ file_name: string } | null>(null);
  const [aiQuestions, setAiQuestions] = useState<ProductAIQuestion[]>([]);
  const [humanQuestions, setHumanQuestions] = useState<ProductHumanQuestion[]>([]);
  const [aiRating, setAiRating] = useState<ProductAIRating | null>(null);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatingRating, setGeneratingRating] = useState(false);
  const [showJudgeModal, setShowJudgeModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [selectedJudgeId, setSelectedJudgeId] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [reviewRes, judgesRes] = await Promise.all([
        productReviewApi.get(Number(id)),
        judgeApi.list(),
      ]);
      setReview(reviewRes.data);
      setJudges(judgesRes.data);

      // 加载文档
      try {
        const docRes = await productReviewApi.getDocument(Number(id));
        setDocument(docRes.data);
      } catch (e) {
        // 文档不存在
      }

      // 加载AI提问
      try {
        const aiQRes = await productReviewApi.getAIQuestions(Number(id));
        setAiQuestions(aiQRes.data);
      } catch (e) {
        // 提问不存在
      }

      // 加载人类提问
      try {
        const hQRes = await productReviewApi.getHumanQuestions(Number(id));
        setHumanQuestions(hQRes.data);
      } catch (e) {
        // 提问不存在
      }

      // 加载AI评价
      try {
        const aiRRes = await productReviewApi.getAIRating(Number(id));
        setAiRating(aiRRes.data);
      } catch (e) {
        // 评价不存在
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    try {
      await productReviewApi.uploadDocument(Number(id), file);
      const docRes = await productReviewApi.getDocument(Number(id));
      setDocument(docRes.data);
      await productReviewApi.updateStatus(Number(id), 'in_progress');
      const reviewRes = await productReviewApi.get(Number(id));
      setReview(reviewRes.data);
      alert('文档上传成功！');
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      alert(error.response?.data?.detail || '上传失败');
    }
  };

  const handleGenerateQuestions = async () => {
    if (!id) return;
    setGeneratingQuestions(true);
    try {
      await productReviewApi.generateAIQuestions(Number(id));
      const aiQRes = await productReviewApi.getAIQuestions(Number(id));
      setAiQuestions(aiQRes.data);
    } catch (error: any) {
      console.error('Failed to generate questions:', error);
      if (error.response?.data?.detail?.includes('API Key')) {
        alert('请先配置API Key');
      } else {
        alert('生成失败，请重试');
      }
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleAnswerQuestion = async (questionId: number, answer: string) => {
    try {
      await productReviewApi.answerAIQuestion(questionId, answer);
      const aiQRes = await productReviewApi.getAIQuestions(Number(id));
      setAiQuestions(aiQRes.data);
    } catch (error) {
      console.error('Failed to answer question:', error);
      alert('保存失败');
    }
  };

  const handleAddJudge = async () => {
    if (!selectedJudgeId || !id) return;
    try {
      const currentJudgeIds = review?.judges?.map(j => j.id) || [];
      await productReviewApi.update(Number(id), {
        judge_ids: [...currentJudgeIds, selectedJudgeId]
      });
      setShowJudgeModal(false);
      setSelectedJudgeId(null);
      loadData();
    } catch (error) {
      console.error('Failed to add judge:', error);
      alert('添加失败');
    }
  };

  const handleAddHumanQuestion = async () => {
    if (!selectedJudgeId || !newQuestion.trim() || !id) return;
    try {
      await productReviewApi.createHumanQuestion(Number(id), selectedJudgeId, newQuestion);
      setShowQuestionModal(false);
      setSelectedJudgeId(null);
      setNewQuestion('');
      const hQRes = await productReviewApi.getHumanQuestions(Number(id));
      setHumanQuestions(hQRes.data);
    } catch (error) {
      console.error('Failed to add question:', error);
      alert('添加失败');
    }
  };

  const handleGenerateRating = async () => {
    if (!id) return;
    setGeneratingRating(true);
    try {
      const response = await productReviewApi.generateAIRating(Number(id));
      setAiRating(response.data.rating);
    } catch (error: any) {
      console.error('Failed to generate rating:', error);
      if (error.response?.data?.detail?.includes('API Key')) {
        alert('请先配置API Key');
      } else {
        alert('生成失败，请重试');
      }
    } finally {
      setGeneratingRating(false);
    }
  };

  const handleCompleteReview = async () => {
    if (!confirm('确定要完成本次评审吗？')) return;
    if (!id) return;
    try {
      await productReviewApi.updateStatus(Number(id), 'completed');
      const reviewRes = await productReviewApi.get(Number(id));
      setReview(reviewRes.data);
    } catch (error) {
      console.error('Failed to complete review:', error);
      alert('操作失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };
    const labels: Record<string, string> = {
      pending: '待处理',
      in_progress: '进行中',
      completed: '已完成',
    };
    return (
      <span className={`px-3 py-1 text-sm rounded-full ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!review) {
    return <div className="text-center py-12">产品评审不存在</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* 头部信息 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{review.product_name}</h1>
            {review.description && (
              <p className="text-gray-600 mt-2">{review.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(review.status)}
            {review.status !== 'completed' && (
              <button
                onClick={handleCompleteReview}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                完成评审
              </button>
            )}
          </div>
        </div>

        {/* 评委 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">评委：</span>
              {review.judges && review.judges.length > 0 ? (
                <div className="flex flex-wrap gap-2 ml-2">
                  {review.judges.map(judge => (
                    <span key={judge.id} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {judge.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-500 ml-2">暂无评委</span>
              )}
            </div>
            {review.status !== 'completed' && (
              <button
                onClick={() => setShowJudgeModal(true)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                添加评委
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：文档和提问 */}
        <div className="space-y-6">
          {/* 文档上传 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              产品文档
            </h2>
            {!document ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500"
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">点击上传产品文档</p>
                <p className="text-sm text-gray-400 mt-2">支持 PDF 和图片格式（JPG、PNG 等）</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">{document.file_name}</p>
                    <p className="text-sm text-gray-500">
                      上传于 {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {review.status !== 'completed' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    更换文档
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* AI提问 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Sparkles className="h-5 w-5 mr-2" />
                AI 战略提问
              </h2>
              {document && review.status !== 'completed' && (
                <button
                  onClick={handleGenerateQuestions}
                  disabled={generatingQuestions}
                  className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                  {generatingQuestions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      生成提问
                    </>
                  )}
                </button>
              )}
            </div>

            {aiQuestions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {document ? '点击"生成提问"按钮生成战略问题' : '请先上传产品文档'}
              </div>
            ) : (
              <div className="space-y-4">
                {aiQuestions.map((q, index) => (
                  <QuestionItem
                    key={q.id}
                    question={q}
                    index={index + 1}
                    onAnswer={(answer) => handleAnswerQuestion(q.id, answer)}
                    readonly={review.status === 'completed'}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 人类提问 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                评委提问
              </h2>
              {document && review.status !== 'completed' && review.judges && review.judges.length > 0 && (
                <button
                  onClick={() => setShowQuestionModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加提问
                </button>
              )}
            </div>

            {humanQuestions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无评委提问
              </div>
            ) : (
              <div className="space-y-3">
                {humanQuestions.map((q, index) => (
                  <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <p className="text-gray-900">{index + 1}. {q.question_content}</p>
                    </div>
                    {q.answer_content && (
                      <p className="mt-2 text-sm text-gray-600 pl-4 border-l-2 border-primary-300">
                        回答：{q.answer_content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：AI评价 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Radar className="h-5 w-5 mr-2" />
                AI 战略评价
              </h2>
              {document && review.status !== 'completed' && (
                <button
                  onClick={handleGenerateRating}
                  disabled={generatingRating}
                  className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                  {generatingRating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Radar className="h-4 w-4 mr-1" />
                      生成评价
                    </>
                  )}
                </button>
              )}
            </div>

            {!aiRating ? (
              <div className="text-center py-12 text-gray-500">
                {document ? '点击"生成评价"按钮获取战略评价' : '请先上传产品文档'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* 雷达图数据展示 */}
                <div className="grid grid-cols-2 gap-4">
                  <ScoreCard
                    label="市场空间与发展前景"
                    score={aiRating.radar_data.market_potential}
                  />
                  <ScoreCard
                    label="未来迭代方向规划"
                    score={aiRating.radar_data.future_roadmap}
                  />
                  <ScoreCard
                    label="核心功能拓展建议"
                    score={aiRating.radar_data.feature_expansion}
                  />
                  <ScoreCard
                    label="竞争壁垒与差异化"
                    score={aiRating.radar_data.competitive_moat}
                  />
                </div>

                {/* 维度解析 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">维度深度解析</h3>
                  {aiRating.analysis.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{item.dimension}</h4>
                        <span className={`text-lg font-bold ${
                          item.score >= 90 ? 'text-green-600' :
                          item.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {item.score}分
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-green-700">核心亮点：</span>
                          <span className="text-gray-600">{item.highlights}</span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700">潜在风险：</span>
                          <span className="text-gray-600">{item.risks}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">打分依据：</span>
                          <span className="text-gray-600">{item.reasoning}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 战略建议 */}
                <div className="bg-primary-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Lightbulb className="h-5 w-5 mr-2 text-primary-600" />
                    战略级优化建议
                  </h3>
                  <ul className="space-y-2">
                    {aiRating.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-700">
                        <span className="text-primary-600 mr-2">{index + 1}.</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 添加评委弹窗 */}
      {showJudgeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加评委</h3>
            <select
              value={selectedJudgeId || ''}
              onChange={(e) => setSelectedJudgeId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">请选择评委</option>
              {judges
                .filter(j => !review.judges?.some(rj => rj.id === j.id))
                .map(judge => (
                  <option key={judge.id} value={judge.id}>
                    {judge.name} {judge.organization ? `(${judge.organization})` : ''}
                  </option>
                ))}
            </select>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowJudgeModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddJudge}
                disabled={!selectedJudgeId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加提问弹窗 */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加评委提问</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择评委</label>
                <select
                  value={selectedJudgeId || ''}
                  onChange={(e) => setSelectedJudgeId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">请选择评委</option>
                  {review.judges?.map(judge => (
                    <option key={judge.id} value={judge.id}>{judge.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">提问内容</label>
                <textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="请输入提问内容"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setShowQuestionModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddHumanQuestion}
                disabled={!selectedJudgeId || !newQuestion.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 提问组件
function QuestionItem({ 
  question, 
  index, 
  onAnswer, 
  readonly 
}: { 
  question: ProductAIQuestion; 
  index: number; 
  onAnswer: (answer: string) => void;
  readonly: boolean;
}) {
  const [answer, setAnswer] = useState(question.answer_content || '');
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onAnswer(answer);
    setEditing(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="text-gray-900 font-medium">{index}. {question.question_content}</p>
      {editing ? (
        <div className="mt-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            placeholder="请输入回答"
          />
          <div className="flex justify-end mt-2 space-x-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
            >
              保存
            </button>
          </div>
        </div>
      ) : question.answer_content ? (
        <div className="mt-3 pl-4 border-l-2 border-primary-300">
          <p className="text-gray-600">{question.answer_content}</p>
          {!readonly && (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700"
            >
              编辑回答
            </button>
          )}
        </div>
      ) : !readonly ? (
        <button
          onClick={() => setEditing(true)}
          className="mt-3 text-sm text-primary-600 hover:text-primary-700"
        >
          添加回答
        </button>
      ) : null}
    </div>
  );
}

// 评分卡片
function ScoreCard({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return 'text-green-600 bg-green-50';
    if (s >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className={`p-4 rounded-lg ${getColor(score)}`}>
      <div className="text-2xl font-bold">{score}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}