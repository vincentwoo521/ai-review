import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { judgeApi } from '../lib/api';
import type { Judge, JudgeSummary, JudgeQuestion } from '../types';
import { ArrowLeft, User, Award, MessageSquare } from 'lucide-react';

export default function JudgeDetail() {
  const { id } = useParams<{ id: string }>();
  const [judge, setJudge] = useState<Judge | null>(null);
  const [summary, setSummary] = useState<JudgeSummary | null>(null);
  const [questions, setQuestions] = useState<JudgeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      const [judgeRes, summaryRes, questionsRes] = await Promise.all([
        judgeApi.get(Number(id)),
        judgeApi.getSummary(Number(id)),
        judgeApi.getQuestions(Number(id)),
      ]);
      setJudge(judgeRes.data);
      setSummary(summaryRes.data);
      setQuestions(questionsRes.data);
    } catch (error) {
      console.error('Failed to load judge data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!judge) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">评委不存在</p>
        <Link to="/judges" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          返回评委列表
        </Link>
      </div>
    );
  }

  const displayedQuestions = showAllQuestions ? questions : questions.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div>
        <Link
          to="/judges"
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          返回评委列表
        </Link>
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{judge.name}</h2>
            {judge.organization && (
              <p className="text-sm text-gray-500">{judge.organization}</p>
            )}
          </div>
        </div>
      </div>

      {/* 综合评分卡片 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Award className="h-5 w-5 mr-2 text-primary-600" />
          提问质量综合评分
        </h3>
        
        {summary && summary.total_questions > 0 ? (
          <div className="space-y-4">
            {/* 总览 */}
            <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">平均质量评分</p>
                <p className="text-3xl font-bold text-primary-600">
                  {summary.avg_score?.toFixed(1) || '-'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">提问总数</p>
                <p className="text-2xl font-semibold text-gray-900">{summary.total_questions}</p>
              </div>
            </div>

            {/* 各维度评分 */}
            {summary.dimension_scores && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">各维度评分</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DimensionCard
                    label="相关性"
                    score={summary.dimension_scores.relevance}
                    color="blue"
                  />
                  <DimensionCard
                    label="深度"
                    score={summary.dimension_scores.depth}
                    color="purple"
                  />
                  <DimensionCard
                    label="启发性"
                    score={summary.dimension_scores.inspiration}
                    color="green"
                  />
                  <DimensionCard
                    label="清晰度"
                    score={summary.dimension_scores.clarity}
                    color="orange"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">暂无评分数据</p>
        )}
      </div>

      {/* 提问记录列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-primary-600" />
            提问记录
          </h3>
          <span className="text-sm text-gray-500">共 {questions.length} 条</span>
        </div>
        
        {questions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {displayedQuestions.map((q) => (
              <div key={q.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      {q.project_name && (
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                          {q.project_name}
                        </span>
                      )}
                      {q.review_type && (
                        <span className="text-xs text-gray-500">
                          {q.review_type === 'project_initiation' ? '立项评审' : 
                           q.review_type === 'commercialization' ? '商业化评审' : '评审'}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(q.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{q.question_content}</p>
                    
                    {/* 质量维度评分 */}
                    {q.quality_dimensions && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {q.quality_dimensions.relevance != null && (
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                            相关性: {q.quality_dimensions.relevance.toFixed(1)}
                          </span>
                        )}
                        {q.quality_dimensions.depth != null && (
                          <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">
                            深度: {q.quality_dimensions.depth.toFixed(1)}
                          </span>
                        )}
                        {q.quality_dimensions.inspiration != null && (
                          <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">
                            启发性: {q.quality_dimensions.inspiration.toFixed(1)}
                          </span>
                        )}
                        {q.quality_dimensions.clarity != null && (
                          <span className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded">
                            清晰度: {q.quality_dimensions.clarity.toFixed(1)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 总分 */}
                  {q.quality_score != null && (
                    <div className="ml-4 flex flex-col items-center">
                      <div className="text-2xl font-bold text-primary-600">
                        {q.quality_score.toFixed(1)}
                      </div>
                      <span className="text-xs text-gray-500">总分</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">暂无提问记录</p>
        )}
        
        {/* 显示更多按钮 */}
        {questions.length > 10 && (
          <div className="p-4 border-t border-gray-200 text-center">
            <button
              onClick={() => setShowAllQuestions(!showAllQuestions)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showAllQuestions ? '收起' : `查看全部 ${questions.length} 条记录`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface DimensionCardProps {
  label: string;
  score?: number;
  color: 'blue' | 'purple' | 'green' | 'orange';
}

function DimensionCard({ label, score, color }: DimensionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-xl font-bold mt-1">
        {score != null ? score.toFixed(1) : '-'}
      </p>
    </div>
  );
}