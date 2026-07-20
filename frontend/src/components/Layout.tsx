import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Settings,
  FileText,
  Sliders,
  Package
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: '数据看板', href: '/dashboard', icon: LayoutDashboard },
  { name: '立项评审管理', href: '/projects', icon: FolderKanban },
  { name: '评审列表', href: '/reviews', icon: FileText },
  { name: 'AI 产品评估', href: '/product-reviews', icon: Package },
  { name: '评委管理', href: '/judges', icon: Users },
  { name: '评审配置', href: '/configs', icon: Sliders },
  { name: '系统设置', href: '/settings', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 */}
      <div className="w-64 bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <FileText className="h-8 w-8 text-primary-600" />
          <span className="ml-2 text-xl font-semibold text-gray-900">AI评审系统</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6">
          <h1 className="text-lg font-semibold text-gray-900">
            {navigation.find(n => location.pathname.startsWith(n.href))?.name || 'AI评审系统'}
          </h1>
        </div>

        {/* 内容区 */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}