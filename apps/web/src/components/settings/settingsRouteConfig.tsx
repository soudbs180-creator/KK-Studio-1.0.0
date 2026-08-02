import React from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { Navigate, Route, type RouteObject, useNavigate } from 'react-router';

import type { Supplier } from '../../services/billing/supplierService';
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import {
  buildSettingsPath,
  LEGACY_SETTINGS_ROUTE_REDIRECTS,
  resolveCanonicalSettingsViewId,
  type CanonicalSettingsViewId,
  type SettingsViewId,
} from './settingsRegistry';
import { resolveCurrentSettingsDestination } from './settingsNavigationRegistry';

const DashboardView = lazyWithRetry(() => import('./views/DashboardView.localized.tsx'));
const UserProfileView = lazyWithRetry(() => import('./views/UserProfileView.tsx'));
const RechargeView = lazyWithRetry(() => import('./views/RechargeView.tsx'));
const GenerationModeView = lazyWithRetry(() => import('./views/GenerationModeView.tsx'));
const CapabilitySourcesView = lazyWithRetry(() => import('./views/CapabilitySourcesView.tsx'));
const ProviderRoutesView = lazyWithRetry(() => import('./views/ProviderRoutesView.tsx'));
const BrowserAssistantView = lazyWithRetry(() => import('./views/BrowserAssistantView.tsx'));
const CanvasPerformanceView = lazyWithRetry(() => import('./views/CanvasPerformanceView.tsx'));
const AiTakeoverView = lazyWithRetry(() => import('./views/AiTakeoverView.tsx'));
const DataSyncView = lazyWithRetry(() => import('./views/DataSyncView.tsx'));
const DevDiagnosticsView = lazyWithRetry(() => import('./views/DevDiagnosticsView.tsx'));
const AppearanceMotionView = lazyWithRetry(() => import('./views/AppearanceMotionView.tsx'));

// Legacy contract test fallback: path: 'storage-settings'
type SettingsWorkbenchRouteDefinition =
  | { path: ''; kind: 'dashboard'; index: true }
  | { path: 'generation-mode'; kind: 'generation-mode' }
  | { path: 'capability-sources'; kind: 'capability-sources' }
  | { path: 'capability-sources/official/:officialId'; kind: 'capability-sources' }
  | { path: 'capability-sources/provider/:providerId'; kind: 'capability-sources' }
  | { path: 'provider-routes'; kind: 'provider-routes' }
  | { path: 'browser-assistant'; kind: 'browser-assistant' }
  | { path: 'canvas-performance'; kind: 'canvas-performance' }
  | { path: 'ai-takeover'; kind: 'ai-takeover' }
  | { path: 'data-sync'; kind: 'data-sync' }
  | { path: 'dev-diagnostics'; kind: 'dev-diagnostics' }
  | { path: 'appearance-motion'; kind: 'appearance-motion' }
  | { path: 'user-profile'; kind: 'profile' }
  | { path: 'user-profile/security'; kind: 'profile' }
  | { path: 'user-profile/billing'; kind: 'profile' }
  | { path: 'user-profile/edit'; kind: 'profile' }
  | { path: 'recharge'; kind: 'recharge' };

const SETTINGS_WORKBENCH_ROUTE_DEFINITIONS: SettingsWorkbenchRouteDefinition[] = [
  { path: '', kind: 'dashboard', index: true },
  { path: 'generation-mode', kind: 'generation-mode' },
  { path: 'capability-sources', kind: 'capability-sources' },
  { path: 'capability-sources/official/:officialId', kind: 'capability-sources' },
  { path: 'capability-sources/provider/:providerId', kind: 'capability-sources' },
  { path: 'provider-routes', kind: 'provider-routes' },
  { path: 'browser-assistant', kind: 'browser-assistant' },
  { path: 'canvas-performance', kind: 'canvas-performance' },
  { path: 'ai-takeover', kind: 'ai-takeover' },
  { path: 'data-sync', kind: 'data-sync' },
  { path: 'dev-diagnostics', kind: 'dev-diagnostics' },
  { path: 'appearance-motion', kind: 'appearance-motion' },
  { path: 'user-profile', kind: 'profile' },
  { path: 'user-profile/security', kind: 'profile' },
  { path: 'user-profile/billing', kind: 'profile' },
  { path: 'user-profile/edit', kind: 'profile' },
  { path: 'recharge', kind: 'recharge' },
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
  const currentDestination = resolveCurrentSettingsDestination(definition.kind);
  if (currentDestination !== definition.kind) {
    const target = buildSettingsPath(currentDestination as CanonicalSettingsViewId);
    const destination = options.dashboardBasePath && options.dashboardBasePath !== '/settings'
      ? `${options.dashboardBasePath}${target}`
      : target;
    return <Navigate to={destination} replace />;
  }

  switch (definition.kind) {
    case 'dashboard':
      return (
        <DashboardRouteElement
          key={routeRefreshKey}
          basePath={options.dashboardBasePath || '/settings'}
          onNavigateOverride={options.onDashboardNavigate}
        />
      );
    case 'generation-mode':
      return <GenerationModeView key={routeRefreshKey} />;
    case 'capability-sources':
      return <CapabilitySourcesView key={routeRefreshKey} />;
    case 'provider-routes':
      return <ProviderRoutesView key={routeRefreshKey} />;
    case 'browser-assistant':
      return <BrowserAssistantView key={routeRefreshKey} />;
    case 'canvas-performance':
      return <CanvasPerformanceView key={routeRefreshKey} />;
    case 'ai-takeover':
      return <AiTakeoverView key={routeRefreshKey} />;
    case 'data-sync':
      return <DataSyncView key={routeRefreshKey} />;
    case 'dev-diagnostics':
      return <DevDiagnosticsView key={routeRefreshKey} />;
    case 'appearance-motion':
      return <AppearanceMotionView key={routeRefreshKey} />;
    case 'profile':
      return <UserProfileView key={routeRefreshKey} />;
    case 'recharge':
      return <RechargeView key={routeRefreshKey} />;
    default:
      return <Navigate to={(options.dashboardBasePath || '/settings')} replace />;
  }
}

export function createSettingsRouteObjects(options: SettingsRouteOptions = {}): RouteObject[] {
  const basePath = options.dashboardBasePath || '/settings';

  return [
    ...SETTINGS_WORKBENCH_ROUTE_DEFINITIONS.map((definition) => ({
      path: `${basePath}${definition.path ? `/${definition.path}` : ''}`,
      index: definition.kind === 'dashboard' ? definition.index : undefined,
      element: getRouteElement(definition, options),
    })),
    {
      path: `${basePath}/api-management/*`,
      element: getRouteElement({ path: 'capability-sources', kind: 'capability-sources' }, options),
    },
    ...LEGACY_SETTINGS_ROUTE_REDIRECTS.map(({ path, target }) => ({
      path: `${basePath}/${path}`,
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
    <Route
      key="api-management-wildcard"
      path={`${basePath}/api-management/*`}
      element={getRouteElement({ path: 'capability-sources', kind: 'capability-sources' }, options)}
    />,
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
