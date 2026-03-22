import React, { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import {
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Shield,
} from 'lucide-react';

const DashboardView = lazy(() => import('../components/settings/views/DashboardView'));
const ApiSettingsView = lazy(() => import('../components/settings/ApiSettingsView'));
const CostEstimation = lazy(() => import('../pages/CostEstimation'));
const StorageSettingsView = lazy(() => import('../components/settings/views/StorageSettingsView'));
const SystemLogsView = lazy(() => import('../components/settings/views/SystemLogsView'));
const AdminSystem = lazy(() => import('../components/settings/AdminSystem'));

export type SettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs'
  | 'admin-console'
  | 'credit-models'
  | 'exchange-rates'
  | 'admin-system';

type NavSectionId = 'workspace' | 'system' | 'admin';

export interface SettingsNavItem {
  id: SettingsViewId;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section: NavSectionId;
  path: string;
}

export const settingsNavSections: Array<{ id: NavSectionId; label: string }> = [
  { id: 'workspace', label: '工作台' },
  { id: 'system', label: '系统维护' },
  { id: 'admin', label: '后台管理' },
];

export const settingsNavItems: SettingsNavItem[] = [
  {
    id: 'dashboard',
    label: '总览',
    description: '查看链路状态、消费概况和待处理事项。',
    icon: LayoutDashboard,
    section: 'workspace',
    path: '',
  },
  {
    id: 'api-management',
    label: 'API 管理',
    description: '统一管理官方接口、供应商和预算策略。',
    icon: KeyRound,
    section: 'workspace',
    path: 'api-management',
  },
  {
    id: 'consumption-records',
    label: '消费记录',
    description: '查看消费、充值和账单明细。',
    icon: Coins,
    section: 'workspace',
    path: 'consumption-records',
  },
  {
    id: 'storage-settings',
    label: '存储设置',
    description: '管理本地存储、缓存清理和项目整理。',
    icon: HardDrive,
    section: 'system',
    path: 'storage-settings',
  },
  {
    id: 'system-logs',
    label: '系统日志',
    description: '集中查看警告、错误与运行风险。',
    icon: ScrollText,
    section: 'system',
    path: 'system-logs',
  },
  {
    id: 'admin-console',
    label: '管理员后台',
    description: '处理积分模型、汇率规则和后台权限。',
    icon: Shield,
    section: 'admin',
    path: 'admin-console',
  },
];

export const settingsRoutes: RouteObject[] = [
  {
    path: '',
    element: <DashboardView onNavigate={() => undefined} />,
    index: true,
  },
  {
    path: 'api-management',
    element: <ApiSettingsView />,
  },
  {
    path: 'api-management/official/new',
    element: <ApiSettingsView />,
  },
  {
    path: 'api-management/official/:officialId',
    element: <ApiSettingsView />,
  },
  {
    path: 'api-management/provider/new',
    element: <ApiSettingsView />,
  },
  {
    path: 'api-management/provider/:providerId',
    element: <ApiSettingsView />,
  },
  {
    path: 'api-management/:supplierId',
    element: <ApiSettingsView />,
  },
  {
    path: 'consumption-records',
    element: <CostEstimation embedded />,
  },
  {
    path: 'storage-settings',
    element: <StorageSettingsView />,
  },
  {
    path: 'system-logs',
    element: <SystemLogsView />,
  },
  {
    path: 'credit-models',
    element: <AdminSystem initialTab="credit-models" />,
  },
  {
    path: 'exchange-rates',
    element: <AdminSystem initialTab="exchange-rates" />,
  },
  {
    path: 'admin-console',
    element: <AdminSystem initialTab="admin-console" />,
  },
  {
    path: 'admin-system',
    element: <AdminSystem initialTab="credit-models" />,
  },
];

export const getNavItemByPath = (path: string): SettingsNavItem | undefined =>
  path === 'credit-models' || path === 'exchange-rates' || path === 'admin-system'
    ? settingsNavItems.find((item) => item.id === 'admin-console')
    : path.startsWith('api-management')
      ? settingsNavItems.find((item) => item.id === 'api-management')
    : settingsNavItems.find((item) => item.path === path);

export const getNavItemById = (id: SettingsViewId): SettingsNavItem | undefined =>
  id === 'credit-models' || id === 'exchange-rates' || id === 'admin-system'
    ? settingsNavItems.find((item) => item.id === 'admin-console')
    : settingsNavItems.find((item) => item.id === id);
