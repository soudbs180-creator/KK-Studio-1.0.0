import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Coins,
  Globe2,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Supplier } from '../../services/billing/supplierService';
import { useAdminRole } from '../../hooks/useAdminRole';
import { SettingsSkeletonDashboard, SettingsSkeletonNav } from './views/SettingsSkeleton';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import { type AppLanguage, pickByLanguage, useLocale } from '../../context/LocaleContext';

const DashboardView = lazy(() => import('./views/DashboardView.localized.tsx'));
const ApiSettingsView = lazy(() => import('./ApiSettingsView'));
const CostEstimation = lazy(() => import('../../pages/CostEstimation'));
const StorageSettingsView = lazy(() => import('./views/StorageSettingsView.localized.tsx'));
const SystemLogsView = lazy(() => import('./views/SystemLogsView.localized.tsx'));
const AdminSystem = lazy(() => import('./AdminSystem'));

export type SettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs'
  | 'admin-console'
  | 'credit-models'
  | 'exchange-rates'
  | 'admin-system'
  | 'cost-estimation';

type CanonicalSettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs'
  | 'admin-console';

type NavSectionId = 'workspace' | 'system' | 'admin';

type NavItem = {
  id: CanonicalSettingsViewId;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section: NavSectionId;
  path: string;
};

const NAV_PATHS: Record<CanonicalSettingsViewId, string> = {
  dashboard: '',
  'api-management': 'api-management',
  'consumption-records': 'consumption-records',
  'storage-settings': 'storage-settings',
  'system-logs': 'system-logs',
  'admin-console': 'admin-console',
};

const viewAliases: Record<Exclude<SettingsViewId, CanonicalSettingsViewId>, CanonicalSettingsViewId> = {
  'admin-system': 'admin-console',
  'credit-models': 'admin-console',
  'exchange-rates': 'admin-console',
  'cost-estimation': 'consumption-records',
};

const ADMIN_VIEW_IDS: CanonicalSettingsViewId[] = ['admin-console'];

const resolveViewId = (view?: SettingsViewId): CanonicalSettingsViewId => {
  if (!view) return 'dashboard';
  return (viewAliases[view as keyof typeof viewAliases] || view) as CanonicalSettingsViewId;
};

const buildSettingsPath = (view: CanonicalSettingsViewId) =>
  NAV_PATHS[view] ? `/settings/${NAV_PATHS[view]}` : '/settings';

const buildSupplierEditorPath = (supplierId?: string | null) =>
  supplierId
    ? `/settings/api-management/provider/${encodeURIComponent(supplierId)}`
    : '/settings/api-management/provider/new';

const getCurrentViewId = (pathname: string): CanonicalSettingsViewId => {
  const currentPath = pathname.replace(/^\/settings\/?/, '');
  if (currentPath.startsWith('api-management')) return 'api-management';
  if (currentPath === 'credit-models' || currentPath === 'exchange-rates' || currentPath === 'admin-system') return 'admin-console';
  if (currentPath === 'cost-estimation') return 'consumption-records';
  return (Object.entries(NAV_PATHS).find(([, path]) => path === currentPath)?.[0] as CanonicalSettingsViewId | undefined) || 'dashboard';
};

const getNavSections = (language: AppLanguage): Array<{ id: NavSectionId; label: string }> => [
  { id: 'workspace', label: pickByLanguage(language, '工作台', 'Workspace') },
  { id: 'system', label: pickByLanguage(language, '系统维护', 'System') },
  { id: 'admin', label: pickByLanguage(language, '后台管理', 'Admin') },
];

const getNavItems = (language: AppLanguage): NavItem[] => [
  {
    id: 'dashboard',
    label: pickByLanguage(language, '总览', 'Dashboard'),
    description: pickByLanguage(language, '查看核心指标、运行状态和最近活动。', 'Check key metrics, runtime health, and recent activity.'),
    icon: LayoutDashboard,
    section: 'workspace',
    path: NAV_PATHS.dashboard,
  },
  {
    id: 'api-management',
    label: pickByLanguage(language, 'API 管理', 'API Management'),
    description: pickByLanguage(language, '统一管理官方接口、供应商和预算策略。', 'Manage official endpoints, providers, and budget rules in one place.'),
    icon: KeyRound,
    section: 'workspace',
    path: NAV_PATHS['api-management'],
  },
  {
    id: 'consumption-records',
    label: pickByLanguage(language, '计费中心', 'Billing Center'),
    description: pickByLanguage(language, '查看充值、账单、汇率和积分分发。', 'Review recharges, bills, exchange rates, and credit distribution.'),
    icon: Coins,
    section: 'workspace',
    path: NAV_PATHS['consumption-records'],
  },
  {
    id: 'storage-settings',
    label: pickByLanguage(language, '存储中心', 'Storage'),
    description: pickByLanguage(language, '管理存储模式、缓存压力和资源整理。', 'Manage storage targets, cache pressure, and cleanup actions.'),
    icon: HardDrive,
    section: 'system',
    path: NAV_PATHS['storage-settings'],
  },
  {
    id: 'system-logs',
    label: pickByLanguage(language, '运行日志', 'System Logs'),
    description: pickByLanguage(language, '查看日志级别、来源筛选和系统风险。', 'Inspect log levels, sources, and runtime alerts.'),
    icon: ScrollText,
    section: 'system',
    path: NAV_PATHS['system-logs'],
  },
  {
    id: 'admin-console',
    label: pickByLanguage(language, '管理后台', 'Admin Console'),
    description: pickByLanguage(language, '处理模型、汇率和高权限管理操作。', 'Handle models, exchange rates, and privileged admin actions.'),
    icon: Shield,
    section: 'admin',
    path: NAV_PATHS['admin-console'],
  },
];

const getSearchPlaceholder = (view: CanonicalSettingsViewId, language: AppLanguage) => {
  if (view === 'api-management') return pickByLanguage(language, '搜索供应商、端点或分组', 'Search providers, endpoints, or groups');
  if (view === 'consumption-records') return pickByLanguage(language, '搜索账单、充值记录或汇率', 'Search invoices, recharges, or exchange rates');
  if (view === 'storage-settings') return pickByLanguage(language, '搜索资源、日志或存储实例', 'Search assets, logs, or storage targets');
  if (view === 'system-logs') return pickByLanguage(language, '搜索日志来源、关键词或级别', 'Search log sources, keywords, or levels');
  if (view === 'admin-console') return pickByLanguage(language, '搜索模型、汇率或后台操作', 'Search models, exchange rates, or admin actions');
  return pickByLanguage(language, '搜索接口、日志、账单或供应商', 'Search APIs, logs, bills, or providers');
};

const filterNavItems = (
  items: NavItem[],
  sections: Array<{ id: NavSectionId; label: string }>,
  navQuery: string
) => {
  const keyword = navQuery.trim().toLowerCase();
  if (!keyword) return items;

  return items.filter((item) => {
    const sectionLabel = sections.find((section) => section.id === item.section)?.label || '';
    return `${item.label} ${item.description} ${sectionLabel}`.toLowerCase().includes(keyword);
  });
};

const getAccountInitials = (accountName: string) => {
  const source = accountName.trim();
  if (!source) return 'KK';
  if (source.includes('@')) {
    const [local] = source.split('@');
    return local.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'KK';
  }
  return source.replace(/\s+/g, '').slice(0, 2).toUpperCase() || 'KK';
};

const getAccountAvatarUrl = (user: ReturnType<typeof useAdminRole>['user']) =>
  resolveAvatarUrl(user?.user_metadata?.avatar_url);

const ViewFallback: React.FC = () => (
  <div className="flex min-h-[320px] items-center justify-center p-4">
    <SettingsSkeletonDashboard />
  </div>
);

const SettingsLanguageToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage, pick } = useLocale();
  const buttonClassName = compact
    ? 'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium'
    : 'inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium';

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border p-1"
      style={{
        borderColor: 'var(--settings-button-secondary-border)',
        background: 'var(--settings-button-secondary-bg)',
      }}
      aria-label={pick('语言切换', 'Language switch')}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: 'var(--text-tertiary)' }}>
        <Globe2 size={compact ? 14 : 16} />
      </span>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setLanguage('zh-CN')}
        style={{
          background: language === 'zh-CN' ? 'var(--settings-nav-active-bg)' : 'transparent',
          color: language === 'zh-CN' ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >
        中文
      </button>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setLanguage('en-US')}
        style={{
          background: language === 'en-US' ? 'var(--settings-nav-active-bg)' : 'transparent',
          color: language === 'en-US' ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >
        EN
      </button>
    </div>
  );
};

const SettingsAccountAvatar: React.FC<{
  avatarUrl?: string;
  initials: string;
  sizeClassName: string;
  textClassName: string;
}> = ({ avatarUrl, initials, sizeClassName, textClassName }) => {
  const { pick } = useLocale();

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border ${sizeClassName} ${textClassName}`.trim()}
      style={{
        borderColor: 'var(--settings-avatar-border)',
        background: 'var(--settings-avatar-bg)',
        color: 'var(--settings-avatar-text)',
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={pick('头像', 'Avatar')} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
};

const SettingsNavList: React.FC<{
  sections: Array<{ id: NavSectionId; label: string }>;
  items: NavItem[];
  activeView: CanonicalSettingsViewId;
  navQuery: string;
  onQueryChange: (value: string) => void;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  compact?: boolean;
}> = ({ sections, items, activeView, navQuery, onQueryChange, onNavigate, compact = false }) => {
  const { pick } = useLocale();
  const filteredNavItems = useMemo(
    () => filterNavItems(items, sections, navQuery),
    [items, navQuery, sections]
  );

  const groupedNavItems = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: filteredNavItems.filter((item) => item.section === section.id),
        }))
        .filter((section) => section.items.length > 0),
    [filteredNavItems, sections]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <label className="settings-shell-nav__search">
        <Search size={15} />
        <input
          type="search"
          name="settings-navigation-search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="search"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          value={navQuery}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={pick('搜索设置项', 'Search settings')}
          aria-label={pick('搜索设置项', 'Search settings')}
        />
      </label>

      <div className={`settings-shell-nav__list ${compact ? 'settings-shell-nav__list--compact' : ''}`.trim()}>
        <Suspense fallback={<SettingsSkeletonNav />}>
          {groupedNavItems.length === 0 ? (
            <div className="settings-shell-empty">{pick('没有匹配的设置项，请换个关键词再试。', 'No settings matched the current search.')}</div>
          ) : (
            groupedNavItems.map((section) => (
              <div key={section.id} className="settings-shell-nav__group">
                <div className="settings-shell-nav__group-label">{section.label}</div>
                <div className="settings-shell-nav__group-list">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`settings-sidebar-item ${isActive ? 'active' : ''}`.trim()}
                        onClick={() => onNavigate(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="settings-sidebar-item__icon">
                          <Icon size={18} />
                        </span>
                        <span className="settings-sidebar-item__body">
                          <span className="settings-sidebar-item__label">{item.label}</span>
                          <span className="settings-sidebar-item__desc">{item.description}</span>
                        </span>
                        <ChevronRight size={15} className="settings-sidebar-item__arrow" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </Suspense>
      </div>
    </div>
  );
};

const SettingsSidebarRail: React.FC<{
  items: NavItem[];
  sections: Array<{ id: NavSectionId; label: string }>;
  activeView: CanonicalSettingsViewId;
  navQuery: string;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  accountName: string;
  accountAvatarUrl?: string;
  accountMeta: string;
  accountClickable: boolean;
  onAccountClick: () => void;
}> = ({ items, sections, activeView, navQuery, onNavigate, accountName, accountAvatarUrl, accountMeta, accountClickable, onAccountClick }) => {
  const { pick } = useLocale();
  const filteredItems = useMemo(
    () => filterNavItems(items, sections, navQuery),
    [items, navQuery, sections]
  );
  const initials = useMemo(() => getAccountInitials(accountName), [accountName]);

  return (
    <aside
      className="flex h-full w-[248px] shrink-0 flex-col border-r px-3 py-4"
      style={{
        borderColor: 'var(--settings-sidebar-border)',
        background: 'var(--settings-sidebar-bg)',
        boxShadow: 'var(--settings-sidebar-shadow)',
        backdropFilter: 'blur(24px) saturate(140%)',
      }}
    >
      <div
        className="mb-6 rounded-[28px] border px-4 py-4"
        style={{
          borderColor: 'var(--settings-border-subtle)',
          background:
            'radial-gradient(circle at top right, rgb(var(--settings-accent-rgb) / 0.14), transparent 42%), linear-gradient(180deg, rgb(255 255 255 / 0.04) 0%, transparent 100%), var(--settings-surface-overlay)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-tertiary)' }}>
          KK Studio
        </div>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.06em]" style={{ color: 'var(--text-primary)' }}>
          {pick('高级设置', 'Advanced Settings')}
        </h1>
        <p className="mt-2 max-w-[180px] text-[13px] leading-6" style={{ color: 'var(--text-secondary)' }}>
          {pick('统一查看链路、日志、存储和后台管理。', 'Unified control for routing, logs, storage, and admin tasks.')}
        </p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-1">
        {filteredItems.length === 0 ? (
          <div
            className="rounded-2xl px-4 py-3 text-xs leading-6"
            style={{
              border: '1px solid var(--settings-border-subtle)',
              background:
                'linear-gradient(180deg, rgb(255 255 255 / 0.025) 0%, transparent 100%), var(--settings-surface-overlay)',
              color: 'var(--text-secondary)',
            }}
          >
            {pick('没有找到匹配页面，请调整搜索关键词。', 'No pages matched the current search.')}
          </div>
        ) : (
          filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200 hover:-translate-y-px hover:bg-white/[0.04] hover:text-zinc-50"
                style={
                  isActive
                    ? {
                        color: 'var(--text-primary)',
                        border: '1px solid var(--settings-nav-active-border)',
                        background: 'var(--settings-nav-active-bg)',
                        boxShadow: '0 18px 32px rgb(var(--settings-accent-rgb) / 0.16)',
                      }
                    : {
                        color: 'var(--text-secondary)',
                        border: '1px solid transparent',
                      }
                }
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
                  style={
                    isActive
                      ? {
                          background: 'rgb(var(--settings-accent-rgb) / 0.14)',
                          color: 'rgb(var(--settings-accent-rgb))',
                        }
                      : {
                          background: 'var(--settings-surface-overlay)',
                          color: 'var(--text-tertiary)',
                        }
                  }
                >
                  <Icon size={17} />
                </span>
                <span className="text-sm font-semibold tracking-tight">{item.label}</span>
              </button>
            );
          })
        )}
      </nav>

      <button
        type="button"
        onClick={onAccountClick}
        disabled={!accountClickable}
        className="mt-4 rounded-[24px] p-3"
        style={{
          width: '100%',
          border: '1px solid var(--settings-border-subtle)',
          background:
            'linear-gradient(135deg, rgb(var(--settings-accent-rgb) / 0.14) 0%, transparent 65%), linear-gradient(180deg, rgb(255 255 255 / 0.03) 0%, transparent 100%), var(--settings-surface-overlay)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.02)',
          cursor: accountClickable ? 'pointer' : 'default',
          opacity: accountClickable ? 1 : 0.92,
        }}
        aria-label={accountClickable ? pick('进入管理后台', 'Open admin console') : pick('当前账号没有管理员权限', 'Current account is not an admin')}
        title={accountClickable ? pick('进入管理后台', 'Open admin console') : pick('当前账号没有管理员权限', 'Current account is not an admin')}
      >
        <div className="flex items-center gap-3 text-left">
          <SettingsAccountAvatar
            avatarUrl={accountAvatarUrl}
            initials={initials}
            sizeClassName="h-10 w-10"
            textClassName="text-[11px] font-bold"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {accountName}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-tertiary)' }}>
              {accountMeta}
            </div>
          </div>
          {accountClickable ? (
            <ChevronRight
              size={16}
              className="ml-auto shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </button>
    </aside>
  );
};

const SettingsDesktopShell: React.FC<{
  sections: Array<{ id: NavSectionId; label: string }>;
  items: NavItem[];
  activeView: CanonicalSettingsViewId;
  navQuery: string;
  onQueryChange: (value: string) => void;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  onRefreshCurrentView: () => void;
  onClose: () => void;
  initialSupplier: Supplier | null;
  accountName: string;
  accountAvatarUrl?: string;
  accountMeta: string;
  canAccessAdmin: boolean;
  onAccountClick: () => void;
  refreshKey: number;
}> = ({
  sections,
  items,
  activeView,
  navQuery,
  onQueryChange,
  onNavigate,
  onRefreshCurrentView,
  onClose,
  initialSupplier,
  accountName,
  accountAvatarUrl,
  accountMeta,
  canAccessAdmin,
  onAccountClick,
  refreshKey,
}) => {
  const { language, pick } = useLocale();
  const searchPlaceholder = getSearchPlaceholder(activeView, language);
  const toolbarButtonStyle: React.CSSProperties = {
    border: '1px solid var(--settings-button-secondary-border)',
    background: 'var(--settings-button-secondary-bg)',
    color: 'var(--text-secondary)',
    boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.03)',
  };

  return (
    <div
      className="settings-shell-desktop overflow-hidden"
      style={{
        width: 'min(1420px, calc(100vw - 40px))',
        height: 'min(860px, calc(100vh - 40px))',
        gap: 0,
        borderRadius: 36,
        border: '1px solid var(--settings-shell-border)',
        background: 'var(--settings-shell-bg)',
        boxShadow: 'var(--settings-shell-shadow)',
        backdropFilter: 'blur(28px) saturate(160%)',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <SettingsSidebarRail
        items={items}
        sections={sections}
        activeView={activeView}
        navQuery={navQuery}
        onNavigate={onNavigate}
        accountName={accountName}
        accountAvatarUrl={accountAvatarUrl}
        accountMeta={accountMeta}
        accountClickable={canAccessAdmin}
        onAccountClick={onAccountClick}
      />

      <section
        className="settings-shell-main"
        style={{
          borderRadius: 0,
          border: 'none',
          background: 'var(--settings-canvas-bg)',
        }}
      >
        <header
          className="settings-shell-main__topbar"
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            padding: '14px 28px',
            borderBottom: '1px solid var(--settings-sidebar-border)',
            background: 'var(--settings-shell-header-bg)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <label
              className="flex w-full max-w-[360px] items-center gap-3 rounded-full border px-4 py-2.5"
              style={{
                borderColor: 'var(--settings-search-border)',
                background: 'var(--settings-search-bg)',
                color: 'var(--text-tertiary)',
              }}
            >
              <Search size={15} />
              <input
                type="search"
                name="settings-toolbar-search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="search"
                enterKeyHint="search"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                value={navQuery}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-500"
                style={{ color: 'var(--text-primary)' }}
              />
            </label>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <SettingsLanguageToggle />
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                borderColor: 'var(--settings-status-border)',
                background: 'var(--settings-status-bg)',
                color: 'var(--settings-status-text)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
              <span className="text-[10px] font-medium tracking-[0.18em] text-emerald-300">
                {pick('系统运行中', 'System Active')}
              </span>
            </div>
            <button
              type="button"
              onClick={onRefreshCurrentView}
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-zinc-50"
              style={toolbarButtonStyle}
              aria-label={pick('刷新当前页面', 'Refresh current page')}
              title={pick('刷新当前页面', 'Refresh current page')}
            >
              <RefreshCw size={17} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('system-logs')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-zinc-50"
              style={toolbarButtonStyle}
              aria-label={pick('查看系统日志', 'Open system logs')}
              title={pick('查看系统日志', 'Open system logs')}
            >
              <Bell size={17} />
              {activeView !== 'system-logs' ? (
                <span
                  className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2"
                  style={{
                    borderColor: 'var(--settings-notification-dot-border)',
                    background: 'rgb(var(--settings-accent-rgb))',
                  }}
                />
              ) : null}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-zinc-50"
              style={toolbarButtonStyle}
              aria-label={pick('关闭设置', 'Close settings')}
              title={pick('关闭设置', 'Close settings')}
            >
              <X size={17} />
            </button>
          </div>
        </header>

        <main className="settings-shell-page settings-shell-page--desktop" style={{ padding: '28px' }}>
          <div key={`${activeView}:${refreshKey}`}>
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                <Route path="/settings" element={<DashboardView onNavigate={(view) => onNavigate(resolveViewId(view as SettingsViewId))} />} />
                <Route path="/settings/api-management" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/official/new" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/official/:officialId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/provider/new" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/provider/:providerId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/:supplierId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/consumption-records" element={<CostEstimation embedded />} />
                <Route path="/settings/cost-estimation" element={<Navigate to="/settings/consumption-records" replace />} />
                <Route path="/settings/storage-settings" element={<StorageSettingsView />} />
                <Route path="/settings/system-logs" element={<SystemLogsView />} />
                <Route path="/settings/credit-models" element={<AdminSystem initialTab="credit-models" />} />
                <Route path="/settings/exchange-rates" element={<AdminSystem initialTab="exchange-rates" />} />
                <Route path="/settings/admin-console" element={<AdminSystem initialTab="admin-console" />} />
                <Route path="/settings/admin-system/*" element={<Navigate to="/settings/admin-console" replace />} />
                <Route path="*" element={<Navigate to="/settings" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </section>
    </div>
  );
};

const SettingsMobileShell: React.FC<{
  sections: Array<{ id: NavSectionId; label: string }>;
  items: NavItem[];
  activeView: CanonicalSettingsViewId;
  navQuery: string;
  onQueryChange: (value: string) => void;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  onClose: () => void;
  initialSupplier: Supplier | null;
  showNav: boolean;
  setShowNav: (value: boolean) => void;
}> = ({ sections, items, activeView, navQuery, onQueryChange, onNavigate, onClose, initialSupplier, showNav, setShowNav }) => {
  const { pick } = useLocale();
  const fallbackNavItem: NavItem = {
    id: 'dashboard',
    label: pick('总览', 'Dashboard'),
    description: pick('查看核心指标、运行状态和最近活动。', 'Check key metrics, runtime health, and recent activity.'),
    icon: LayoutDashboard,
    section: 'workspace',
    path: NAV_PATHS.dashboard,
  };
  const activeNavItem = items.find((item) => item.id === activeView) || items[0] || fallbackNavItem;
  const activeSection = sections.find((section) => section.id === activeNavItem.section)?.label || pick('工作台', 'Workspace');

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    onNavigate(view);
    setShowNav(false);
  };

  return (
    <div className="settings-shell-mobile" onClick={(event) => event.stopPropagation()}>
      <div className="settings-shell-mobile__topbar">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={() => (showNav ? onClose() : setShowNav(true))}
            className="apple-icon-button h-11 w-11 shrink-0 rounded-2xl"
            aria-label={showNav ? pick('关闭设置', 'Close settings') : pick('返回设置导航', 'Back to settings navigation')}
          >
            {showNav ? <X size={18} /> : <ArrowLeft size={18} />}
          </button>

          <div className="settings-shell-mobile__title-wrap">
            <div className="settings-shell-kicker">{showNav ? pick('高级设置', 'Advanced Settings') : activeSection}</div>
            <div className="settings-shell-mobile__title">{showNav ? pick('高级设置', 'Advanced Settings') : activeNavItem.label}</div>
            <div className="settings-shell-mobile__description">
              {showNav ? pick('先选择一个设置项，再进入对应页面。', 'Choose a settings item first, then open its page.') : activeNavItem.description}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SettingsLanguageToggle compact />
          {!showNav ? (
            <button type="button" onClick={onClose} className="apple-icon-button h-11 w-11 shrink-0 rounded-2xl" aria-label={pick('关闭设置', 'Close settings')}>
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="settings-shell-page settings-shell-page--mobile">
        {showNav ? (
          <SettingsNavList
            sections={sections}
            items={items}
            activeView={activeView}
            navQuery={navQuery}
            onQueryChange={onQueryChange}
            onNavigate={handleNavigate}
            compact
          />
        ) : (
          <Suspense fallback={<ViewFallback />}>
            <Routes>
              <Route path="/settings" element={<DashboardView onNavigate={(view) => handleNavigate(resolveViewId(view as SettingsViewId))} />} />
              <Route path="/settings/api-management" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
              <Route path="/settings/api-management/official/new" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
              <Route path="/settings/api-management/official/:officialId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
              <Route path="/settings/api-management/provider/new" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
              <Route path="/settings/api-management/provider/:providerId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
              <Route path="/settings/api-management/:supplierId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
              <Route path="/settings/consumption-records" element={<CostEstimation embedded />} />
              <Route path="/settings/cost-estimation" element={<Navigate to="/settings/consumption-records" replace />} />
              <Route path="/settings/storage-settings" element={<StorageSettingsView />} />
              <Route path="/settings/system-logs" element={<SystemLogsView />} />
              <Route path="/settings/credit-models" element={<AdminSystem initialTab="credit-models" />} />
              <Route path="/settings/exchange-rates" element={<AdminSystem initialTab="exchange-rates" />} />
              <Route path="/settings/admin-console" element={<AdminSystem initialTab="admin-console" />} />
              <Route path="/settings/admin-system/*" element={<Navigate to="/settings/admin-console" replace />} />
              <Route path="*" element={<Navigate to="/settings" replace />} />
            </Routes>
          </Suspense>
        )}
      </div>
    </div>
  );
};

const SettingsRouterShell: React.FC<{
  initialSupplier: Supplier | null;
  onClose: () => void;
  initialView: SettingsViewId;
  isMobile: boolean;
}> = ({ initialSupplier, onClose, initialView, isMobile }) => {
  const { language, pick } = useLocale();
  const { authLoading, checkingAdmin, isAdmin, user } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = getCurrentViewId(location.pathname);
  const [navQuery, setNavQuery] = useState('');
  const [showNav, setShowNav] = useState(resolveViewId(initialView) === 'dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const canAccessAdmin = !authLoading && !checkingAdmin && isAdmin;
  const navItems = useMemo(() => getNavItems(language), [language]);
  const navSections = useMemo(() => getNavSections(language), [language]);
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !ADMIN_VIEW_IDS.includes(item.id)),
    [navItems]
  );
  const visibleNavSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: visibleNavItems.filter((item) => item.section === section.id),
        }))
        .filter((section) => section.items.length > 0)
        .map(({ id, label }) => ({ id, label })),
    [navSections, visibleNavItems]
  );
  const accountName = user?.email || user?.phone || (canAccessAdmin ? pick('运维管理员', 'Admin Operator') : pick('当前账户', 'Current Account'));
  const accountAvatarUrl = getAccountAvatarUrl(user);
  const accountMeta = canAccessAdmin ? pick('管理员', 'Administrator') : pick('普通账户', 'Standard Account');

  useEffect(() => {
    setShowNav(resolveViewId(initialView) === 'dashboard');
    setNavQuery('');
  }, [initialView]);

  useEffect(() => {
    if (authLoading || checkingAdmin || isAdmin) return;
    if (!ADMIN_VIEW_IDS.includes(activeView)) return;
    navigate('/settings', { replace: true });
  }, [activeView, authLoading, checkingAdmin, isAdmin, navigate]);

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    navigate(buildSettingsPath(view));
  };

  const handleAccountClick = () => {
    if (!canAccessAdmin) return;
    navigate(buildSettingsPath('admin-console'));
  };

  const handleRefreshCurrentView = () => {
    setRefreshKey((current) => current + 1);
  };

  return isMobile ? (
    <SettingsMobileShell
      sections={visibleNavSections}
      items={visibleNavItems}
      activeView={activeView}
      navQuery={navQuery}
      onQueryChange={setNavQuery}
      onNavigate={handleNavigate}
      onClose={onClose}
      initialSupplier={initialSupplier}
      showNav={showNav}
      setShowNav={setShowNav}
    />
  ) : (
    <SettingsDesktopShell
      sections={visibleNavSections}
      items={visibleNavItems}
      activeView={activeView}
      navQuery={navQuery}
      onQueryChange={setNavQuery}
      onNavigate={handleNavigate}
      onRefreshCurrentView={handleRefreshCurrentView}
      onClose={onClose}
      initialSupplier={initialSupplier}
      accountName={accountName}
      accountAvatarUrl={accountAvatarUrl}
      accountMeta={accountMeta}
      canAccessAdmin={canAccessAdmin}
      onAccountClick={handleAccountClick}
      refreshKey={refreshKey}
    />
  );
};

const SettingsPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialView?: SettingsViewId;
  initialSupplier?: Supplier | null;
}> = ({
  isOpen,
  onClose,
  initialView = 'dashboard',
  initialSupplier = null,
}) => {
  const { authLoading, checkingAdmin, isAdmin } = useAdminRole();
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const resolvedInitialView = resolveViewId(initialView);
  const canAccessAdmin = !authLoading && !checkingAdmin && isAdmin;
  const safeInitialView =
    !canAccessAdmin && ADMIN_VIEW_IDS.includes(resolvedInitialView) ? 'dashboard' : resolvedInitialView;
  const initialEntry =
    safeInitialView === 'api-management' && initialSupplier
      ? buildSupplierEditorPath(initialSupplier.id || initialSupplier.baseUrl)
      : buildSettingsPath(safeInitialView);

  const content = (
    <div
      className="settings-panel settings-shell-backdrop"
      style={{
        padding: isMobile ? 0 : 24,
        background: 'var(--settings-backdrop-bg)',
        backdropFilter: 'blur(18px)',
      }}
      onClick={onClose}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <SettingsRouterShell
          initialSupplier={initialSupplier}
          onClose={onClose}
          initialView={safeInitialView}
          isMobile={isMobile}
        />
      </MemoryRouter>
    </div>
  );

  return createPortal(content, document.body);
};

export default SettingsPanel;
