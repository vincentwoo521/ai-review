import { useEffect, useState } from 'react';
import { dashboardApi } from '../lib/api';
import type { DashboardStats } from '../types';
import { 
  TrendingUp, 
  FolderKanban, 
  FileText, 
  Users,
  CheckCircle
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await dashboardApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
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

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="项目总数"
          value={stats.total_projects}
          icon={FolderKanban}
          color="primary"
        />
        <StatCard
          title="评审总数"
          value={stats.total_reviews}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="已完成评审"
          value={stats.completed_reviews}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="评委数量"
          value={stats.total_judges}
          icon={Users}
          color="purple"
        />
      </div>

      {/* 评分统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">平均项目评审评分</h3>
          <div className="flex items-center">
            <TrendingUp className="h-16 w-16 text-primary-500 mr-4" />
            <div>
              <div className="text-4xl font-bold text-gray-900">
                {stats.avg_rating.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* 优秀评委 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">优秀评委TOP 5</h3>
          <div className="space-y-3">
            {stats.top_judges && stats.top_judges.length > 0 ? (
              stats.top_judges.slice(0, 5).map((judge, index) => (
                <div key={judge.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium mr-3">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {judge.name}
                      {judge.organization && <span className="text-gray-500 ml-1">({judge.organization})</span>}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>提问: {judge.total_questions}</span>
                    <span>评分: {judge.avg_rating.toFixed(1)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">暂无评委数据</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'blue' | 'green' | 'purple';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}