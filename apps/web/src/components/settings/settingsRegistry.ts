import type { ComponentType } from 'react';
import {
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Layers3,
  Palette,
  ScrollText,
  Globe,
  Wand2,
} from 'lucide-react';

import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { type AppLanguage, pickByLanguage } from '../../context/LocaleContext';

export type CanonicalSettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs'
  | 'user-profile'
  | 'appearance-motion'
  | 'browser-assistant'
  | 'ai-management';

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
    mobileHomeDescription: '保留总览、供应商、计费和错误四个入口。',
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
    mobileHomeDescription: 'Keep Overview, Providers, Billing, and Errors on the phone home.',
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
  'user-profile': 'user-profile',
  'appearance-motion': 'appearance-motion',
  'browser-assistant': 'browser-assistant',
  'ai-management': 'ai-management',
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
    eyebrow: 'Provider Settings',
    titleZh: '供应商配置',
    titleEn: 'Provider Settings',
    descriptionZh: '管理您的本地 API、供应商通道和计费限额。',
    descriptionEn: 'Manage local APIs, provider channels, and billing limit policies.',
    primaryActionLabelZh: '配置本地 API',
    primaryActionLabelEn: 'Configure local API',
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: '通道状态',
    statusSummaryLabelEn: 'Channel status',
  },
  'ai-management': {
    eyebrow: 'AI Settings',
    titleZh: 'AI 管理',
    titleEn: 'AI Management',
    descriptionZh: '配置核心大模型能力预设，并扩展定制化的 AI 助手 Skill。',
    descriptionEn: 'Configure core LLM capability presets and extend custom AI assistant Skills.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Settings Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '配置状态',
    statusSummaryLabelEn: 'Configuration status',
  },
  'consumption-records': {
    eyebrow: 'Billing',
    titleZh: '计费账本',
    titleEn: 'Billing',
    descriptionZh: '查看充值、消耗和账本。',
    descriptionEn: 'Review recharges, spend, and ledger activity.',
    primaryActionLabelZh: '查看供应商配置',
    primaryActionLabelEn: 'Open Provider Settings',
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
    primaryActionLabelZh: '返回供应商配置',
    primaryActionLabelEn: 'Back to Provider Settings',
    primaryActionTarget: 'api-management',
    statusSummaryLabelZh: '日志状态',
    statusSummaryLabelEn: 'Log status',
  },
  'user-profile': {
    eyebrow: 'Profile',
    titleZh: '个人中心',
    titleEn: 'User Profile',
    descriptionZh: '查看和管理您的账户、积分资产及充值消费历史。',
    descriptionEn: 'View and manage your account, credits assets, recharges, and consumption histories.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Settings Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '账户状态',
    statusSummaryLabelEn: 'Account status',
  },
  'appearance-motion': {
    eyebrow: 'Appearance',
    titleZh: '外观与动态',
    titleEn: 'Appearance & Motion',
    descriptionZh: '统一调节毛玻璃透明度、模糊强度和动态强度。',
    descriptionEn: 'Tune glass transparency, blur, and motion intensity from one system surface.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Settings Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '界面系统',
    statusSummaryLabelEn: 'UI system',
  },
  'browser-assistant': {
    eyebrow: 'Browser Assistant',
    titleZh: '浏览器助手与多端控制',
    titleEn: 'Browser Assistant & Multi-device Control',
    descriptionZh: '管理本地浏览器守护进程、Chrome 插件连通状态及网页控制多端服务。',
    descriptionEn: 'Manage browser daemon, Chrome extension connectivity, and multi-device Web controls.',
    primaryActionLabelZh: '开始连通性测试',
    primaryActionLabelEn: 'Start connectivity doctor',
    primaryActionTarget: 'browser-assistant',
    statusSummaryLabelZh: '多端连接状态',
    statusSummaryLabelEn: 'Multi-device status',
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
    id: 'api-management',
    labelZh: '供应商配置',
    labelEn: 'Provider Settings',
    descriptionZh: '管理您的本地 API 通道与服务供应商。',
    descriptionEn: 'Filter API, provider, or platform entries.',
    icon: KeyRound,
    section: 'workspace',
    path: SETTINGS_PATHS['api-management'],
  },
  {
    id: 'ai-management',
    labelZh: 'AI 管理',
    labelEn: 'AI Management',
    descriptionZh: '能力预设、Skill 管理。',
    descriptionEn: 'Capability presets, Skill management.',
    icon: Wand2,
    section: 'workspace',
    path: SETTINGS_PATHS['ai-management'],
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
  {
    id: 'appearance-motion',
    labelZh: '外观与动态',
    labelEn: 'Appearance & Motion',
    descriptionZh: '透明、模糊、动态。',
    descriptionEn: 'Glass, blur, motion.',
    icon: Palette,
    section: 'system',
    path: SETTINGS_PATHS['appearance-motion'],
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
    id: 'browser-assistant',
    labelZh: '浏览器助手',
    labelEn: 'Browser Assistant',
    descriptionZh: '多端控制、插件下载、网页价格抓取。',
    descriptionEn: 'Multi-device, extension, price extraction.',
    icon: Globe,
    section: 'system',
    path: SETTINGS_PATHS['browser-assistant'],
  },
];

void Layers3;

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
  if (currentPath.startsWith('ai-management')) return 'ai-management';
  if (currentPath.startsWith('appearance-motion')) return 'appearance-motion';
  if (currentPath.startsWith('user-profile')) return 'user-profile';
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

export function getSettingsPrimaryActionMeta(view: CanonicalSettingsViewId, language: AppLanguage = 'zh-CN') {
  const meta = getSettingsViewMeta(view, language);
  return {
    label: meta.primaryActionLabel,
    target: meta.primaryActionTarget,
  };
}

export function getSettingsStatusSummaryLabel(view: CanonicalSettingsViewId, language: AppLanguage = 'zh-CN') {
  return getSettingsViewMeta(view, language).statusSummaryLabel;
}

export function getSettingsShellCopy(language: AppLanguage = 'zh-CN'): SettingsShellCopy {
  return SHELL_COPY[language];
}

export function getSettingsSearchPlaceholder(
  view: CanonicalSettingsViewId,
  language: AppLanguage = 'zh-CN',
): string {
  void view;
  return pickByLanguage(language, '筛选设置导航', 'Filter settings navigation');
}
