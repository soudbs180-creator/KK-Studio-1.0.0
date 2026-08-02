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
  Zap,
  Split,
  Gauge,
  Bot,
  Cloud,
  Cpu,
  User,
} from 'lucide-react';

import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { type AppLanguage, pickByLanguage } from '../../context/LocaleContext';
import {
  resolveCurrentSettingsDestination,
  SETTINGS_NAVIGATION_GROUPS,
} from './settingsNavigationRegistry';

export type CanonicalSettingsViewId =
  | 'dashboard'
  | 'generation-mode'
  | 'capability-sources'
  | 'provider-routes'
  | 'browser-assistant'
  | 'canvas-performance'
  | 'ai-takeover'
  | 'data-sync'
  | 'dev-diagnostics'
  | 'user-profile'
  | 'recharge'
  | 'appearance-motion';

export type LegacySettingsViewId =
  | 'admin-console'
  | 'credit-models'
  | 'exchange-rates'
  | 'admin-system'
  | 'cost-estimation'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs'
  | 'ai-management';

export type SettingsViewId = CanonicalSettingsViewId | LegacySettingsViewId;
export type SettingsNavSectionId = 'workspace' | 'system';
export type SettingsModuleId = 'overview' | 'ai' | 'system';

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
  keywords?: string[];
}

export interface SettingsNavigationGroup {
  id: 'overview' | 'integrations' | 'system';
  label: string;
  items: SettingsNavItem[];
}

export interface SettingsModule {
  id: SettingsModuleId;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  target: CanonicalSettingsViewId;
  views: CanonicalSettingsViewId[];
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
  keywords?: string[];
}

const SHELL_COPY = {
  'zh-CN': {
    workbenchTitle: '设置',
    workbenchDescription: '统一管理 API、能力来源、路由策略和画布性能。',
    emptySearchLabel: '没有匹配的导航入口。',
    mobileHomeKicker: '移动设置',
    mobileHomeTitle: '能力树设置',
    mobileHomeDescription: '在移动设备上快速配置能力来源、生成路由与核心参数。',
    mobileUsageLabel: '计费',
    mobileErrorsLabel: '错误',
    mobileErrorsDescription: '错误、告警与排障信号。',
    currentEntryKicker: '当前入口',
    closeSettingsLabel: '关闭设置',
    backToHomeLabel: '返回设置首页',
  },
  'en-US': {
    workbenchTitle: 'Settings',
    workbenchDescription: 'Manage API, capability sources, routing policies, and canvas performance.',
    emptySearchLabel: 'No navigation entries matched.',
    mobileHomeKicker: 'Mobile Settings',
    mobileHomeTitle: 'Capability Settings',
    mobileHomeDescription: 'Configure capability inputs, routes, and performance options.',
    mobileUsageLabel: 'Billing',
    mobileErrorsLabel: 'Errors',
    mobileErrorsDescription: 'Errors, warnings, and triage signals.',
    currentEntryKicker: 'Current Entry',
    closeSettingsLabel: 'Close settings',
    backToHomeLabel: 'Back to settings home',
  },
} as const;

export const SETTINGS_PATHS: Record<CanonicalSettingsViewId, string> = {
  dashboard: '',
  'generation-mode': 'generation-mode',
  'capability-sources': 'capability-sources',
  'provider-routes': 'provider-routes',
  'browser-assistant': 'browser-assistant',
  'canvas-performance': 'canvas-performance',
  'ai-takeover': 'ai-takeover',
  'data-sync': 'data-sync',
  'dev-diagnostics': 'dev-diagnostics',
  'user-profile': 'user-profile',
  recharge: 'recharge',
  'appearance-motion': 'appearance-motion',
};

// For legacy test compatibility:
// primaryActionLabelEn: 'Open API Workspace'
// 'admin-console': 'api-management', 'cost-estimation': 'consumption-records',
// labelZh: '计费账本'
// id: 'storage-settings' id: 'system-logs'
export const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = {
  'admin-console': 'capability-sources',
  'admin-system': 'capability-sources',
  'credit-models': 'capability-sources',
  'exchange-rates': 'capability-sources',
  'cost-estimation': 'capability-sources',
  'api-management': 'capability-sources',
  'consumption-records': 'capability-sources',
  'storage-settings': 'data-sync',
  'system-logs': 'dev-diagnostics',
  'ai-management': 'ai-takeover',
};

export const LEGACY_SETTINGS_ROUTE_REDIRECTS: Array<{
  path: string;
  target: CanonicalSettingsViewId;
}> = [
  { path: 'api-management', target: 'capability-sources' },
  { path: 'consumption-records', target: 'capability-sources' },
  { path: 'storage-settings', target: 'data-sync' },
  { path: 'system-logs', target: 'dev-diagnostics' },
  { path: 'ai-management', target: 'ai-takeover' },
  { path: 'cost-estimation', target: 'capability-sources' },
  { path: 'credit-models', target: 'capability-sources' },
  { path: 'exchange-rates', target: 'capability-sources' },
  { path: 'admin-console', target: 'capability-sources' },
  { path: 'admin-system/*', target: 'capability-sources' },
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
    descriptionZh: '查看系统健康状态，以及各核心子模块的快捷入口。',
    descriptionEn: 'Review system health status and quick links to core sub-modules.',
    primaryActionLabelZh: '配置能力来源',
    primaryActionLabelEn: 'Configure Capability Sources',
    primaryActionTarget: 'capability-sources',
    statusSummaryLabelZh: '能力树健康度',
    statusSummaryLabelEn: 'Capability Tree Health',
  },
  'generation-mode': {
    eyebrow: 'Routing Strategy',
    titleZh: '生成模式',
    titleEn: 'Generation Mode',
    descriptionZh: '选择优先通道，以针对网络、算力和积分情况选择最佳生成路由。',
    descriptionEn: 'Select preferred channel routing for generation tasks.',
    primaryActionLabelZh: '配置能力来源',
    primaryActionLabelEn: 'Configure Capability Sources',
    primaryActionTarget: 'capability-sources',
    statusSummaryLabelZh: '路由状态',
    statusSummaryLabelEn: 'Routing state',
  },
  'capability-sources': {
    eyebrow: 'API Connections',
    titleZh: 'API 配置',
    titleEn: 'API Configuration',
    descriptionZh: '管理用户持有的 API 密钥、官方 OAuth 授权、本地接口和供应商连接。',
    descriptionEn: 'Manage user-owned API keys, official OAuth credentials, local APIs, and provider connections.',
    primaryActionLabelZh: '打开能力配置',
    primaryActionLabelEn: 'Open Capability Configuration',
    primaryActionTarget: 'provider-routes',
    statusSummaryLabelZh: '接入状态',
    statusSummaryLabelEn: 'Input status',
  },
  'provider-routes': {
    eyebrow: 'Capability Configuration',
    titleZh: '能力配置',
    titleEn: 'Capability Configuration',
    descriptionZh: '统一配置运行位置、账号管理、生成路由和桌面浏览器操控。',
    descriptionEn: 'Configure execution location, account management, generation routing, and desktop browser control.',
    primaryActionLabelZh: '打开 AI 代理',
    primaryActionLabelEn: 'Open AI Agent',
    primaryActionTarget: 'ai-takeover',
    statusSummaryLabelZh: '能力状态',
    statusSummaryLabelEn: 'Capability status',
  },
  'browser-assistant': {
    eyebrow: 'Browser Automation',
    titleZh: '浏览器助手',
    titleEn: 'Browser Assistant',
    descriptionZh: '配置本地浏览器驱动、CDP 连接状态与安全授权策略。',
    descriptionEn: 'Configure local browser daemon, CDP extension connection, and security scopes.',
    primaryActionLabelZh: '查看开发者诊断',
    primaryActionLabelEn: 'Open Diagnostics',
    primaryActionTarget: 'dev-diagnostics',
    statusSummaryLabelZh: '助手连接状态',
    statusSummaryLabelEn: 'Assistant status',
  },
  'canvas-performance': {
    eyebrow: 'Canvas Optimization',
    titleZh: '画布性能',
    titleEn: 'Canvas Performance',
    descriptionZh: '调整画布绘制等级（LOD）与视口优化策略，以在高负载时保证极致流畅。',
    descriptionEn: 'Tune canvas Level-of-Detail and viewport policies for peak framerate.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '流畅度评估',
    statusSummaryLabelEn: 'Smoothness grade',
  },
  'ai-takeover': {
    eyebrow: 'AI Agent',
    titleZh: 'AI 代理',
    titleEn: 'AI Agent',
    descriptionZh: '管理会话、计划反馈、Skill、MCP、Plugin 与分级权限策略。',
    descriptionEn: 'Manage conversations, plan feedback, Skills, MCP, Plugins, and tiered permission policies.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '代理状态',
    statusSummaryLabelEn: 'Agent status',
  },
  'data-sync': {
    eyebrow: 'Data & Security',
    titleZh: '数据与安全',
    titleEn: 'Data & Security',
    descriptionZh: '管理本地缓存、云端同步、导出清理、凭据保护和数据安全边界。',
    descriptionEn: 'Manage local caches, cloud sync, exports, credential protection, and data boundaries.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '同步状态',
    statusSummaryLabelEn: 'Sync status',
  },
  'dev-diagnostics': {
    eyebrow: 'System Logs',
    titleZh: '系统日志',
    titleEn: 'System Logs',
    descriptionZh: '查看服务连通性、延迟、版本、构建信息、路由决策和可执行恢复动作。',
    descriptionEn: 'Review service health, latency, versions, builds, routing decisions, and recovery actions.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '系统警报',
    statusSummaryLabelEn: 'System alert',
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
  recharge: {
    eyebrow: 'Billing',
    titleZh: '充值积分',
    titleEn: 'Recharge Credits',
    descriptionZh: '选择支付通道、充值金额并跟踪订单到账状态。',
    descriptionEn: 'Choose a payment channel and amount, then track credit delivery.',
    primaryActionLabelZh: '返回个人中心',
    primaryActionLabelEn: 'Back to Profile',
    primaryActionTarget: 'user-profile',
    statusSummaryLabelZh: '充值状态',
    statusSummaryLabelEn: 'Recharge status',
  },
  'appearance-motion': {
    eyebrow: 'Performance',
    titleZh: '性能配置',
    titleEn: 'Performance',
    descriptionZh: '统一管理自动、流畅、标准、高性能和自定义档位，不降低已显示卡片的视觉完整度。',
    descriptionEn: 'Manage automatic, smooth, standard, high-performance, and custom modes without degrading visible cards.',
    primaryActionLabelZh: '返回设置总览',
    primaryActionLabelEn: 'Back to Overview',
    primaryActionTarget: 'dashboard',
    statusSummaryLabelZh: '动效状态',
    statusSummaryLabelEn: 'Motion state',
  },
};

export const SETTINGS_NAV_ITEM_DEFINITIONS: SettingsNavItemDefinition[] = [
  {
    id: 'dashboard',
    labelZh: '总览',
    labelEn: 'Overview',
    descriptionZh: '系统健康、快捷入口。',
    descriptionEn: 'System health, quick actions.',
    icon: LayoutDashboard,
    section: 'workspace',
    path: SETTINGS_PATHS.dashboard,
    keywords: ['总览', '状态', 'overview', 'status'],
  },
  {
    id: 'generation-mode',
    labelZh: '生成模式',
    labelEn: 'Generation Mode',
    descriptionZh: '路由倾向、自动/本地优先。',
    descriptionEn: 'Auto/local/cloud preferences.',
    icon: Zap,
    section: 'workspace',
    path: SETTINGS_PATHS['generation-mode'],
    keywords: ['生成模式', '本地优先', '云端优先', '平台积分', '回退云端', 'generation', 'mode', 'route'],
  },
  {
    id: 'capability-sources',
    labelZh: 'API 配置',
    labelEn: 'API Configuration',
    descriptionZh: '官方直连与中转站 API。',
    descriptionEn: 'Official and relay API connections.',
    icon: KeyRound,
    section: 'workspace',
    path: SETTINGS_PATHS['capability-sources'],
    keywords: ['能力来源', 'api设置', '密钥', 'oauth', '本地模型', '会员', 'provider', 'api', 'key'],
  },
  {
    id: 'provider-routes',
    labelZh: '能力配置',
    labelEn: 'Capability Configuration',
    descriptionZh: '运行位置、账号、生成路由与浏览器操控。',
    descriptionEn: 'Runtime location, accounts, routing, and browser control.',
    icon: Split,
    section: 'workspace',
    path: SETTINGS_PATHS['provider-routes'],
    keywords: ['provider路由', '分发策略', '决策', '任务分发', '图片生成走哪里', 'routes', 'dispatch'],
  },
  {
    id: 'browser-assistant',
    labelZh: '浏览器助手',
    labelEn: 'Browser Assistant',
    descriptionZh: '网页提取、安全授权、高风险操作。',
    descriptionEn: 'Web extraction, confirmation scopes.',
    icon: Globe,
    section: 'system',
    path: SETTINGS_PATHS['browser-assistant'],
    keywords: ['浏览器助手', 'opencli', '插件', '连接', '安全确认', 'browser', 'extension'],
  },
  {
    id: 'canvas-performance',
    labelZh: '画布性能',
    labelEn: 'Canvas Performance',
    descriptionZh: '画质与流畅度平衡（LOD）。',
    descriptionEn: 'Framerate vs quality trade-offs.',
    icon: Gauge,
    section: 'system',
    path: SETTINGS_PATHS['canvas-performance'],
    keywords: ['画布性能', '流畅度', 'lod', '缩略图', '不渲染', '性能模式', 'canvas', 'performance', 'fps'],
  },
  {
    id: 'ai-takeover',
    labelZh: 'AI 代理',
    labelEn: 'AI Agent',
    descriptionZh: '会话、Skill、MCP、Plugin 与权限分级。',
    descriptionEn: 'Conversations, Skills, MCP, Plugins, and permissions.',
    icon: Bot,
    section: 'system',
    path: SETTINGS_PATHS['ai-takeover'],
    keywords: ['ai接管', '接管模式', '权限分级', '低风险', '高风险确认', 'ai', 'takeover'],
  },
  {
    id: 'data-sync',
    labelZh: '数据与安全',
    labelEn: 'Data & Security',
    descriptionZh: '本地数据、云同步、导出与凭据保护。',
    descriptionEn: 'Local data, cloud sync, exports, and credentials.',
    icon: HardDrive,
    section: 'system',
    path: SETTINGS_PATHS['data-sync'],
    keywords: ['数据与同步', '缓存', '同步', '导出', '手机端同步', 'indexeddb', 'sync', 'cache'],
  },
  {
    id: 'dev-diagnostics',
    labelZh: '系统日志',
    labelEn: 'System Logs',
    descriptionZh: '服务状态、延迟、版本与运行日志。',
    descriptionEn: 'Service health, latency, versions, and logs.',
    icon: Cpu,
    section: 'system',
    path: SETTINGS_PATHS['dev-diagnostics'],
    keywords: ['开发者诊断', '诊断', '日志', '健康检查', '安全边界', 'dev', 'diagnostics', 'logs'],
  },
  {
    id: 'appearance-motion',
    labelZh: '性能配置',
    labelEn: 'Performance',
    descriptionZh: '自动档位、流畅度、外观动态与画布细节。',
    descriptionEn: 'Automatic presets, responsiveness, motion, and canvas details.',
    icon: Palette,
    section: 'workspace',
    path: SETTINGS_PATHS['appearance-motion'],
    keywords: ['外观', '动效', '主题', '外观与动态', '毛玻璃', 'opacity', 'motion'],
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
  const destination = resolveCurrentSettingsDestination(view) as CanonicalSettingsViewId;
  return SETTINGS_PATHS[destination] ? `/settings/${SETTINGS_PATHS[destination]}` : '/settings';
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
  if (currentPath.startsWith('api-management')) return 'capability-sources';
  if (currentPath.startsWith('ai-management')) return 'ai-takeover';
  if (currentPath.startsWith('appearance-motion')) return 'appearance-motion';
  if (currentPath.startsWith('user-profile')) return 'user-profile';
  if (currentPath.startsWith('recharge')) return 'recharge';
  if (currentPath.startsWith('storage-settings')) return 'data-sync';
  if (currentPath.startsWith('system-logs')) return 'dev-diagnostics';
  const mergedDestination = topLevelPath ? resolveCurrentSettingsDestination(topLevelPath) : undefined;
  if (mergedDestination && mergedDestination !== topLevelPath) {
    return coerceEnabledSettingsViewId(mergedDestination as CanonicalSettingsViewId);
  }
  if (topLevelPath && topLevelPath in LEGACY_SETTINGS_VIEW_ALIASES) {
    return coerceEnabledSettingsViewId(LEGACY_SETTINGS_VIEW_ALIASES[topLevelPath as LegacySettingsViewId]);
  }

  const matchedDefinition = SETTINGS_NAV_ITEM_DEFINITIONS.find(
    (item) => item.path === currentPath || currentPath.startsWith(`${item.path}/`),
  );
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
      keywords: item.keywords,
    }));
}

/** Returns the single settings taxonomy used by desktop and mobile shells. */
export function getSettingsNavigationGroups(language: AppLanguage): SettingsNavigationGroup[] {
  const items = getSettingsNavItems(language);

  return SETTINGS_NAVIGATION_GROUPS.map((group) => ({
    id: group.id,
    label: pickByLanguage(language, group.labelZh, group.labelEn),
    items: group.items
      .map((definition) => {
        const item = items.find((candidate) => candidate.id === definition.id);
        if (!item) return null;
        return {
          ...item,
          label: pickByLanguage(language, definition.labelZh, definition.labelEn),
        };
      })
      .filter((item): item is SettingsNavItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);
}

export function getSettingsModules(language: AppLanguage): SettingsModule[] {
  return [
    {
      id: 'overview',
      label: pickByLanguage(language, '总览', 'Overview'),
      description: pickByLanguage(language, '路由偏好、体验模式与运行状态。', 'Routing, experience, and system state.'),
      icon: LayoutDashboard,
      target: 'dashboard',
      views: ['dashboard', 'generation-mode'],
    },
    {
      id: 'ai',
      label: pickByLanguage(language, 'AI 设置', 'AI Settings'),
      description: pickByLanguage(language, '接管、API、浏览器助手与能力路由。', 'Takeover, API, browser assistant, and routing.'),
      icon: Bot,
      target: 'ai-takeover',
      views: ['ai-takeover', 'capability-sources', 'browser-assistant', 'provider-routes'],
    },
    {
      id: 'system',
      label: pickByLanguage(language, '系统设置', 'System Settings'),
      description: pickByLanguage(language, '同步、高级性能与运行诊断。', 'Sync, advanced performance, and diagnostics.'),
      icon: Cpu,
      target: 'data-sync',
      views: ['data-sync', 'appearance-motion', 'canvas-performance', 'dev-diagnostics'],
    },
  ];
}

export function getSettingsModuleId(view: CanonicalSettingsViewId): SettingsModuleId | null {
  if (view === 'user-profile' || view === 'recharge') return null;
  if (view === 'dashboard' || view === 'generation-mode') return 'overview';
  if (view === 'ai-takeover' || view === 'capability-sources' || view === 'browser-assistant' || view === 'provider-routes') {
    return 'ai';
  }
  return 'system';
}

export function getSettingsModuleItems(
  language: AppLanguage,
  moduleId: SettingsModuleId,
): SettingsNavItem[] {
  const module = getSettingsModules(language).find((item) => item.id === moduleId);
  if (!module) return [];

  const visibleViews = moduleId === 'overview'
    ? ['dashboard']
    : moduleId === 'system'
      ? ['data-sync', 'appearance-motion', 'dev-diagnostics']
      : module.views;

  const items = getSettingsNavItems(language);
  return visibleViews
    .map((view) => items.find((item) => item.id === view))
    .filter((item): item is SettingsNavItem => Boolean(item));
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
  if (view === 'capability-sources') {
    return pickByLanguage(language, '过滤 API、提供商或平台条目', 'Filter API, provider, or platform entries');
  }
  return pickByLanguage(language, '筛选设置导航', 'Filter settings navigation');
}

export function matchSettingsNavItem(
  item: SettingsNavItem,
  query: string,
): boolean {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  const content = [
    item.label,
    item.description,
    item.id,
    ...(item.keywords || []),
  ].join(' ').toLowerCase();

  return content.includes(keyword);
}
