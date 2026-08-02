export type SettingsNavigationDestinationId =
  | 'dashboard'
  | 'capability-sources'
  | 'provider-routes'
  | 'ai-takeover'
  | 'data-sync'
  | 'appearance-motion'
  | 'dev-diagnostics';

export interface SettingsNavigationItemDefinition {
  id: SettingsNavigationDestinationId;
  labelZh: string;
  labelEn: string;
}

export interface SettingsNavigationGroupDefinition {
  id: 'overview' | 'integrations' | 'system';
  labelZh: string;
  labelEn: string;
  items: readonly SettingsNavigationItemDefinition[];
}

/**
 * Desktop and mobile consume this single taxonomy so labels and ordering cannot
 * drift when a legacy settings screen is merged into a new destination.
 */
export const SETTINGS_NAVIGATION_GROUPS: readonly SettingsNavigationGroupDefinition[] = [
  {
    id: 'overview',
    labelZh: '',
    labelEn: '',
    items: [{ id: 'dashboard', labelZh: '总览', labelEn: 'Overview' }],
  },
  {
    id: 'integrations',
    labelZh: '集成',
    labelEn: 'Integrations',
    items: [
      { id: 'capability-sources', labelZh: 'API 配置', labelEn: 'API Configuration' },
      { id: 'provider-routes', labelZh: '能力配置', labelEn: 'Capability Configuration' },
      { id: 'ai-takeover', labelZh: 'AI 代理', labelEn: 'AI Agent' },
    ],
  },
  {
    id: 'system',
    labelZh: '系统维护',
    labelEn: 'System Maintenance',
    items: [
      { id: 'data-sync', labelZh: '数据与安全', labelEn: 'Data & Security' },
      { id: 'appearance-motion', labelZh: '性能配置', labelEn: 'Performance' },
      { id: 'dev-diagnostics', labelZh: '系统日志', labelEn: 'System Logs' },
    ],
  },
];

const MERGED_SETTINGS_DESTINATIONS = {
  'generation-mode': 'provider-routes',
  'browser-assistant': 'provider-routes',
  'canvas-performance': 'appearance-motion',
} as const;

export function resolveCurrentSettingsDestination(view: string): string {
  return MERGED_SETTINGS_DESTINATIONS[view as keyof typeof MERGED_SETTINGS_DESTINATIONS] ?? view;
}
