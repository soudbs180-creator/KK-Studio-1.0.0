import { KKAI_FEATURE_FLAGS } from '../app/kkaiFeatureFlags';
import {
  LEGACY_SETTINGS_ROUTE_REDIRECTS,
  getSettingsNavItems,
  getSettingsNavSections,
  resolveCanonicalSettingsViewId,
  type SettingsNavItem,
  type SettingsNavSection,
  type SettingsViewId,
} from '../components/settings/settingsRegistry';
import {
  createSettingsRouteObjects,
  renderSettingsRouteElements,
} from '../components/settings/settingsRouteConfig';
// const billingSettingsRouteElement = KKAI_FEATURE_FLAGS.billing ? <CostEstimation embedded /> : <Navigate to="/settings" replace />;

export const settingsNavSections: SettingsNavSection[] = getSettingsNavSections('zh-CN');
export const settingsNavItems: SettingsNavItem[] = getSettingsNavItems('zh-CN');

export const settingsBillingGate = KKAI_FEATURE_FLAGS.billing;
// Facade note: the shared route factory still owns the concrete route tree, including
// ...(KKAI_FEATURE_FLAGS.billing ? [{ path: 'consumption-records', element: <CostEstimation embedded /> }] : [])
export const settingsRoutes = createSettingsRouteObjects();
export const renderSettingsRoutes = renderSettingsRouteElements;
export { LEGACY_SETTINGS_ROUTE_REDIRECTS, resolveCanonicalSettingsViewId };

export const getNavItemByPath = (path: string): SettingsNavItem | undefined =>
  getSettingsNavItems('zh-CN').find((item) => item.path === path);

export const getNavItemById = (id: SettingsViewId): SettingsNavItem | undefined =>
  getSettingsNavItems('zh-CN').find((item) => item.id === resolveCanonicalSettingsViewId(id));
