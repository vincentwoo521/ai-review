import { useState, useEffect } from 'react';
import { configApi } from '../lib/api';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

export default function Settings() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      const response = await configApi.check();
      setHasApiKey(response.data.configured);
    } catch (error) {
      console.error('Failed to check API key:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: '请输入API Key' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await configApi.setApiKey({
        api_key: apiKey,
        api_base: apiBase,
        model: model,
      });
      setHasApiKey(true);
      setApiKey('');
      setMessage({ type: 'success', text: 'API Key保存成功！' });
    } catch (error) {
      console.error('Failed to save API key:', error);
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
        <p className="text-sm text-gray-500 mt-1">配置AI评审系统参数</p>
      </div>

      {/* API Key 状态卡片 */}
      <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${hasApiKey ? 'border-green-500' : 'border-yellow-500'}`}>
        <div className="flex items-start">
          {hasApiKey ? (
            <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
          ) : (
            <AlertCircle className="h-6 w-6 text-yellow-500 mt-0.5" />
          )}
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              大模型API配置
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {hasApiKey 
                ? 'API Key已配置，AI评审功能可正常使用'
                : '请配置大模型API Key以启用AI评审功能'}
            </p>
          </div>
        </div>
      </div>

      {/* API Key 配置表单 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          配置API Key
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="sk-..."
            />
            <p className="mt-1 text-sm text-gray-500">
              您的OpenAI API Key，将安全存储在后端.env文件中
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Base URL
            </label>
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://api.openai.com/v1"
            />
            <p className="mt-1 text-sm text-gray-500">
              默认使用OpenAI官方地址，可替换为兼容的API服务
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模型名称
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="gpt-4"
            />
            <p className="mt-1 text-sm text-gray-500">
              推荐使用gpt-4以获得更好的评审质量
            </p>
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <button
            onClick={handleSaveApiKey}
            disabled={saving || !apiKey.trim()}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3">
          使用说明
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>1. 获取OpenAI API Key: 
            <a 
              href="https://platform.openai.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 text-blue-600 hover:text-blue-700 inline-flex items-center"
            >
              platform.openai.com <ExternalLink className="h-3 w-3 ml-0.5" />
            </a>
          </li>
          <li>2. 在上方表单中粘贴API Key</li>
          <li>3. 根据需要修改API Base和模型名称</li>
          <li>4. 点击"保存配置"完成设置</li>
          <li>5. API Key将安全存储在后端<code className="px-1 py-0.5 bg-blue-100 rounded">.env</code>文件中</li>
        </ul>
      </div>

      {/* 手动配置提示 */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          手动配置（可选）
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          您也可以直接编辑后端配置文件，路径：<code className="px-1 py-0.5 bg-gray-200 rounded">backend/.env</code>
        </p>
        <pre className="text-xs bg-gray-800 text-gray-100 p-3 rounded overflow-x-auto">
{`# 大模型API配置
OPENAI_API_KEY=your_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4

# 数据库配置
DATABASE_URL=sqlite:///./ai_review.db`}
        </pre>
      </div>
    </div>
  );
}