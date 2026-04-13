import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ChevronRight,
  Coins,
  Globe2,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  RefreshCw,
  ScrollText,
  Search,
  X,
} from 'lucide-react';
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Supplier } from '../../services/billing/supplierService';
import { useAdminRole } from '../../hooks/useAdminRole';
import { SettingsSkeletonDashboard, SettingsSkeletonNav } from './views/SettingsSkeleton';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import { type AppLanguage, pickByLanguage, useLocale } from '../../context/LocaleContext';
import SettingsDesktopSidebar from './desktop/SettingsDesktopSidebar';
import SettingsDesktopWorkbenchHeader, { DESKTOP_SETTINGS_VIEW_META } from './desktop/SettingsDesktopWorkbenchHeader';
import {
  deriveApiManagementListStateFromPath,
  isApiManagementEditorRoute,
} from './apiManagementRouteState';

const DashboardView = lazy(() => import('./views/DashboardView.localized.tsx'));
const ApiSettingsView = lazy(() => import('./ApiSettingsView'));
const CostEstimation = lazy(() => import('../../pages/CostEstimation'));
const StorageSettingsView = lazy(() => import('./views/StorageSettingsView.localized.tsx'));
const SystemLogsView = lazy(() => import('./views/SystemLogsView.localized.tsx'));

type CanonicalSettingsViewId =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs';

type LegacySettingsViewId =
  | 'admin-console'
  | 'credit-models'
  | 'exchange-rates'
  | 'admin-system'
  | 'cost-estimation';

export type SettingsViewId = CanonicalSettingsViewId | LegacySettingsViewId;

type NavSectionId = 'workspace' | 'system';

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
};

const LEGACY_SETTINGS_VIEW_ALIASES: Record<LegacySettingsViewId, CanonicalSettingsViewId> = {
  'admin-console': 'api-management',
  'admin-system': 'api-management',
  'credit-models': 'api-management',
  'exchange-rates': 'api-management',
  'cost-estimation': 'consumption-records',
};

const LEGACY_SETTINGS_ROUTE_REDIRECTS: Array<{ path: string; target: CanonicalSettingsViewId }> = [
  { path: '/settings/cost-estimation', target: 'consumption-records' },
  { path: '/settings/credit-models', target: 'api-management' },
  { path: '/settings/exchange-rates', target: 'api-management' },
  { path: '/settings/admin-console', target: 'api-management' },
  { path: '/settings/admin-system/*', target: 'api-management' },
];

const resolveViewId = (view?: SettingsViewId): CanonicalSettingsViewId => {
  if (!view) return 'dashboard';
  return LEGACY_SETTINGS_VIEW_ALIASES[view as LegacySettingsViewId] ?? view;
};

const buildSettingsPath = (view: CanonicalSettingsViewId) =>
  NAV_PATHS[view] ? `/settings/${NAV_PATHS[view]}` : '/settings';

const buildSupplierEditorPath = (supplierId?: string | null) =>
  supplierId
    ? `/settings/api-management/provider/${encodeURIComponent(supplierId)}`
    : '/settings/api-management/provider/new';

const getCurrentViewId = (pathname: string): CanonicalSettingsViewId => {
  const currentPath = pathname.replace(/^\/settings\/?/, '');
  const topLevelPath = currentPath.split('/')[0] as SettingsViewId | undefined;

  if (!currentPath) return 'dashboard';
  if (currentPath.startsWith('api-management')) return 'api-management';
  if (topLevelPath && topLevelPath in LEGACY_SETTINGS_VIEW_ALIASES) {
    return LEGACY_SETTINGS_VIEW_ALIASES[topLevelPath as LegacySettingsViewId];
  }
  return (Object.entries(NAV_PATHS).find(([, path]) => path === currentPath)?.[0] as CanonicalSettingsViewId | undefined) || 'dashboard';
};

const getNavSections = (language: AppLanguage): Array<{ id: NavSectionId; label: string }> => [
  { id: 'workspace', label: pickByLanguage(language, '工作台', 'Workspace') },
  { id: 'system', label: pickByLanguage(language, '系统维护', 'System') },
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
    label: pickByLanguage(language, '消耗账单', 'Billing Ledger'),
    description: pickByLanguage(language, '查看积分消耗、充值和账单明细。', 'Review credit spending, recharges, and billing statements.'),
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
    label: pickByLanguage(language, '系统错误日志', 'System Error Logs'),
    description: pickByLanguage(language, '排查运行异常、错误和警告', 'Inspect runtime errors, warnings, and troubleshooting details.'),
    icon: ScrollText,
    section: 'system',
    path: NAV_PATHS['system-logs'],
  },
];

const getSearchPlaceholder = (view: CanonicalSettingsViewId, language: AppLanguage) => {
  if (view === 'api-management') return pickByLanguage(language, '搜索供应商、端点或分组', 'Search providers, endpoints, or groups');
  if (view === 'consumption-records') return pickByLanguage(language, '搜索账单、充值记录或汇率', 'Search invoices, recharges, or exchange rates');
  if (view === 'storage-settings') return pickByLanguage(language, '搜索资源、日志或存储实例', 'Search assets, logs, or storage targets');
  if (view === 'system-logs') return pickByLanguage(language, '搜索日志来源、关键词或级别', 'Search log sources, keywords, or levels');
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

  const groupedNavItems = useMemo(() => {
    if (compact) {
      return filteredNavItems.length > 0
        ? [{ id: 'mobile-focus', label: '', items: filteredNavItems }]
        : [];
    }

    return sections
      .map((section) => ({
        ...section,
        items: filteredNavItems.filter((item) => item.section === section.id),
      }))
      .filter((section) => section.items.length > 0);
  }, [compact, filteredNavItems, sections]);

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
                {!compact ? <div className="settings-shell-nav__group-label">{section.label}</div> : null}
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
  onQueryChange: (value: string) => void;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  accountName: string;
  accountAvatarUrl?: string;
  accountMeta: string;
  accountClickable: boolean;
  onAccountClick: () => void;
}> = ({ items, sections, activeView, navQuery, onQueryChange, onNavigate, accountName, accountAvatarUrl, accountMeta, accountClickable, onAccountClick }) => {
  const { pick, language } = useLocale();
  const filteredItems = useMemo(
    () => filterNavItems(items, sections, navQuery),
    [items, navQuery, sections]
  );
  const initials = useMemo(() => getAccountInitials(accountName), [accountName]);
  const accountBlock = (
    <button
      type="button"
      onClick={onAccountClick}
      disabled={!accountClickable}
      className="w-full rounded-[18px] border px-3.5 py-3 text-left"
      style={{
        borderColor: 'var(--settings-border-subtle)',
        background: 'var(--settings-surface-overlay)',
        cursor: accountClickable ? 'pointer' : 'default',
        opacity: accountClickable ? 1 : 0.92,
      }}
      aria-label={accountClickable ? pick('进入管理后台', 'Open admin console') : pick('当前账号没有管理员权限', 'Current account is not an admin')}
      title={accountClickable ? pick('进入管理后台', 'Open admin console') : pick('当前账号没有管理员权限', 'Current account is not an admin')}
    >
      <div className="flex items-center gap-3">
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
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
            {accountMeta}
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <SettingsDesktopSidebar
      items={filteredItems}
      activeView={activeView}
      navQuery={navQuery}
      searchPlaceholder={getSearchPlaceholder(activeView, language)}
      onQueryChange={onQueryChange}
      onNavigate={(view) => onNavigate(view as CanonicalSettingsViewId)}
      title={pick('设置工作台', 'Settings Workbench')}
      description={pick('统一进入接口、账单、存储和日志等桌面管理入口。', 'A calmer desktop workbench for APIs, billing, storage, and logs.')}
      emptyLabel={pick('没有找到匹配页面，请调整搜索关键词。', 'No pages matched the current search.')}
      accountBlock={accountBlock}
    />
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
  onAccountClick,
  refreshKey,
}) => {
  const { pick } = useLocale();
  const headerMeta = DESKTOP_SETTINGS_VIEW_META[activeView];

  return (
    <div
      className="settings-shell-desktop overflow-hidden"
      style={{
        width: 'min(1440px, calc(100vw - 48px))',
        height: 'min(880px, calc(100vh - 48px))',
        gap: 0,
        borderRadius: 28,
        border: '1px solid var(--settings-shell-border)',
        background: 'var(--settings-shell-bg)',
        boxShadow: 'var(--settings-shell-shadow)',
        backdropFilter: 'blur(18px) saturate(120%)',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <SettingsSidebarRail
        items={items}
        sections={sections}
        activeView={activeView}
        navQuery={navQuery}
        onQueryChange={onQueryChange}
        onNavigate={onNavigate}
        accountName={accountName}
        accountAvatarUrl={accountAvatarUrl}
        accountMeta={accountMeta}
        accountClickable
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
        <SettingsDesktopWorkbenchHeader
          meta={headerMeta}
          activeView={activeView}
          languageControl={<SettingsLanguageToggle />}
          onRefreshCurrentView={onRefreshCurrentView}
          onOpenLogs={() => onNavigate('system-logs')}
          onClose={onClose}
        />

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
                <Route path="/settings/storage-settings" element={<StorageSettingsView />} />
                <Route path="/settings/system-logs" element={<SystemLogsView />} />
                {LEGACY_SETTINGS_ROUTE_REDIRECTS.map(({ path, target }) => (
                  <Route key={path} path={path} element={<Navigate to={buildSettingsPath(target)} replace />} />
                ))}
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
  onBackToApiManagement: () => void;
  onClose: () => void;
  initialSupplier: Supplier | null;
  showNav: boolean;
  setShowNav: (value: boolean) => void;
  isApiManagementEditorRoute: boolean;
}> = ({
  sections,
  items,
  activeView,
  navQuery,
  onQueryChange,
  onNavigate,
  onBackToApiManagement,
  onClose,
  initialSupplier,
  showNav,
  setShowNav,
  isApiManagementEditorRoute,
}) => {
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

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    onNavigate(view);
    setShowNav(false);
  };

  const handleLeadingAction = () => {
    if (showNav) {
      onClose();
      return;
    }

    if (isApiManagementEditorRoute) {
      onBackToApiManagement();
      return;
    }

    setShowNav(true);
  };

  const mobileSettingsKicker = showNav ? pick('手机设置', 'Mobile Settings') : pick('当前入口', 'Current Entry');
  const mobileSettingsHeading = showNav ? pick('5 项手机入口', 'Five Mobile Entries') : activeNavItem.label;
  const mobileSettingsDescription = showNav
    ? pick(
        '保留总览、API 管理、消耗账单、存储中心和系统错误日志 5 个入口。',
        'Only the focused mobile entries are kept here: Dashboard, API Management, Billing Ledger, Storage, and System Error Logs.'
      )
    : activeNavItem.description;

  return (
    <div className="settings-shell-mobile" onClick={(event) => event.stopPropagation()}>
      <div className="settings-shell-mobile__topbar">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={handleLeadingAction}
            className="apple-icon-button h-11 w-11 shrink-0 rounded-2xl"
            aria-label={showNav ? pick('关闭设置', 'Close settings') : pick('返回设置导航', 'Back to settings navigation')}
          >
            {showNav ? <X size={18} /> : <ArrowLeft size={18} />}
          </button>

          <div className="settings-shell-mobile__title-wrap">
            <div className="settings-shell-kicker">{mobileSettingsKicker}</div>
            <div className="settings-shell-mobile__title">{mobileSettingsHeading}</div>
            <div className="settings-shell-mobile__description">
              {mobileSettingsDescription}
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
          <div className="space-y-3">
            <div
              className="settings-shell-mobile__focus rounded-[24px] border px-4 py-3"
              style={{
                borderColor: 'var(--settings-button-secondary-border)',
                background: 'var(--settings-button-secondary-bg)',
              }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                {pick('5 项手机入口', 'Five Mobile Entries')}
              </div>
              <div className="mt-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Dashboard / API / Billing / Storage / Errors
              </div>
            </div>
            <SettingsNavList
              sections={sections}
              items={items}
              activeView={activeView}
              navQuery={navQuery}
              onQueryChange={onQueryChange}
              onNavigate={handleNavigate}
              compact
            />
          </div>
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
              <Route path="/settings/storage-settings" element={<StorageSettingsView />} />
              <Route path="/settings/system-logs" element={<SystemLogsView />} />
              {LEGACY_SETTINGS_ROUTE_REDIRECTS.map(({ path, target }) => (
                <Route key={path} path={path} element={<Navigate to={buildSettingsPath(target)} replace />} />
              ))}
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
  const nestedApiEditorRoute = isApiManagementEditorRoute(location.pathname);
  const nestedApiListState = useMemo(
    () => deriveApiManagementListStateFromPath(location.pathname),
    [location.pathname],
  );
  const navItems = useMemo(() => getNavItems(language), [language]);
  const navSections = useMemo(() => getNavSections(language), [language]);
  const visibleNavItems = navItems;
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

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    navigate(buildSettingsPath(view));
  };

  const handleAccountClick = () => {
    if (!canAccessAdmin) return;
    navigate(buildSettingsPath('api-management'));
  };

  const handleRefreshCurrentView = () => {
    setRefreshKey((current) => current + 1);
  };

  const handleBackToApiManagement = () => {
    navigate('/settings/api-management', {
      state: nestedApiListState || undefined,
    });
    setShowNav(false);
  };

  return isMobile ? (
    <SettingsMobileShell
      sections={visibleNavSections}
      items={visibleNavItems}
      activeView={activeView}
      navQuery={navQuery}
      onQueryChange={setNavQuery}
      onNavigate={handleNavigate}
      onBackToApiManagement={handleBackToApiManagement}
      onClose={onClose}
      initialSupplier={initialSupplier}
      showNav={showNav}
      setShowNav={setShowNav}
      isApiManagementEditorRoute={nestedApiEditorRoute}
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
  const safeInitialView = resolvedInitialView;
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
