import React, { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import {
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  ScrollText,
} from 'lucide-react';

import { KKAI_FEATURE_FLAGS } from '../app/kkaiFeatureFlags';

const DashboardView = lazy(() => import('../components/settings/views/DashboardView.localized.tsx'));
const ApiSettingsView = lazy(() => import('../components/settings/ApiSettingsView'));
const CostEstimation = lazy(() => import('../pages/CostEstimation'));
const StorageSettingsView = lazy(() => import('../components/settings/views/StorageSettingsView.localized.tsx'));
const SystemLogsView = lazy(() => import('../components/settings/views/SystemLogsView.localized.tsx'));

export type SettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs';

type NavSectionId = 'workspace' | 'system';

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
];

export const settingsNavItems: SettingsNavItem[] = [
  {
    id: 'dashboard',
    label: '总览',
    description: '查看链路状态、运行概况和待处理事项。',
    icon: LayoutDashboard,
    section: 'workspace',
    path: '',
  },
  {
    id: 'api-management',
    label: 'API 绠＄悊',
    description: '统一管理官方接口、供应商和本地路由策略。',
    icon: KeyRound,
    section: 'workspace',
    path: 'api-management',
  },
  ...(KKAI_FEATURE_FLAGS.billing ? [
    {
      id: 'consumption-records' as const,
      label: '消费记录',
      description: '查看消费、充值和账单明细。',
      icon: Coins,
      section: 'workspace' as const,
      path: 'consumption-records',
    },
  ] : []),
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
  ...(KKAI_FEATURE_FLAGS.billing ? [
    {
      path: 'consumption-records',
      element: <CostEstimation embedded />,
    } satisfies RouteObject,
  ] : []),
  {
    path: 'storage-settings',
    element: <StorageSettingsView />,
  },
  {
    path: 'system-logs',
    element: <SystemLogsView />,
  },
];

export const getNavItemByPath = (path: string): SettingsNavItem | undefined =>
  path.startsWith('api-management')
    ? settingsNavItems.find((item) => item.id === 'api-management')
    : settingsNavItems.find((item) => item.path === path);

export const getNavItemById = (id: SettingsViewId): SettingsNavItem | undefined =>
  settingsNavItems.find((item) => item.id === id);
