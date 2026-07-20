import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ReviewDetail from './pages/ReviewDetail';
import Reviews from './pages/Reviews';
import ProductReviews from './pages/ProductReviews';
import ProductReviewDetail from './pages/ProductReviewDetail';
import Judges from './pages/Judges';
import JudgeDetail from './pages/JudgeDetail';
import Settings from './pages/Settings';
import Configs from './pages/Configs';
import { useEffect, useState } from 'react';
import { configApi } from './lib/api';

function App() {
  const [, setHasApiKey] = useState<boolean | null>(null);
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      const response = await configApi.check();
      setHasApiKey(response.data.configured);
      if (!response.data.configured) {
        setShowApiKeyWarning(true);
      }
    } catch (error) {
      console.error('Failed to check API key:', error);
      setHasApiKey(false);
      setShowApiKeyWarning(true);
    }
  };

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        {showApiKeyWarning && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  ⚠️ 未检测到API Key配置！请前往
                  <a href="/settings" className="font-medium underline text-yellow-700 hover:text-yellow-600 ml-1">
                    设置页面
                  </a>
                  查看配置说明。
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setShowApiKeyWarning(false)}
                  className="text-yellow-400 hover:text-yellow-500"
                >
                  <span className="sr-only">关闭</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/reviews/:id" element={<ReviewDetail />} />
          <Route path="/product-reviews" element={<ProductReviews />} />
          <Route path="/product-reviews/:id" element={<ProductReviewDetail />} />
          <Route path="/judges" element={<Judges />} />
          <Route path="/judges/:id" element={<JudgeDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/configs" element={<Configs />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;