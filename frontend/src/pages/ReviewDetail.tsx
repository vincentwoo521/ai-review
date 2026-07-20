import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reviewApi, documentApi, aiQuestionApi, humanQuestionApi, aiRatingApi, judgeApi } from '../lib/api';
import type { Review, Document, AIQuestion, HumanQuestion, AIRating, Judge } from '../types';
import { ArrowLeft, Upload, Send, Bot, User, CheckCircle, FileText } from 'lucide-react';

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);
  const [humanQuestions, setHumanQuestions] = useState<HumanQuestion[]>([]);
  const [aiRating, setAiRating] = useState<AIRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingRating, setGeneratingRating] = useState(false);
  const [answerInputs, setAnswerInputs] = useState<{[key: number]: string}>({});
  const [answeringQuestion, setAnsweringQuestion] = useState<number | null>(null);
  const [selectedJudgeId, setSelectedJudgeId] = useState<number | null>(null);
  const [allJudges, setAllJudges] = useState<Judge[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      const reviewRes = await reviewApi.get(Number(id));
      setReview(reviewRes.data);

      // 加载所有评委列表
      const judgesRes = await judgeApi.list();
      setAllJudges(judgesRes.data);

      // 加载文档
      try {
        const docRes = await documentApi.get(Number(id));
        setDocument(docRes.data);
      } catch (e) {
        // 文档不存在
      }

      // 加载问题
      const [aiQRes, humanQRes] = await Promise.all([
        aiQuestionApi.list(Number(id)),
        humanQuestionApi.list(Number(id)),
      ]);
      setAiQuestions(aiQRes.data);
      setHumanQuestions(humanQRes.data);

      // 加载评分
      try {
        const aiRRes = await aiRatingApi.get(Number(id));
        setAiRating(aiRRes.data);
      } catch (e) {
        // 评分不存在
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
      const response = await documentApi.upload(Number(id), file);
      setDocument(response.data);
      // 更新评审状态为进行中
      await reviewApi.updateStatus(Number(id), 'in_progress');
      const reviewRes = await reviewApi.get(Number(id));
      setReview(reviewRes.data);
      alert('文档上传成功！');
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      const errorMsg = error.response?.data?.detail || '上传失败，请重试';
      alert(errorMsg);
    }
  };

  const handleDeleteDocument = async () => {
    if (!confirm('确定要清空文档吗？这将同时清除所有相关的AI提问和评分记录。')) return;
    
    try {
      await documentApi.delete(Number(id));
      setDocument(null);
      setAiQuestions([]);
      setAiRating(null);
      alert('文档已清空');
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      const errorMsg = error.response?.data?.detail || '清空失败，请重试';
      alert(errorMsg);
    }
  };

  const handleGenerateAIQuestion = async () => {
    if (!document) {
      alert('请先上传文档');
      return;
    }

    setGeneratingAI(true);
    try {
      await aiQuestionApi.generate(Number(id));
      // 重新加载问题列表
      const aiQRes = await aiQuestionApi.list(Number(id));
      setAiQuestions(aiQRes.data);
    } catch (error: any) {
      console.error('Failed to generate AI question:', error);
      if (error.response?.data?.detail?.includes('API Key')) {
        alert('请先配置API Key，前往设置页面查看配置说明');
      } else {
        const errorMsg = error.response?.data?.detail || '生成失败，请重试';
        alert(errorMsg);
      }
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAddHumanQuestion = async () => {
    if (!newQuestion.trim() || !review) return;

    if (!selectedJudgeId) {
      alert('请选择提问的评委');
      return;
    }

    try {
      const response = await humanQuestionApi.create(Number(id), selectedJudgeId, newQuestion);
      const newQuestionData = response.data;
      
      // 自动触发AI评价
      try {
        await humanQuestionApi.evaluate(newQuestionData.id);
        // 重新加载问题列表获取评价结果
        const humanQRes = await humanQuestionApi.list(Number(id));
        setHumanQuestions(humanQRes.data);
      } catch (evalError) {
        console.error('Failed to evaluate question:', evalError);
        // 即使评价失败也添加问题
        setHumanQuestions([...humanQuestions, newQuestionData]);
      }
      
      setNewQuestion('');
    } catch (error) {
      console.error('Failed to add human question:', error);
      alert('添加失败，请重试');
    }
  };

  const handleAddJudge = async (judgeId: number) => {
    if (!review) return;
    
    const currentJudgeIds = review.judges?.map(j => j.id) || [];
    if (currentJudgeIds.includes(judgeId)) {
      alert('该评委已添加');
      return;
    }

    const newJudgeIds = [...currentJudgeIds, judgeId];
    try {
      const response = await reviewApi.updateJudges(Number(id), newJudgeIds);
      setReview(response.data);
    } catch (error) {
      console.error('Failed to add judge:', error);
      alert('添加评委失败，请重试');
    }
  };

  const handleRemoveJudge = async (judgeId: number) => {
    if (!review) return;
    
    const currentJudgeIds = review.judges?.map(j => j.id) || [];
    const newJudgeIds = currentJudgeIds.filter(id => id !== judgeId);
    
    try {
      const response = await reviewApi.updateJudges(Number(id), newJudgeIds);
      setReview(response.data);
    } catch (error) {
      console.error('Failed to remove judge:', error);
      alert('移除评委失败，请重试');
    }
  };

  const handleGenerateAIRating = async () => {
    if (!document) {
      alert('请先上传文档');
      return;
    }

    setGeneratingRating(true);
    try {
      const response = await aiRatingApi.generate(Number(id));
      setAiRating(response.data.rating);
    } catch (error: any) {
      console.error('Failed to generate AI rating:', error);
      if (error.response?.data?.detail?.includes('API Key')) {
        alert('请先配置API Key，前往设置页面查看配置说明');
      } else {
        alert('生成失败，请重试');
      }
    } finally {
      setGeneratingRating(false);
    }
  };

  const handleCompleteReview = async () => {
    if (!confirm('确定要完成本次评审吗？')) return;

    try {
      await reviewApi.updateStatus(Number(id), 'completed');
      const reviewRes = await reviewApi.get(Number(id));
      setReview(reviewRes.data);
    } catch (error) {
      console.error('Failed to complete review:', error);
      alert('操作失败，请重试');
    }
  };

  const handleAnswerQuestion = async (questionId: number) => {
    const answer = answerInputs[questionId];
    if (!answer?.trim()) return;

    setAnsweringQuestion(questionId);
    try {
      await aiQuestionApi.answer(questionId, answer);
      // 重新加载问题列表
      const aiQRes = await aiQuestionApi.list(Number(id));
      setAiQuestions(aiQRes.data);
      setAnswerInputs({ ...answerInputs, [questionId]: '' });
      alert('回答已保存，追问已生成！');
    } catch (error) {
      console.error('Failed to answer question:', error);
      alert('回答失败，请重试');
    } finally {
      setAnsweringQuestion(null);
    }
  };

  const handleEvaluateQuestion = async (questionId: number) => {
    try {
      await humanQuestionApi.evaluate(questionId);
      // 重新加载问题列表
      const humanQRes = await humanQuestionApi.list(Number(id));
      setHumanQuestions(humanQRes.data);
      alert('评价完成！');
    } catch (error: any) {
      console.error('Failed to evaluate question:', error);
      const errorMsg = error.response?.data?.detail || '评价失败，请重试';
      alert(errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">评审不存在</p>
        <Link to="/projects" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          返回项目列表
        </Link>
      </div>
    );
  }

  const reviewTypeLabel = review.review_type === 'project_initiation' ? '立项评审' :
                         review.review_type === 'commercialization' ? '商业化评审' : '评审';

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div>
        <Link
          to={`/projects/${review.project_id}`}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          返回项目详情
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{reviewTypeLabel}</h2>
            <p className="text-sm text-gray-500 mt-1">
              评委: {review.judges?.map(j => j.name).join('、') || '未指定'} | 
              创建于 {new Date(review.created_at).toLocaleDateString()}
            </p>
          </div>
          {review.status !== 'completed' && (
            <button
              onClick={handleCompleteReview}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              完成评审
            </button>
          )}
        </div>
      </div>

      {/* 评委管理区域 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">评委管理</h3>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {review.judges?.map((judge) => (
              <div key={judge.id} className="flex items-center space-x-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-full">
                <span className="text-sm font-medium text-primary-700">{judge.name}</span>
                {judge.organization && (
                  <span className="text-xs text-primary-600">({judge.organization})</span>
                )}
                {review.status !== 'completed' && (
                  <button
                    onClick={() => handleRemoveJudge(judge.id)}
                    className="text-primary-600 hover:text-primary-800 text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {(!review.judges || review.judges.length === 0) && (
              <span className="text-sm text-gray-500">暂无评委</span>
            )}
          </div>
          {review.status !== 'completed' && (
            <div className="flex items-center space-x-2">
              <select
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                value=""
                onChange={(e) => {
                  const judgeId = Number(e.target.value);
                  if (judgeId) handleAddJudge(judgeId);
                }}
              >
                <option value="">添加评委...</option>
                {allJudges
                  .filter(j => !review.judges?.some(rj => rj.id === j.id))
                  .map((judge) => (
                    <option key={judge.id} value={judge.id}>
                      {judge.name} {judge.organization && `(${judge.organization})`}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧: 文档内容 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">评审文档</h3>
            {document && (
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  重新上传
                </button>
                <button
                  onClick={handleDeleteDocument}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  清空文档
                </button>
              </div>
            )}
          </div>
          <div className="p-4">
            {!document ? (
              <div className="text-center py-12">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 transition-colors"
                >
                  <Upload className="h-12 w-12 text-gray-400 mb-3" />
                  <span className="text-gray-600">点击上传PDF文档</span>
                  <span className="text-sm text-gray-400 mt-1">支持PDF格式</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-600">
                  <FileText className="h-5 w-5 mr-2 text-primary-600" />
                  <span className="font-medium">{document.file_name}</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg max-h-[500px] overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{document.content}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧: 对话和评分 */}
        <div className="space-y-6">
          {/* AI提问区域 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">AI评审助手</h3>
              {document && (
                <button
                  onClick={handleGenerateAIQuestion}
                  disabled={generatingAI}
                  className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingAI ? '生成中...' : '生成提问'}
                </button>
              )}
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {aiQuestions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  上传文档后，AI将基于{reviewTypeLabel}思考维度生成评审问题
                </p>
              ) : (
                <div className="space-y-4">
                  {aiQuestions.map((q, idx) => (
                    <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                      {/* 问题内容 */}
                      <div className="flex items-start space-x-3 mb-3">
                        <Bot className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                              问题 {idx + 1}
                            </span>
                            {q.question_type === 'followup' && (
                              <span className="ml-2 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                追问
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{q.question_content}</p>
                          
                          {/* 回答内容 */}
                          {q.answer_content && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                              <span className="text-gray-500">回答：</span>
                              <span className="text-gray-700">{q.answer_content}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 回答输入框 */}
                      {!q.answer_content && review?.status !== 'completed' && (
                        <div className="ml-8 flex space-x-2">
                          <input
                            type="text"
                            value={answerInputs[q.id] || ''}
                            onChange={(e) => setAnswerInputs({ ...answerInputs, [q.id]: e.target.value })}
                            placeholder="输入回答..."
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => handleAnswerQuestion(q.id)}
                            disabled={!answerInputs[q.id]?.trim() || answeringQuestion === q.id}
                            className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                          >
                            {answeringQuestion === q.id ? '提交中...' : '提交回答'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 评委提问输入 */}
            <div className="p-4 border-t border-gray-200">
              <div className="space-y-2">
                {/* 评委选择器 */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">提问评委:</label>
                  <select
                    value={selectedJudgeId || ''}
                    onChange={(e) => setSelectedJudgeId(Number(e.target.value) || null)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  >
                    <option value="">请选择评委</option>
                    {review?.judges?.map((judge) => (
                      <option key={judge.id} value={judge.id}>
                        {judge.name} {judge.organization ? `(${judge.organization})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 问题输入 */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddHumanQuestion()}
                    placeholder="输入评委提问..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddHumanQuestion}
                    disabled={!newQuestion.trim() || !selectedJudgeId}
                    className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 人类评委问题展示区域 */}
          {humanQuestions.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">人类评委提问</h3>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
                <div className="space-y-3">
                  {humanQuestions.map((q, idx) => {
                    const judge = review?.judges?.find(j => j.id === q.judge_id);
                    return (
                      <div key={q.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start space-x-3">
                          <User className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                  问题 {idx + 1}
                                </span>
                                {judge && (
                                  <span className="text-xs text-gray-500">
                                    {judge.name} {judge.organization && `(${judge.organization})`}
                                  </span>
                                )}
                              </div>
                              {q.quality_score !== undefined && q.quality_score !== null && (
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                  质量: {(q.quality_score as number).toFixed(1)} 分
                                </span>
                              )}
                            </div>
                            {review?.status !== 'completed' && !q.quality_score && (
                              <button
                                onClick={() => handleEvaluateQuestion(q.id)}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-primary-700 border border-gray-300 rounded hover:bg-primary-50"
                                title="重新评价"
                              >
                                重新评价
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{q.question_content}</p>
                          
                          {/* 质量评分明细 */}
                          {q.quality_dimensions && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                {q.quality_dimensions.relevance != null && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">相关性:</span>
                                    <span className="font-medium">{(q.quality_dimensions.relevance as number).toFixed(1)}</span>
                                  </div>
                                )}
                                {q.quality_dimensions.depth != null && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">深度:</span>
                                    <span className="font-medium">{(q.quality_dimensions.depth as number).toFixed(1)}</span>
                                  </div>
                                )}
                                {q.quality_dimensions.inspiration != null && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">启发性:</span>
                                    <span className="font-medium">{(q.quality_dimensions.inspiration as number).toFixed(1)}</span>
                                  </div>
                                )}
                                {q.quality_dimensions.clarity != null && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">清晰度:</span>
                                    <span className="font-medium">{(q.quality_dimensions.clarity as number).toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                              {q.quality_dimensions.feedback && (
                                <div className="mt-1 pt-1 border-t border-gray-200">
                                  <span className="text-gray-500">反馈: </span>
                                  <span className="text-gray-700">{q.quality_dimensions.feedback}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 评分区域 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">AI评分</h3>
              {document && !aiRating && (
                <button
                  onClick={handleGenerateAIRating}
                  disabled={generatingRating}
                  className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingRating ? '生成中...' : '生成评分'}
                </button>
              )}
            </div>
            <div className="p-4">
              {!aiRating ? (
                <p className="text-center text-gray-500 py-8">
                  上传文档后可生成AI评分
                </p>
              ) : (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center mb-3">
                    <Bot className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="font-medium text-blue-900">大模型评估结果</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <RatingItem label="总体评分" value={aiRating.overall_score} />
                    {/* 优先使用配置的动态维度 */}
                    {aiRating.dimensions_meta ? (
                      <>
                        {aiRating.dimensions_meta.map((dim, index) => (
                          <RatingItem 
                            key={index}
                            label={`${dim.name} (${dim.weight}%)`}
                            value={(aiRating as any)[`dimension_${index + 1}_score`]}
                          />
                        ))}
                      </>
                    ) : (
                      <>
                        <RatingItem label="创新性" value={aiRating.innovation_score} />
                        <RatingItem label="可行性" value={aiRating.feasibility_score} />
                        <RatingItem label="影响力" value={aiRating.impact_score} />
                        <RatingItem label="展示" value={aiRating.presentation_score} />
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-gray-700">{aiRating.comments}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RatingItemProps {
  label: string;
  value?: number;
}

function RatingItem({ label, value }: RatingItemProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center">
        <span className="font-medium text-gray-900">{value?.toFixed(1) ?? '-'} 分</span>
      </div>
    </div>
  );
}