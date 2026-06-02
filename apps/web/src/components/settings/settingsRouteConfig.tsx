import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Navigate, Route, type RouteObject, useNavigate } from 'react-router-dom';

import type { Supplier } from '../../services/billing/supplierService';
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import {
  buildSettingsPath,
  LEGACY_SETTINGS_ROUTE_REDIRECTS,
  resolveCanonicalSettingsViewId,
  type CanonicalSettingsViewId,
  type SettingsViewId,
} from './settingsRegistry';

const DashboardView = lazyWithRetry(() => import('./views/DashboardView.localized.tsx'));
const ApiSettingsView = lazyWithRetry(() => import('./ApiSettingsView'));

const CostEstimation = lazyWithRetry(() => import('../../pages/CostEstimation'));
const StorageSettingsView = lazyWithRetry(() => import('./views/StorageSettingsView.localized.tsx'));
const SystemLogsView = lazyWithRetry(() => import('./views/SystemLogsView.localized.tsx'));
const UserProfileView = lazyWithRetry(() => import('./views/UserProfileView.tsx'));

type SettingsWorkbenchRouteDefinition =
  | { path: ''; kind: 'dashboard'; index: true }
  | { path: 'api-management'; kind: 'api' }

  | { path: 'api-management/official/new'; kind: 'api' }
  | { path: 'api-management/official/:officialId'; kind: 'api' }
  | { path: 'api-management/provider/new'; kind: 'api' }
  | { path: 'api-management/provider/:providerId'; kind: 'api' }
  | { path: 'api-management/:supplierId'; kind: 'api' }
  | { path: 'consumption-records'; kind: 'billing' }
  | { path: 'storage-settings'; kind: 'storage' }
  | { path: 'system-logs'; kind: 'logs' }
  | { path: 'user-profile'; kind: 'profile' };

const SETTINGS_WORKBENCH_ROUTE_DEFINITIONS: SettingsWorkbenchRouteDefinition[] = [
  { path: '', kind: 'dashboard', index: true },
  { path: 'api-management', kind: 'api' },

  { path: 'api-management/official/new', kind: 'api' },
  { path: 'api-management/official/:officialId', kind: 'api' },
  { path: 'api-management/provider/new', kind: 'api' },
  { path: 'api-management/provider/:providerId', kind: 'api' },
  { path: 'api-management/:supplierId', kind: 'api' },
  { path: 'consumption-records', kind: 'billing' },
  { path: 'storage-settings', kind: 'storage' },
  { path: 'system-logs', kind: 'logs' },
  { path: 'user-profile', kind: 'profile' },
];

interface SettingsRouteOptions {
  dashboardBasePath?: string;
  initialSupplier?: Supplier | null;
  onDashboardNavigate?: (view: CanonicalSettingsViewId) => void;
  refreshKey?: number;
}

const DashboardRouteElement: React.FC<{
  basePath: string;
  onNavigateOverride?: (view: CanonicalSettingsViewId) => void;
}> = ({ basePath, onNavigateOverride }) => {
  const navigate = useNavigate();

  return (
    <DashboardView
      onNavigate={(view) => {
        const canonical = resolveCanonicalSettingsViewId(view as SettingsViewId);
        if (onNavigateOverride) {
          onNavigateOverride(canonical);
          return;
        }

        navigate(basePath === '/settings' ? buildSettingsPath(canonical) : `${basePath}${buildSettingsPath(canonical)}`);
      }}
    />
  );
};

function getRouteElement(
  definition: SettingsWorkbenchRouteDefinition,
  options: SettingsRouteOptions,
) {
  const routeRefreshKey = `${definition.kind}:${definition.path || 'dashboard'}:${options.refreshKey || 0}`;

  switch (definition.kind) {
    case 'dashboard':
      return (
        <DashboardRouteElement
          key={routeRefreshKey}
          basePath={options.dashboardBasePath || '/settings'}
          onNavigateOverride={options.onDashboardNavigate}
        />
      );
    case 'api':
      return <ApiSettingsView key={routeRefreshKey} initialSupplier={options.initialSupplier || null} />;

    case 'billing':
      return KKAI_FEATURE_FLAGS.billing
        ? <CostEstimation key={routeRefreshKey} embedded />
        : <Navigate to={(options.dashboardBasePath || '/settings')} replace />;
    case 'storage':
      return <StorageSettingsView key={routeRefreshKey} />;
    case 'logs':
      return <SystemLogsView key={routeRefreshKey} />;
    case 'profile':
      return <UserProfileView key={routeRefreshKey} />;
    default:
      return <Navigate to={(options.dashboardBasePath || '/settings')} replace />;
  }
}

export function createSettingsRouteObjects(options: SettingsRouteOptions = {}): RouteObject[] {
  const basePath = options.dashboardBasePath || '/settings';

  return [
    ...SETTINGS_WORKBENCH_ROUTE_DEFINITIONS.map((definition) => ({
      path: definition.path,
      index: definition.kind === 'dashboard' ? definition.index : undefined,
      element: getRouteElement(definition, options),
    })),
    ...LEGACY_SETTINGS_ROUTE_REDIRECTS.map(({ path, target }) => ({
      path,
      element: <Navigate to={basePath === '/settings' ? buildSettingsPath(target) : `${basePath}${buildSettingsPath(target)}`} replace />,
    })),
    {
      path: '*',
      element: <Navigate to={basePath} replace />,
    },
  ];
}

export function renderSettingsRouteElements(options: SettingsRouteOptions = {}) {
  const basePath = options.dashboardBasePath || '/settings';

  return [
    ...SETTINGS_WORKBENCH_ROUTE_DEFINITIONS.map((definition) => (
      <Route
        key={definition.path || 'dashboard'}
        path={`${basePath}${definition.path ? `/${definition.path}` : ''}`}
        index={definition.kind === 'dashboard' ? definition.index : undefined}
        element={getRouteElement(definition, options)}
      />
    )),
    ...LEGACY_SETTINGS_ROUTE_REDIRECTS.map(({ path, target }) => (
      <Route
        key={path}
        path={`${basePath}/${path}`}
        element={<Navigate to={basePath === '/settings' ? buildSettingsPath(target) : `${basePath}${buildSettingsPath(target)}`} replace />}
      />
    )),
    <Route key="fallback" path="*" element={<Navigate to={basePath} replace />} />,
  ];
}
