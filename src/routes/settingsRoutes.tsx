import React, { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
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

type CanonicalSettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs';

type LegacySettingsViewId =
  | 'admin-console'
  | 'credit-models'
  | 'exchange-rates'
  | 'admin-system'
  | 'cost-estimation';

export type SettingsViewId = CanonicalSettingsViewId | LegacySettingsViewId;

type NavSectionId = 'workspace' | 'system';

export interface SettingsNavItem {
  id: CanonicalSettingsViewId;
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

const SETTINGS_PATHS: Record<CanonicalSettingsViewId, string> = {
  dashboard: '',
  'api-management': 'api-management',
  'consumption-records': 'consumption-records',
  'storage-settings': 'storage-settings',
  'system-logs': 'system-logs',
};

const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = {
  'admin-console': 'api-management',
  'credit-models': 'api-management',
  'exchange-rates': 'api-management',
  'admin-system': 'api-management',
  'cost-estimation': 'consumption-records',
};

const consumptionRecordsNavItem: SettingsNavItem = {
  id: 'consumption-records',
  label: '消耗账单',
  description: '查看积分消耗、充值和账单明细。',
  icon: Coins,
  section: 'workspace',
  path: SETTINGS_PATHS['consumption-records'],
};

export const settingsNavItems: SettingsNavItem[] = [
  {
    id: 'dashboard',
    label: '总览',
    description: '查看链路状态、消费概况和待处理事项。',
    icon: LayoutDashboard,
    section: 'workspace',
    path: SETTINGS_PATHS.dashboard,
  },
  {
    id: 'api-management',
    label: 'API 管理',
    description: '统一管理官方接口、供应商和预算策略。',
    icon: KeyRound,
    section: 'workspace',
    path: SETTINGS_PATHS['api-management'],
  },
  ...(KKAI_FEATURE_FLAGS.billing ? [consumptionRecordsNavItem] : []),
  {
    id: 'storage-settings',
    label: '存储设置',
    description: '管理本地存储、缓存清理和项目整理。',
    icon: HardDrive,
    section: 'system',
    path: SETTINGS_PATHS['storage-settings'],
  },
  {
    id: 'system-logs',
    label: '系统错误日志',
    description: '排查运行异常、错误和警告。',
    icon: ScrollText,
    section: 'system',
    path: SETTINGS_PATHS['system-logs'],
  },
];

const buildSettingsPath = (view: CanonicalSettingsViewId) =>
  SETTINGS_PATHS[view] ? `/settings/${SETTINGS_PATHS[view]}` : '/settings';

const billingSettingsRouteElement = KKAI_FEATURE_FLAGS.billing ? <CostEstimation embedded /> : <Navigate to="/settings" replace />;

const LEGACY_SETTINGS_ROUTE_REDIRECTS: Array<{
  path: string;
  target: CanonicalSettingsViewId;
}> = [
  { path: 'cost-estimation', target: 'consumption-records' },
  { path: 'credit-models', target: 'api-management' },
  { path: 'exchange-rates', target: 'api-management' },
  { path: 'admin-console', target: 'api-management' },
  { path: 'admin-system/*', target: 'api-management' },
];

const resolveCanonicalSettingsViewId = (view: SettingsViewId): CanonicalSettingsViewId =>
  LEGACY_SETTINGS_VIEW_ALIASES[view as LegacySettingsViewId] ?? view;

const getTopLevelSettingsPath = (path: string) =>
  path.replace(/^\/settings\/?/, '').split('/')[0] || '';

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
    element: billingSettingsRouteElement,
  },
  {
    path: 'storage-settings',
    element: <StorageSettingsView />,
  },
  {
    path: 'system-logs',
    element: <SystemLogsView />,
  },
  ...LEGACY_SETTINGS_ROUTE_REDIRECTS.map(({ path, target }) => ({
    path,
    element: <Navigate to={buildSettingsPath(target)} replace />,
  })),
];

export const getNavItemByPath = (path: string): SettingsNavItem | undefined => {
  const topLevelPath = getTopLevelSettingsPath(path);

  if (!topLevelPath) {
    return settingsNavItems.find((item) => item.id === 'dashboard');
  }

  if (topLevelPath === 'api-management') {
    return settingsNavItems.find((item) => item.id === 'api-management');
  }

  if (topLevelPath in LEGACY_SETTINGS_VIEW_ALIASES) {
    return settingsNavItems.find(
      (item) => item.id === LEGACY_SETTINGS_VIEW_ALIASES[topLevelPath as LegacySettingsViewId],
    );
  }

  return settingsNavItems.find((item) => item.path === topLevelPath);
};

export const getNavItemById = (id: SettingsViewId): SettingsNavItem | undefined =>
  settingsNavItems.find((item) => item.id === resolveCanonicalSettingsViewId(id));
