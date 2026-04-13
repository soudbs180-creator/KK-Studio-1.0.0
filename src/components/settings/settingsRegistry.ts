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
  title: string;
  description: string;
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

const zh = {
  workspace: '工作台',
  system: '系统',
  workbenchTitle: '设置',
  workbenchDescription: '集中管理 API 路由、账单与运行状态。',
  emptySearchLabel: '没有匹配的设置项。',
  mobileHomeKicker: '手机设置',
  mobileHomeTitle: '4 项手机入口',
  mobileHomeDescription: '只保留总览、API 设置、消耗账单和系统错误日志这 4 个入口。',
  mobileUsageLabel: '消耗账单',
  mobileErrorsLabel: '系统错误日志',
  mobileErrorsDescription: '排查运行异常、错误和警告。',
  currentEntryKicker: '当前入口',
  closeSettingsLabel: '关闭设置',
  backToHomeLabel: '返回手机设置首页',
  dashboardTitle: '设置工作台',
  dashboardDescription: '先看全局状态、当前风险和下一步最重要的动作，再进入具体配置页。',
  dashboardPrimaryAction: '打开 API 管理',
  dashboardStatusSummary: '当前状态',
  apiTitle: 'API 与模型路由',
  apiDescription: '集中管理官方接口、供应商、连通性和预算策略。',
  apiPrimaryAction: '新增官方接口',
  apiStatusSummary: '路由状态',
  billingTitle: '计费与账单',
  billingDescription: '查看消耗、充值和余额变化，快速定位成本波动。',
  billingPrimaryAction: '查看 API 管理',
  billingStatusSummary: '账单状态',
  storageTitle: '存储与缓存',
  storageDescription: '管理缓存容量、存储模式和资源清理策略。',
  storagePrimaryAction: '检查存储模式',
  storageStatusSummary: '存储状态',
  logsTitle: '系统日志',
  logsDescription: '集中查看错误、告警和故障来源，快速进入诊断。',
  logsPrimaryAction: '返回 API 管理',
  logsStatusSummary: '日志状态',
  dashboardLabel: '总览',
  dashboardNavDescription: '查看核心指标、运行状态和最近活动。',
  apiLabel: 'API 管理',
  apiNavDescription: '统一管理官方接口、供应商和预算策略。',
  billingLabel: '消耗账单',
  billingNavDescription: '查看积分消耗、充值和账单明细。',
  storageLabel: '存储中心',
  storageNavDescription: '管理存储模式、缓存压力和资源清理。',
  logsLabel: '系统错误日志',
  logsNavDescription: '排查运行异常、错误和警告。',
  searchApi: '搜索供应商、端点或分组',
  searchBilling: '搜索账单、充值记录或汇率',
  searchStorage: '搜索资源、日志或存储实例',
  searchLogs: '搜索日志来源、关键词或级别',
  searchDefault: '搜索接口、日志、账单或供应商',
} as const;

const en = {
  workspace: 'Workspace',
  system: 'System',
  workbenchTitle: 'Settings',
  workbenchDescription: 'Manage API routes, billing, and runtime status in one place.',
  emptySearchLabel: 'No settings matched the current search.',
  mobileHomeKicker: 'Mobile Settings',
  mobileHomeTitle: 'Four Mobile Entries',
  mobileHomeDescription: 'Only Dashboard, API, Billing, and System Error Logs stay on the phone-first home.',
  mobileUsageLabel: 'Billing Ledger',
  mobileErrorsLabel: 'System Error Logs',
  mobileErrorsDescription: 'Inspect runtime errors, warnings, and troubleshooting details.',
  currentEntryKicker: 'Current Entry',
  closeSettingsLabel: 'Close settings',
  backToHomeLabel: 'Back to mobile settings home',
  dashboardTitle: 'Settings Workbench',
  dashboardDescription: 'See the overall state, current risk, and the most important next action before opening a detailed page.',
  dashboardPrimaryAction: 'Open API Management',
  dashboardStatusSummary: 'Current status',
  apiTitle: 'API and Model Routing',
  apiDescription: 'Manage official endpoints, providers, connectivity, and budget rules in one place.',
  apiPrimaryAction: 'Create official endpoint',
  apiStatusSummary: 'Route status',
  billingTitle: 'Billing and Ledger',
  billingDescription: 'Review spend, recharges, and balance changes to quickly locate cost movement.',
  billingPrimaryAction: 'Open API Management',
  billingStatusSummary: 'Billing status',
  storageTitle: 'Storage and Cache',
  storageDescription: 'Manage cache capacity, storage mode, and cleanup rules.',
  storagePrimaryAction: 'Review storage mode',
  storageStatusSummary: 'Storage status',
  logsTitle: 'System Logs',
  logsDescription: 'Inspect errors, warnings, and failure sources in one place.',
  logsPrimaryAction: 'Back to API Management',
  logsStatusSummary: 'Log status',
  dashboardLabel: 'Dashboard',
  dashboardNavDescription: 'Check key metrics, runtime health, and recent activity.',
  apiLabel: 'API Management',
  apiNavDescription: 'Manage official endpoints, providers, and budget rules in one place.',
  billingLabel: 'Billing Ledger',
  billingNavDescription: 'Review credit spending, recharges, and billing statements.',
  storageLabel: 'Storage',
  storageNavDescription: 'Manage storage targets, cache pressure, and cleanup actions.',
  logsLabel: 'System Error Logs',
  logsNavDescription: 'Inspect runtime errors, warnings, and troubleshooting details.',
  searchApi: 'Search providers, endpoints, or groups',
  searchBilling: 'Search invoices, recharges, or exchange rates',
  searchStorage: 'Search assets, logs, or storage targets',
  searchLogs: 'Search log sources, keywords, or levels',
  searchDefault: 'Search APIs, logs, bills, or providers',
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
    title: zh.dashboardTitle,
    description: zh.dashboardDescription,
    primaryActionLabelZh: zh.dashboardPrimaryAction,
    primaryActionLabelEn: en.dashboardPrimaryAction,
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: zh.dashboardStatusSummary,
    statusSummaryLabelEn: en.dashboardStatusSummary,
  },
  'api-management': {
    eyebrow: 'API Routes',
    title: zh.apiTitle,
    description: zh.apiDescription,
    primaryActionLabelZh: zh.apiPrimaryAction,
    primaryActionLabelEn: en.apiPrimaryAction,
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: zh.apiStatusSummary,
    statusSummaryLabelEn: en.apiStatusSummary,
  },
  'consumption-records': {
    eyebrow: 'Billing',
    title: zh.billingTitle,
    description: zh.billingDescription,
    primaryActionLabelZh: zh.billingPrimaryAction,
    primaryActionLabelEn: en.billingPrimaryAction,
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: zh.billingStatusSummary,
    statusSummaryLabelEn: en.billingStatusSummary,
  },
  'storage-settings': {
    eyebrow: 'Storage',
    title: zh.storageTitle,
    description: zh.storageDescription,
    primaryActionLabelZh: zh.storagePrimaryAction,
    primaryActionLabelEn: en.storagePrimaryAction,
    primaryActionTarget: 'storage-settings',
    statusSummaryLabelZh: zh.storageStatusSummary,
    statusSummaryLabelEn: en.storageStatusSummary,
  },
  'system-logs': {
    eyebrow: 'Logs',
    title: zh.logsTitle,
    description: zh.logsDescription,
    primaryActionLabelZh: zh.logsPrimaryAction,
    primaryActionLabelEn: en.logsPrimaryAction,
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: zh.logsStatusSummary,
    statusSummaryLabelEn: en.logsStatusSummary,
  },
};

export const SETTINGS_SHELL_COPY = {
  zh: {
    workbenchTitle: zh.workbenchTitle,
    workbenchDescription: zh.workbenchDescription,
    emptySearchLabel: zh.emptySearchLabel,
    mobileHomeKicker: zh.mobileHomeKicker,
    mobileHomeTitle: zh.mobileHomeTitle,
    mobileHomeDescription: zh.mobileHomeDescription,
    mobileUsageLabel: zh.mobileUsageLabel,
    mobileErrorsLabel: zh.mobileErrorsLabel,
    mobileErrorsDescription: zh.mobileErrorsDescription,
    currentEntryKicker: zh.currentEntryKicker,
    closeSettingsLabel: zh.closeSettingsLabel,
    backToHomeLabel: zh.backToHomeLabel,
  },
  en: {
    workbenchTitle: en.workbenchTitle,
    workbenchDescription: en.workbenchDescription,
    emptySearchLabel: en.emptySearchLabel,
    mobileHomeKicker: en.mobileHomeKicker,
    mobileHomeTitle: en.mobileHomeTitle,
    mobileHomeDescription: en.mobileHomeDescription,
    mobileUsageLabel: en.mobileUsageLabel,
    mobileErrorsLabel: en.mobileErrorsLabel,
    mobileErrorsDescription: en.mobileErrorsDescription,
    currentEntryKicker: en.currentEntryKicker,
    closeSettingsLabel: en.closeSettingsLabel,
    backToHomeLabel: en.backToHomeLabel,
  },
} as const;

export const SETTINGS_NAV_ITEM_DEFINITIONS: SettingsNavItemDefinition[] = [
  {
    id: 'dashboard',
    labelZh: '总览',
    labelEn: 'Dashboard',
    descriptionZh: '查看核心指标、运行状态和最近活动。',
    descriptionEn: 'Check key metrics, runtime health, and recent activity.',
    icon: LayoutDashboard,
    section: 'workspace',
    path: SETTINGS_PATHS.dashboard,
  },
  {
    id: 'api-management',
    labelZh: 'API 管理',
    labelEn: 'API Management',
    descriptionZh: '统一管理官方接口、供应商和预算策略。',
    descriptionEn: 'Manage official endpoints, providers, and budget rules in one place.',
    icon: KeyRound,
    section: 'workspace',
    path: SETTINGS_PATHS['api-management'],
  },
  {
    id: 'consumption-records',
    labelZh: '消耗账单',
    labelEn: 'Billing Ledger',
    descriptionZh: '查看积分消耗、充值和账单明细。',
    descriptionEn: 'Review credit spending, recharges, and billing statements.',
    icon: Coins,
    section: 'workspace',
    path: SETTINGS_PATHS['consumption-records'],
    featureFlag: 'billing',
  },
  {
    id: 'storage-settings',
    labelZh: '存储中心',
    labelEn: 'Storage',
    descriptionZh: '管理存储模式、缓存压力和资源清理。',
    descriptionEn: 'Manage storage targets, cache pressure, and cleanup actions.',
    icon: HardDrive,
    section: 'system',
    path: SETTINGS_PATHS['storage-settings'],
  },
  {
    id: 'system-logs',
    labelZh: '系统错误日志',
    labelEn: 'System Error Logs',
    descriptionZh: '排查运行异常、错误和警告。',
    descriptionEn: 'Inspect runtime errors, warnings, and troubleshooting details.',
    icon: ScrollText,
    section: 'system',
    path: SETTINGS_PATHS['system-logs'],
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
    { id: 'workspace', label: pickByLanguage(language, zh.workspace, en.workspace) },
    { id: 'system', label: pickByLanguage(language, zh.system, en.system) },
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
    title: pickByLanguage(language, meta.title, SETTINGS_VIEW_META[view].title),
    description: pickByLanguage(language, meta.description, SETTINGS_VIEW_META[view].description),
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
  return language === 'zh-CN' ? SETTINGS_SHELL_COPY.zh : SETTINGS_SHELL_COPY.en;
}

export function getSettingsSearchPlaceholder(
  view: CanonicalSettingsViewId,
  language: AppLanguage,
): string {
  if (view === 'api-management') return pickByLanguage(language, zh.searchApi, en.searchApi);
  if (view === 'consumption-records') return pickByLanguage(language, zh.searchBilling, en.searchBilling);
  if (view === 'storage-settings') return pickByLanguage(language, zh.searchStorage, en.searchStorage);
  if (view === 'system-logs') return pickByLanguage(language, zh.searchLogs, en.searchLogs);
  return pickByLanguage(language, zh.searchDefault, en.searchDefault);
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
