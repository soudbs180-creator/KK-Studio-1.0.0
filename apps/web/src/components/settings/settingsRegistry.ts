import type { ComponentType } from 'react';
import {
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  ScrollText,
} from 'lucide-react';

import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { type AppLanguage, pickByLanguage } from '../../context/LocaleContext';

export type CanonicalSettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs';

export type LegacySettingsViewId =
  | 'admin-console'
  | 'credit-models'
  | 'exchange-rates'
  | 'admin-system'
  | 'cost-estimation';

export type SettingsViewId = CanonicalSettingsViewId | LegacySettingsViewId;
export type SettingsNavSectionId = 'workspace' | 'system';

export interface SettingsNavSection {
  id: SettingsNavSectionId;
  label: string;
}

export interface SettingsNavItem {
  id: CanonicalSettingsViewId;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  section: SettingsNavSectionId;
  path: string;
}

export interface SettingsViewMetaEntry {
  eyebrow: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  primaryActionLabelZh: string;
  primaryActionLabelEn: string;
  primaryActionTarget: CanonicalSettingsViewId;
  statusSummaryLabelZh: string;
  statusSummaryLabelEn: string;
}

export interface ResolvedSettingsViewMeta {
  eyebrow: string;
  title: string;
  description: string;
  primaryActionLabel: string;
  primaryActionTarget: CanonicalSettingsViewId;
  statusSummaryLabel: string;
}

export interface SettingsShellCopy {
  workbenchTitle: string;
  workbenchDescription: string;
  emptySearchLabel: string;
  mobileHomeKicker: string;
  mobileHomeTitle: string;
  mobileHomeDescription: string;
  mobileUsageLabel: string;
  mobileErrorsLabel: string;
  mobileErrorsDescription: string;
  currentEntryKicker: string;
  closeSettingsLabel: string;
  backToHomeLabel: string;
}

interface SettingsNavItemDefinition {
  id: CanonicalSettingsViewId;
  path: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  section: SettingsNavSectionId;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
  featureFlag?: 'billing';
}

const SHELL_COPY = {
  'zh-CN': {
    workbenchTitle: '设置',
    workbenchDescription: '统一管理 API、计费、日志和存储。',
    emptySearchLabel: '没有匹配的导航入口。',
    mobileHomeKicker: '移动设置',
    mobileHomeTitle: '四个核心入口',
    mobileHomeDescription: '保留总览、API、计费和错误四个入口。',
    mobileUsageLabel: '计费',
    mobileErrorsLabel: '错误',
    mobileErrorsDescription: '错误、告警与排障信号。',
    currentEntryKicker: '当前入口',
    closeSettingsLabel: '关闭设置',
    backToHomeLabel: '返回移动设置首页',
  },
  'en-US': {
    workbenchTitle: 'Settings',
    workbenchDescription: 'Manage API, billing, logs, and storage from one place.',
    emptySearchLabel: 'No navigation entries matched.',
    mobileHomeKicker: 'Mobile Settings',
    mobileHomeTitle: 'Four core entries',
    mobileHomeDescription: 'Keep Overview, API, Billing, and Errors on the phone home.',
    mobileUsageLabel: 'Billing',
    mobileErrorsLabel: 'Errors',
    mobileErrorsDescription: 'Errors, warnings, and triage signals.',
    currentEntryKicker: 'Current Entry',
    closeSettingsLabel: 'Close settings',
    backToHomeLabel: 'Back to mobile settings home',
  },
} as const;

export const SETTINGS_PATHS: Record<CanonicalSettingsViewId, string> = {
  dashboard: '',
  'api-management': 'api-management',
  'consumption-records': 'consumption-records',
  'storage-settings': 'storage-settings',
  'system-logs': 'system-logs',
};

export const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = {
  'admin-console': 'api-management',
  'admin-system': 'api-management',
  'credit-models': 'api-management',
  'exchange-rates': 'api-management',
  'cost-estimation': 'consumption-records',
};

export const LEGACY_SETTINGS_ROUTE_REDIRECTS: Array<{
  path: string;
  target: CanonicalSettingsViewId;
}> = [
  { path: 'cost-estimation', target: 'consumption-records' },
  { path: 'credit-models', target: 'api-management' },
  { path: 'exchange-rates', target: 'api-management' },
  { path: 'admin-console', target: 'api-management' },
  { path: 'admin-system/*', target: 'api-management' },
];

export const SETTINGS_LEGACY_ROUTE_REDIRECTS = LEGACY_SETTINGS_ROUTE_REDIRECTS.map(({ path, target }) => ({
  path: `/settings/${path}`,
  target,
}));

export const SETTINGS_VIEW_META: Record<CanonicalSettingsViewId, SettingsViewMetaEntry> = {
  dashboard: {
    eyebrow: 'Overview',
    titleZh: '设置总览',
    titleEn: 'Settings Overview',
    descriptionZh: '先看状态，再进入具体设置页。',
    descriptionEn: 'Review status before opening a detailed settings page.',
    primaryActionLabelZh: '打开 API 工作台',
    primaryActionLabelEn: 'Open API Workspace',
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: '系统状态',
    statusSummaryLabelEn: 'System status',
  },
  'api-management': {
    eyebrow: 'API Workspace',
    titleZh: 'API 工作台',
    titleEn: 'API Workspace',
    descriptionZh: '管理本地 API、供应商和预算。',
    descriptionEn: 'Manage local APIs, providers, and budgets.',
    primaryActionLabelZh: '配置本地 API',
    primaryActionLabelEn: 'Configure local API',
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: '路由状态',
    statusSummaryLabelEn: 'Route status',
  },
  'consumption-records': {
    eyebrow: 'Billing',
    titleZh: '计费账本',
    titleEn: 'Billing',
    descriptionZh: '查看充值、消耗和账本。',
    descriptionEn: 'Review recharges, spend, and ledger activity.',
    primaryActionLabelZh: '查看 API 工作台',
    primaryActionLabelEn: 'Open API Workspace',
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: '账本状态',
    statusSummaryLabelEn: 'Ledger status',
  },
  'storage-settings': {
    eyebrow: 'Storage',
    titleZh: '存储维护',
    titleEn: 'Storage',
    descriptionZh: '管理模式、容量和修复动作。',
    descriptionEn: 'Manage modes, capacity, and repair actions.',
    primaryActionLabelZh: '查看存储模式',
    primaryActionLabelEn: 'Review storage mode',
    primaryActionTarget: 'storage-settings',
    statusSummaryLabelZh: '存储状态',
    statusSummaryLabelEn: 'Storage status',
  },
  'system-logs': {
    eyebrow: 'Logs',
    titleZh: '日志',
    titleEn: 'Logs',
    descriptionZh: '查看错误、告警和诊断信号。',
    descriptionEn: 'Inspect errors, warnings, and diagnostic signals.',
    primaryActionLabelZh: '返回 API 工作台',
    primaryActionLabelEn: 'Back to API Workspace',
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: '日志状态',
    statusSummaryLabelEn: 'Log status',
  },
};

export const SETTINGS_NAV_ITEM_DEFINITIONS: SettingsNavItemDefinition[] = [
  {
    id: 'dashboard',
    labelZh: '总览',
    labelEn: 'Overview',
    descriptionZh: '状态、入口、活动。',
    descriptionEn: 'Status, entries, activity.',
    icon: LayoutDashboard,
    section: 'workspace',
    path: SETTINGS_PATHS.dashboard,
  },
  {
    id: 'api-management',
    labelZh: 'API 工作台',
    labelEn: 'API Workspace',
    descriptionZh: '本地 API、供应商、预算。',
    descriptionEn: 'Local APIs, providers, budgets.',
    icon: KeyRound,
    section: 'workspace',
    path: SETTINGS_PATHS['api-management'],
  },
  {
    id: 'consumption-records',
    labelZh: '计费账本',
    labelEn: 'Billing',
    descriptionZh: '充值、消耗、账本。',
    descriptionEn: 'Recharge, spend, ledger.',
    icon: Coins,
    section: 'workspace',
    path: SETTINGS_PATHS['consumption-records'],
    featureFlag: 'billing',
  },
  {
    id: 'system-logs',
    labelZh: '日志',
    labelEn: 'Logs',
    descriptionZh: '错误、告警、排障。',
    descriptionEn: 'Errors, warnings, triage.',
    icon: ScrollText,
    section: 'system',
    path: SETTINGS_PATHS['system-logs'],
  },
  {
    id: 'storage-settings',
    labelZh: '存储',
    labelEn: 'Storage',
    descriptionZh: '模式、容量、清理。',
    descriptionEn: 'Modes, capacity, cleanup.',
    icon: HardDrive,
    section: 'system',
    path: SETTINGS_PATHS['storage-settings'],
  },
];

function isNavItemEnabled(definition: SettingsNavItemDefinition): boolean {
  if (definition.featureFlag === 'billing') {
    return KKAI_FEATURE_FLAGS.billing;
  }

  return true;
}

export function buildSettingsPath(view: CanonicalSettingsViewId): string {
  return SETTINGS_PATHS[view] ? `/settings/${SETTINGS_PATHS[view]}` : '/settings';
}

export function resolveCanonicalSettingsViewId(view?: SettingsViewId): CanonicalSettingsViewId {
  if (!view) return 'dashboard';
  return LEGACY_SETTINGS_VIEW_ALIASES[view as LegacySettingsViewId] ?? view;
}

export function isSettingsViewEnabled(view: CanonicalSettingsViewId): boolean {
  const definition = SETTINGS_NAV_ITEM_DEFINITIONS.find((item) => item.id === view);
  return definition ? isNavItemEnabled(definition) : false;
}

export function coerceEnabledSettingsViewId(view?: SettingsViewId): CanonicalSettingsViewId {
  const canonicalView = resolveCanonicalSettingsViewId(view);
  return isSettingsViewEnabled(canonicalView) ? canonicalView : 'dashboard';
}

export function getCurrentSettingsViewId(pathname: string): CanonicalSettingsViewId {
  const currentPath = pathname.replace(/^\/settings\/?/, '');
  const topLevelPath = currentPath.split('/')[0] as SettingsViewId | undefined;

  if (!currentPath) return 'dashboard';
  if (currentPath.startsWith('api-management')) return 'api-management';
  if (topLevelPath && topLevelPath in LEGACY_SETTINGS_VIEW_ALIASES) {
    return coerceEnabledSettingsViewId(LEGACY_SETTINGS_VIEW_ALIASES[topLevelPath as LegacySettingsViewId]);
  }

  const matchedDefinition = SETTINGS_NAV_ITEM_DEFINITIONS.find((item) => item.path === currentPath);
  return matchedDefinition ? coerceEnabledSettingsViewId(matchedDefinition.id) : 'dashboard';
}

export function getSettingsNavSections(language: AppLanguage): SettingsNavSection[] {
  return [
    {
      id: 'workspace',
      label: pickByLanguage(language, '主工作区', 'Primary workspace'),
    },
    {
      id: 'system',
      label: pickByLanguage(language, '系统维护', 'System maintenance'),
    },
  ];
}

export function getSettingsNavItems(language: AppLanguage): SettingsNavItem[] {
  return SETTINGS_NAV_ITEM_DEFINITIONS
    .filter(isNavItemEnabled)
    .map((item) => ({
      id: item.id,
      label: pickByLanguage(language, item.labelZh, item.labelEn),
      description: pickByLanguage(language, item.descriptionZh, item.descriptionEn),
      icon: item.icon,
      section: item.section,
      path: item.path,
    }));
}

export function getSettingsViewMeta(
  view: CanonicalSettingsViewId,
  language: AppLanguage = 'zh-CN',
): ResolvedSettingsViewMeta {
  const meta = SETTINGS_VIEW_META[view];
  return {
    eyebrow: meta.eyebrow,
    title: pickByLanguage(language, meta.titleZh, meta.titleEn),
    description: pickByLanguage(language, meta.descriptionZh, meta.descriptionEn),
    primaryActionLabel: pickByLanguage(language, meta.primaryActionLabelZh, meta.primaryActionLabelEn),
    primaryActionTarget: meta.primaryActionTarget,
    statusSummaryLabel: pickByLanguage(language, meta.statusSummaryLabelZh, meta.statusSummaryLabelEn),
  };
}

export function getSettingsPrimaryActionMeta(
  view: CanonicalSettingsViewId,
  language: AppLanguage = 'zh-CN',
) {
  const meta = getSettingsViewMeta(view, language);
  return {
    label: meta.primaryActionLabel,
    target: meta.primaryActionTarget,
  };
}

export function getSettingsStatusSummaryLabel(
  view: CanonicalSettingsViewId,
  language: AppLanguage = 'zh-CN',
) {
  return getSettingsViewMeta(view, language).statusSummaryLabel;
}

export function getSettingsShellCopy(
  language: AppLanguage = 'zh-CN',
): SettingsShellCopy {
  return language === 'zh-CN' ? SHELL_COPY['zh-CN'] : SHELL_COPY['en-US'];
}

export function getSettingsSearchPlaceholder(
  view: CanonicalSettingsViewId,
  language: AppLanguage,
): string {
  if (view === 'api-management') {
    return pickByLanguage(language, '筛选 API、供应商或平台入口', 'Filter API, provider, or platform entries');
  }
  if (view === 'consumption-records') {
    return pickByLanguage(language, '筛选计费入口', 'Filter billing entries');
  }
  if (view === 'storage-settings') {
    return pickByLanguage(language, '筛选存储与清理入口', 'Filter storage and cleanup entries');
  }
  if (view === 'system-logs') {
    return pickByLanguage(language, '筛选日志入口或级别', 'Filter log entries or levels');
  }

  return pickByLanguage(language, '筛选设置导航', 'Filter settings navigation');
}

export function getSettingsNavItemByPath(
  path: string,
  language: AppLanguage = 'zh-CN',
): SettingsNavItem | undefined {
  const topLevelPath = path.replace(/^\/settings\/?/, '').split('/')[0] || '';
  const navItems = getSettingsNavItems(language);

  if (!topLevelPath) {
    return navItems.find((item) => item.id === 'dashboard');
  }

  if (topLevelPath === 'api-management') {
    return navItems.find((item) => item.id === 'api-management');
  }

  if (topLevelPath in LEGACY_SETTINGS_VIEW_ALIASES) {
    return navItems.find((item) => item.id === LEGACY_SETTINGS_VIEW_ALIASES[topLevelPath as LegacySettingsViewId]);
  }

  return navItems.find((item) => item.path === topLevelPath);
}

export function getSettingsNavItemById(
  id: SettingsViewId,
  language: AppLanguage = 'zh-CN',
): SettingsNavItem | undefined {
  return getSettingsNavItems(language).find((item) => item.id === resolveCanonicalSettingsViewId(id));
}
