import { useEffect, useState } from 'react';
import { configApi } from '../lib/api';
import type { ReviewDimensionConfig, QuestionQualityConfig, DimensionItem, GradeLevel } from '../types';
import { Settings, Plus, Trash2, Edit2, Check } from 'lucide-react';

export default function Configs() {
  const [reviewDimensions, setReviewDimensions] = useState<ReviewDimensionConfig[]>([]);
  const [questionQuality, setQuestionQuality] = useState<QuestionQualityConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'review' | 'product' | 'quality'>('review');
  
  // 编辑状态
  const [editingReview, setEditingReview] = useState<ReviewDimensionConfig | null>(null);
  const [editingQuality, setEditingQuality] = useState<QuestionQualityConfig | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reviewRes, qualityRes] = await Promise.all([
        configApi.listReviewDimensions(),
        configApi.listQuestionQuality(),
      ]);
      setReviewDimensions(reviewRes.data);
      setQuestionQuality(qualityRes.data);
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setLoading(false);
    }
  };

  // 分离立项评审和产品评审的配置
  const projectReviewDimensions = reviewDimensions.filter(c => c.review_type !== 'product_review');
  const productReviewDimensions = reviewDimensions.filter(c => c.review_type === 'product_review');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Settings className="h-6 w-6 mr-2" />
          评审配置管理
        </h1>
      </div>

      {/* Tab切换 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('review')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'review'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            立项评审维度
          </button>
          <button
            onClick={() => setActiveTab('product')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'product'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            产品评审维度
          </button>
          <button
            onClick={() => setActiveTab('quality')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'quality'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            提问质量评价标准
          </button>
        </nav>
      </div>

      {/* 立项评审维度配置 */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          {projectReviewDimensions.map((config) => (
            <ReviewDimensionCard
              key={config.id}
              config={config}
              editing={editingReview?.id === config.id}
              onEdit={() => setEditingReview(config)}
              onCancel={() => setEditingReview(null)}
              onSave={async (updated) => {
                try {
                  await configApi.updateReviewDimension(config.review_type, updated);
                  setEditingReview(null);
                  loadData();
                } catch (error) {
                  console.error('Failed to update:', error);
                  alert('更新失败');
                }
              }}
            />
          ))}
        </div>
      )}

      {/* 产品评审维度配置 */}
      {activeTab === 'product' && (
        <div className="space-y-4">
          {productReviewDimensions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500 mb-4">暂无产品评审维度配置</p>
              <button
                onClick={async () => {
                  try {
                    const defaultConfig = {
                      review_type: 'product_review',
                      name: '产品评审评价维度',
                      description: 'AI 产品评估的标准评价维度',
                      dimensions: [
                        { name: '市场前景', weight: 25, description: '评估产品的市场潜力、目标用户规模、市场增长空间等' },
                        { name: '技术创新', weight: 25, description: '评估产品的技术先进性、创新点、技术壁垒等' },
                        { name: '商业价值', weight: 25, description: '评估产品的商业模式、盈利能力、成本效益等' },
                        { name: '实施可行性', weight: 25, description: '评估产品的实施难度、资源需求、风险可控性等' }
                      ],
                      prompt_template: '请基于以下评价维度对产品进行评估：\n{dimensions}\n\n请针对每个维度给出详细的评价意见和评分建议。'
                    };
                    await configApi.createReviewDimension(defaultConfig);
                    loadData();
                  } catch (error) {
                    console.error('Failed to create default config:', error);
                    alert('创建默认配置失败');
                  }
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                创建默认配置
              </button>
            </div>
          ) : (
            productReviewDimensions.map((config) => (
              <ReviewDimensionCard
                key={config.id}
                config={config}
                editing={editingReview?.id === config.id}
                onEdit={() => setEditingReview(config)}
                onCancel={() => setEditingReview(null)}
                onSave={async (updated) => {
                  try {
                    await configApi.updateReviewDimension(config.review_type, updated);
                    setEditingReview(null);
                    loadData();
                  } catch (error) {
                    console.error('Failed to update:', error);
                    alert('更新失败');
                  }
                }}
              />
            ))
          )}
        </div>
      )}

      {/* 提问质量评价标准配置 */}
      {activeTab === 'quality' && (
        <div className="space-y-4">
          {questionQuality.map((config) => (
            <QuestionQualityCard
              key={config.id}
              config={config}
              editing={editingQuality?.id === config.id}
              onEdit={() => setEditingQuality(config)}
              onCancel={() => setEditingQuality(null)}
              onSave={async (updated) => {
                try {
                  await configApi.updateQuestionQuality(config.id, updated);
                  setEditingQuality(null);
                  loadData();
                } catch (error) {
                  console.error('Failed to update:', error);
                  alert('更新失败');
                }
              }}
              onActivate={async () => {
                try {
                  await configApi.activateQuestionQuality(config.id);
                  loadData();
                } catch (error) {
                  console.error('Failed to activate:', error);
                  alert('启用失败');
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 评审维度配置卡片
function ReviewDimensionCard({
  config,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  config: ReviewDimensionConfig;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: Partial<ReviewDimensionConfig>) => void;
}) {
  const [name, setName] = useState(config.name);
  const [description, setDescription] = useState(config.description || '');
  const [dimensions, setDimensions] = useState<DimensionItem[]>(config.dimensions);
  const [promptTemplate, setPromptTemplate] = useState(config.prompt_template || '');

  const handleAddDimension = () => {
    setDimensions([...dimensions, { name: '', weight: 0, description: '' }]);
  };

  const handleRemoveDimension = (index: number) => {
    setDimensions(dimensions.filter((_, i) => i !== index));
  };

  const handleDimensionChange = (index: number, field: keyof DimensionItem, value: string | number) => {
    const updated = [...dimensions];
    updated[index] = { ...updated[index], [field]: value };
    setDimensions(updated);
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      dimensions,
      prompt_template: promptTemplate,
    });
  };

  if (!editing) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{config.description}</p>
          </div>
          <div className="flex space-x-2">
            <button onClick={onEdit} className="text-gray-400 hover:text-primary-600">
              <Edit2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {config.dimensions.map((dim, index) => (
            <div key={index} className="flex items-start p-3 bg-gray-50 rounded">
              <span className="text-sm font-medium text-primary-600 w-24">{dim.weight}%</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{dim.name}</div>
                <div className="text-sm text-gray-600 mt-1">{dim.description}</div>
              </div>
            </div>
          ))}
        </div>

        {config.prompt_template && (
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <div className="text-xs font-medium text-blue-700 mb-1">Prompt模板</div>
            <div className="text-sm text-gray-700">{config.prompt_template}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-primary-500">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">配置名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">评价维度</label>
            <button
              onClick={handleAddDimension}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" /> 添加维度
            </button>
          </div>

          <div className="space-y-3">
            {dimensions.map((dim, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="维度名称"
                    value={dim.name}
                    onChange={(e) => handleDimensionChange(index, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="权重%"
                    value={dim.weight}
                    onChange={(e) => handleDimensionChange(index, 'weight', parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => handleRemoveDimension(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <textarea
                  placeholder="维度描述"
                  value={dim.description}
                  onChange={(e) => handleDimensionChange(index, 'description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prompt模板</label>
          <textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            placeholder="使用 {dimensions} 作为维度占位符"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
          >
            <Check className="h-4 w-4 mr-1" /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}

// 提问质量评价标准配置卡片
function QuestionQualityCard({
  config,
  editing,
  onEdit,
  onCancel,
  onSave,
  onActivate,
}: {
  config: QuestionQualityConfig;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: Partial<QuestionQualityConfig>) => void;
  onActivate: () => void;
}) {
  const [name, setName] = useState(config.name);
  const [description, setDescription] = useState(config.description || '');
  const [dimensions, setDimensions] = useState<DimensionItem[]>(config.dimensions);
  const [gradeLevels] = useState<GradeLevel[]>(config.grade_levels || []);

  const handleAddDimension = () => {
    setDimensions([...dimensions, { name: '', weight: 0, description: '' }]);
  };

  const handleRemoveDimension = (index: number) => {
    setDimensions(dimensions.filter((_, i) => i !== index));
  };

  const handleDimensionChange = (index: number, field: keyof DimensionItem, value: string | number) => {
    const updated = [...dimensions];
    updated[index] = { ...updated[index], [field]: value };
    setDimensions(updated);
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      dimensions,
      grade_levels: gradeLevels,
    });
  };

  if (!editing) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
            {config.is_active === 1 && (
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">当前启用</span>
            )}
          </div>
          <div className="flex space-x-2">
            {config.is_active !== 1 && (
              <button
                onClick={onActivate}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                启用
              </button>
            )}
            <button onClick={onEdit} className="text-gray-400 hover:text-primary-600">
              <Edit2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">{config.description}</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">评价维度</h4>
            <div className="space-y-2">
              {config.dimensions.map((dim, index) => (
                <div key={index} className="flex items-start p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-primary-600 w-12">{dim.weight}%</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{dim.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{dim.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {config.grade_levels && config.grade_levels.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">评分等级</h4>
              <div className="space-y-2">
                {config.grade_levels.map((level, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{level.level}</span>
                      <span className="text-xs text-gray-500 ml-2">{level.range}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{level.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-primary-500">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">配置名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">评价维度</label>
            <button
              onClick={handleAddDimension}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" /> 添加维度
            </button>
          </div>

          <div className="space-y-3">
            {dimensions.map((dim, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="维度名称"
                    value={dim.name}
                    onChange={(e) => handleDimensionChange(index, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="权重%"
                    value={dim.weight}
                    onChange={(e) => handleDimensionChange(index, 'weight', parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => handleRemoveDimension(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <textarea
                  placeholder="维度描述"
                  value={dim.description}
                  onChange={(e) => handleDimensionChange(index, 'description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
          >
            <Check className="h-4 w-4 mr-1" /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}