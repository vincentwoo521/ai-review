import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectApi, reviewApi, judgeApi } from '../lib/api';
import type { Project, Review, Judge } from '../types';
import { Plus, ArrowLeft, FileText, Users } from 'lucide-react';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newReview, setNewReview] = useState({ review_type: 'project_initiation', judge_ids: [] as number[] });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      const [projectRes, reviewsRes, judgesRes] = await Promise.all([
        projectApi.get(Number(id)),
        reviewApi.list(Number(id)),
        judgeApi.list(),
      ]);
      setProject(projectRes.data);
      setReviews(reviewsRes.data);
      setJudges(judgesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReview = async () => {
    if (!newReview.review_type || newReview.judge_ids.length === 0) return;

    try {
      const response = await reviewApi.create({
        project_id: Number(id),
        review_type: newReview.review_type,
        judge_ids: newReview.judge_ids,
      });
      setReviews([...reviews, response.data]);
      setShowCreateModal(false);
      setNewReview({ review_type: 'project_initiation', judge_ids: [] });
    } catch (error) {
      console.error('Failed to create review:', error);
      alert('创建失败，请重试');
    }
  };

  const getStatusBadge = (status: Review['status']) => {
    const badges = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
    };
    const labels = {
      pending: '待开始',
      in_progress: '进行中',
      completed: '已完成',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">项目不存在</p>
        <Link to="/projects" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          返回项目列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div>
        <Link
          to="/projects"
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          返回项目列表
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{project.description}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            新建评审
          </button>
        </div>
      </div>

      {/* 评审列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">评审列表</h3>
        </div>
        {reviews.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">暂无评审</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-primary-600 hover:text-primary-700"
            >
              创建第一个评审
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {reviews.map((review) => (
              <Link
                key={review.id}
                to={`/reviews/${review.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-base font-medium text-gray-900">
                        {review.review_type === 'project_initiation' ? '立项评审' :
                         review.review_type === 'commercialization' ? '商业化评审' : '评审'}
                      </h4>
                      {getStatusBadge(review.status)}
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      {review.judges && review.judges.length > 0 && (
                        <span className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {review.judges.map(j => j.name).join('、')}
                        </span>
                      )}
                      <span>
                        创建于 {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 创建评审对话框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">新建评审</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    评审类型
                  </label>
                  <select
                    value={newReview.review_type}
                    onChange={(e) => setNewReview({ ...newReview, review_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="project_initiation">立项评审</option>
                    <option value="commercialization">商业化评审</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    选择评委（可多选）
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                    {judges.map((judge) => (
                      <label key={judge.id} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={newReview.judge_ids.includes(judge.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewReview({ ...newReview, judge_ids: [...newReview.judge_ids, judge.id] });
                            } else {
                              setNewReview({ ...newReview, judge_ids: newReview.judge_ids.filter(id => id !== judge.id) });
                            }
                          }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {judge.name} {judge.organization && `- ${judge.organization}`}
                        </span>
                      </label>
                    ))}
                  </div>
                  {judges.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      暂无评委，请先
                      <Link to="/judges" className="text-primary-600 hover:text-primary-700 ml-1">
                        添加评委
                      </Link>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewReview({ review_type: 'project_initiation', judge_ids: [] });
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateReview}
                  disabled={newReview.judge_ids.length === 0}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}