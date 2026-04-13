const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const MOBILE_RETENTION_MODES = ['manual', '7d', '30d'] as const;
export type MobileRetentionMode = (typeof MOBILE_RETENTION_MODES)[number];

export const MOBILE_RETENTION_RESOURCES = ['images', 'originals', 'tasks', 'logs'] as const;
export type MobileRetentionResource = (typeof MOBILE_RETENTION_RESOURCES)[number];

export type MobileRetentionCutoffField = 'timestamp' | 'createdAt';
export type MobileRetentionScope = 'all' | 'completed-or-failed';

export interface MobileRetentionRule {
  resource: MobileRetentionResource;
  label: string;
  description: string;
  days: number | null;
  cutoff: number | null;
  cutoffField: MobileRetentionCutoffField;
  scope: MobileRetentionScope;
}

type MobileRetentionResourceConfig = {
  label: string;
  cutoffField: MobileRetentionCutoffField;
  scope: MobileRetentionScope;
  manualDescription: string;
  timedDescription: (days: number) => string;
};

const MOBILE_RETENTION_MODE_DAYS: Record<MobileRetentionMode, number | null> = {
  manual: null,
  '7d': 7,
  '30d': 30,
};

const MOBILE_RETENTION_RESOURCE_CONFIG: Record<MobileRetentionResource, MobileRetentionResourceConfig> = {
  images: {
    label: '缓存图片',
    cutoffField: 'timestamp',
    scope: 'all',
    manualDescription: '缓存图片仅在你手动清理时删除。',
    timedDescription: (days) => `自动清理 ${days} 天前的缓存图片。`,
  },
  originals: {
    label: '原图',
    cutoffField: 'timestamp',
    scope: 'all',
    manualDescription: '原图仅在你手动清理时删除。',
    timedDescription: (days) => `自动清理 ${days} 天前的原图。`,
  },
  tasks: {
    label: '任务记录',
    cutoffField: 'createdAt',
    scope: 'completed-or-failed',
    manualDescription: '任务记录仅在你手动清理时删除。',
    timedDescription: (days) => `自动清理 ${days} 天前已完成或失败的任务记录。`,
  },
  logs: {
    label: '系统日志',
    cutoffField: 'timestamp',
    scope: 'all',
    manualDescription: '系统日志仅在你手动清理时删除。',
    timedDescription: (days) => `自动清理 ${days} 天前的系统日志。`,
  },
};

export function getMobileRetentionCutoff(
  mode: MobileRetentionMode,
  now: number = Date.now(),
): number | null {
  const days = MOBILE_RETENTION_MODE_DAYS[mode];
  return typeof days === 'number' ? now - days * DAY_IN_MS : null;
}

export function getMobileRetentionRule(
  resource: MobileRetentionResource,
  mode: MobileRetentionMode,
  now: number = Date.now(),
): MobileRetentionRule {
  const config = MOBILE_RETENTION_RESOURCE_CONFIG[resource];
  const days = MOBILE_RETENTION_MODE_DAYS[mode];

  return {
    resource,
    label: config.label,
    description: typeof days === 'number'
      ? config.timedDescription(days)
      : config.manualDescription,
    days,
    cutoff: getMobileRetentionCutoff(mode, now),
    cutoffField: config.cutoffField,
    scope: config.scope,
  };
}

export function getMobileRetentionPolicy(
  mode: MobileRetentionMode,
  now: number = Date.now(),
): Record<MobileRetentionResource, MobileRetentionRule> {
  return MOBILE_RETENTION_RESOURCES.reduce((policy, resource) => {
    policy[resource] = getMobileRetentionRule(resource, mode, now);
    return policy;
  }, {} as Record<MobileRetentionResource, MobileRetentionRule>);
}
