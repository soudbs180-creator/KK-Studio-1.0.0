import type {
  CanonicalSettingsViewId,
  SettingsNavItem,
} from './settingsRegistry';

type MobileSettingsGroupId = 'workspace' | 'capabilities' | 'automation' | 'system';

const MOBILE_SETTINGS_GROUPS: Array<{
  id: MobileSettingsGroupId;
  labelZh: string;
  labelEn: string;
  views: CanonicalSettingsViewId[];
}> = [
  { id: 'workspace', labelZh: '创作设置', labelEn: 'Creation', views: ['generation-mode'] },
  {
    id: 'capabilities',
    labelZh: '能力配置',
    labelEn: 'Capabilities',
    views: ['capability-sources', 'provider-routes'],
  },
  {
    id: 'automation',
    labelZh: '自动化',
    labelEn: 'Automation',
    views: ['browser-assistant', 'ai-takeover'],
  },
  {
    id: 'system',
    labelZh: '系统维护',
    labelEn: 'System',
    views: ['data-sync', 'appearance-motion', 'canvas-performance', 'dev-diagnostics'],
  },
];

/**
 * Builds the mobile navigation without a duplicate overview destination because
 * the settings landing screen already is the product overview.
 */
export function buildMobileSettingsGroups(items: SettingsNavItem[], english: boolean) {
  return MOBILE_SETTINGS_GROUPS.map((group) => ({
    id: group.id,
    label: english ? group.labelEn : group.labelZh,
    items: group.views
      .map((view) => items.find((item) => item.id === view))
      .filter((item): item is SettingsNavItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Keeps the mobile header predictable: the landing title is centered while a
 * nested route makes room for the visible back control.
 */
export function resolveMobileSettingsTopbarState(atHome: boolean, currentTitle: string) {
  return {
    title: atHome ? '系统设置' : currentTitle,
    titleAlignment: atHome ? 'center' : 'start',
    showBackButton: !atHome,
  } as const;
}
