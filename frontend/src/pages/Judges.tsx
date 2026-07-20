import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { judgeApi } from '../lib/api';
import type { Judge } from '../types';
import { Plus, Users, Trash2, Edit2, Eye } from 'lucide-react';

export default function Judges() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    expertise: '',
  });

  useEffect(() => {
    loadJudges();
  }, []);

  const loadJudges = async () => {
    try {
      const response = await judgeApi.list();
      setJudges(response.data);
    } catch (error) {
      console.error('Failed to load judges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    const data = {
      name: formData.name,
      organization: formData.organization,
      expertise: formData.expertise.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      if (editingJudge) {
        await judgeApi.update(editingJudge.id, data);
        // 重新加载列表确保数据一致
        await loadJudges();
      } else {
        const response = await judgeApi.create(data);
        setJudges([...judges, response.data]);
      }
      closeModal();
    } catch (error) {
      console.error('Failed to save judge:', error);
      alert('保存失败，请重试');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该评委吗？')) return;

    try {
      await judgeApi.delete(id);
      setJudges(judges.filter(j => j.id !== id));
    } catch (error) {
      console.error('Failed to delete judge:', error);
      alert('删除失败，请重试');
    }
  };

  const openCreateModal = () => {
    setEditingJudge(null);
    setFormData({ name: '', organization: '', expertise: '' });
    setShowModal(true);
  };

  const openEditModal = (judge: Judge) => {
    setEditingJudge(judge);
    setFormData({
      name: judge.name,
      organization: judge.organization || '',
      expertise: Array.isArray(judge.expertise) ? judge.expertise.join(', ') : '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingJudge(null);
    setFormData({ name: '', organization: '', expertise: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">评委管理</h2>
          <p className="text-sm text-gray-500 mt-1">管理所有评委信息</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          添加评委
        </button>
      </div>

      {/* 评委列表 */}
      {judges.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">暂无评委</p>
          <button
            onClick={openCreateModal}
            className="text-primary-600 hover:text-primary-700"
          >
            添加第一位评委
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {judges.map((judge) => (
            <div
              key={judge.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-semibold text-lg">
                        {judge.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-gray-900">{judge.name}</h3>
                      <p className="text-sm text-gray-500">{judge.organization}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/judges/${judge.id}`}
                      className="text-gray-400 hover:text-primary-600"
                      title="查看详情"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={() => openEditModal(judge)}
                      className="text-gray-400 hover:text-primary-600"
                      title="编辑"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(judge.id)}
                      className="text-gray-400 hover:text-red-500"
                      title="删除"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {Array.isArray(judge.expertise) && judge.expertise.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {judge.expertise.map((exp, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                )}
                {judge.stats && (
                  <div className="pt-4 border-t border-gray-100 text-sm text-gray-500">
                    <div className="flex justify-between">
                      <span>提问数: {judge.stats.total_questions}</span>
                      <span>平均评分: {judge.stats.avg_rating.toFixed(1)}</span>
                    </div>
                    {judge.stats.avg_quality_score !== undefined && judge.stats.avg_quality_score !== null && (
                      <div className="flex justify-between mt-1">
                        <span className="text-blue-600">平均质量评分:</span>
                        <span className="font-medium text-blue-600">{Number(judge.stats.avg_quality_score).toFixed(1)} 分</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑评委对话框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingJudge ? '编辑评委' : '添加评委'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="输入评委姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    所属单位
                  </label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="输入所属单位"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    专业领域
                  </label>
                  <input
                    type="text"
                    value={formData.expertise}
                    onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="多个领域用逗号分隔，如: AI, 区块链, 云计算"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingJudge ? '保存' : '添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}