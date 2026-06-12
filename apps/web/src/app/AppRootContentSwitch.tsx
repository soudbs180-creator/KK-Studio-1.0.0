import React from 'react';
import { lazyWithRetry, lazyNamedWithRetry } from '../utils/lazyWithRetry';
import { createAppRootMode } from '../context/kkaiRuntimeContext';
import { AppContent } from '../App';
import { AppStartupScreen } from '../components/common/AppStartupScreen';

// 简体中文注释：按需加载管理后台和设置页面根组件
const SettingsPageRoot = lazyWithRetry(() => import('./SettingsPageRoot'));
const AdminLayout = lazyNamedWithRetry(() => import('../pages/admin/AdminLayout.tsx'), 'AdminLayout');
const StressLab = lazyNamedWithRetry(() => import('../dev/StressLab'), 'StressLab');

// 简体中文注释：包装 Suspense 以提供加载时的占位 Loading 效果
const AdminLayoutSuspended: React.FC<any> = (props) => (
  <React.Suspense fallback={<AppStartupScreen stage="workspace_ready" />}>
    <AdminLayout {...props} />
  </React.Suspense>
);

const SettingsPageRootSuspended: React.FC<any> = (props) => (
  <React.Suspense fallback={<AppStartupScreen stage="workspace_ready" />}>
    <SettingsPageRoot {...props} />
  </React.Suspense>
);

const StressLabSuspended: React.FC = () => (
  <React.Suspense fallback={<AppStartupScreen stage="workspace_ready" />}>
    <StressLab />
  </React.Suspense>
);

export const AppRootContentSwitch: React.FC = () => {
  if (import.meta.env.DEV && window.location.pathname === '/stress-lab') {
    return <StressLabSuspended />;
  }

  const rootMode = createAppRootMode({ pathname: window.location.pathname });

  // 简体中文注释：基于 rootMode 决定渲染后台管理、设置页面还是主画布工作区
  if (rootMode === 'admin') {
    return <AdminLayoutSuspended />;
  }
  if (rootMode === 'settings') {
    return <SettingsPageRootSuspended />;
  }
  return <AppContent />;
};

export default AppRootContentSwitch;
