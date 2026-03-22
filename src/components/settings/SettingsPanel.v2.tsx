import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Coins,
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
import { SettingsBadge } from './SettingsScaffold';
import { SettingsSkeletonDashboard, SettingsSkeletonNav } from './views/SettingsSkeleton';

const DashboardView = lazy(() => import('./views/DashboardView'));
const ApiSettingsView = lazy(() => import('./ApiSettingsView'));
const CostEstimation = lazy(() => import('../../pages/CostEstimation'));
const StorageSettingsView = lazy(() => import('./views/StorageSettingsView'));
const SystemLogsView = lazy(() => import('./views/SystemLogsView'));
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

const navSections: Array<{ id: NavSectionId; label: string }> = [
  { id: 'workspace', label: '工作台' },
  { id: 'system', label: '系统维护' },
  { id: 'admin', label: '后台管理' },
];

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: '总览',
    description: '查看核心指标、运行健康度和最近活动。',
    icon: LayoutDashboard,
    section: 'workspace',
    path: '',
  },
  {
    id: 'api-management',
    label: 'API 管理',
    description: '统一管理官方接口、供应商和预算策略。',
    icon: KeyRound,
    section: 'workspace',
    path: 'api-management',
  },
  {
    id: 'consumption-records',
    label: '计费中心',
    description: '查看充值、账单、汇率和积分分发。',
    icon: Coins,
    section: 'workspace',
    path: 'consumption-records',
  },
  {
    id: 'storage-settings',
    label: '存储中心',
    description: '管理实例存储、缓存占用和资源整理。',
    icon: HardDrive,
    section: 'system',
    path: 'storage-settings',
  },
  {
    id: 'system-logs',
    label: '运行日志',
    description: '查看日志级别、来源筛选和系统风险。',
    icon: ScrollText,
    section: 'system',
    path: 'system-logs',
  },
  {
    id: 'admin-console',
    label: '管理后台',
    description: '处理积分模型、汇率规则和高权限配置。',
    icon: Shield,
    section: 'admin',
    path: 'admin-console',
  },
];

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

const buildSettingsPath = (view: CanonicalSettingsViewId) => {
  const match = navItems.find((item) => item.id === view);
  return match?.path ? `/settings/${match.path}` : '/settings';
};

const buildSupplierEditorPath = (supplierId?: string | null) =>
  supplierId
    ? `/settings/api-management/provider/${encodeURIComponent(supplierId)}`
    : '/settings/api-management/provider/new';

const getCurrentViewId = (pathname: string): CanonicalSettingsViewId => {
  const currentPath = pathname.replace(/^\/settings\/?/, '');
  if (currentPath.startsWith('api-management')) {
    return 'api-management';
  }
  if (currentPath === 'credit-models' || currentPath === 'exchange-rates' || currentPath === 'admin-system') {
    return 'admin-console';
  }
  if (currentPath === 'cost-estimation') {
    return 'consumption-records';
  }
  return navItems.find((item) => item.path === currentPath)?.id || 'dashboard';
};

const getSearchPlaceholder = (view: CanonicalSettingsViewId) => {
  if (view === 'api-management') return '搜索供应商、端点或分组';
  if (view === 'consumption-records') return '搜索账单、充值记录或汇率';
  if (view === 'storage-settings') return '搜索资源、日志或实例';
  if (view === 'system-logs') return '搜索日志来源、关键字或级别';
  if (view === 'admin-console') return '搜索模型、汇率或后台操作';
  return '搜索接口、日志、账单或供应商';
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
  const compact = source.replace(/\s+/g, '');
  return compact.slice(0, 2).toUpperCase() || 'KK';
};

const ViewFallback: React.FC = () => (
  <div className="flex min-h-[320px] items-center justify-center p-4">
    <SettingsSkeletonDashboard />
  </div>
);

const SettingsNavList: React.FC<{
  sections: Array<{ id: NavSectionId; label: string }>;
  items: NavItem[];
  activeView: CanonicalSettingsViewId;
  navQuery: string;
  onQueryChange: (value: string) => void;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  compact?: boolean;
}> = ({ sections, items, activeView, navQuery, onQueryChange, onNavigate, compact = false }) => {
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
          value={navQuery}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索设置项"
          aria-label="搜索设置项"
        />
      </label>

      <div className={`settings-shell-nav__list ${compact ? 'settings-shell-nav__list--compact' : ''}`.trim()}>
        <Suspense fallback={<SettingsSkeletonNav />}>
          {groupedNavItems.length === 0 ? (
            <div className="settings-shell-empty">没有匹配的设置项，请换个关键词再试。</div>
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
  accountMeta: string;
}> = ({ items, sections, activeView, navQuery, onNavigate, accountName, accountMeta }) => {
  const filteredItems = useMemo(
    () => filterNavItems(items, sections, navQuery),
    [items, navQuery, sections]
  );
  const initials = useMemo(() => getAccountInitials(accountName), [accountName]);

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-r px-4 py-4"
      style={{
        borderColor: 'var(--settings-sidebar-border)',
        background: 'var(--settings-sidebar-bg)',
        boxShadow: 'var(--settings-sidebar-shadow)',
        backdropFilter: 'blur(24px) saturate(140%)',
      }}
    >
      <div className="mb-8 px-4 py-2">
        <h1 className="text-lg font-bold tracking-[-0.04em]" style={{ color: 'var(--text-primary)' }}>
          高级设置
        </h1>
        <p className="mt-1 text-xs font-light" style={{ color: 'var(--text-secondary)' }}>
          专业的控制台
        </p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
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
            没有找到匹配页面，请换个关键词再试。
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

      <div
        className="mt-4 rounded-[24px] p-3"
        style={{
          border: '1px solid var(--settings-border-subtle)',
          background:
            'linear-gradient(180deg, rgb(255 255 255 / 0.03) 0%, transparent 100%), var(--settings-surface-overlay)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.02)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border text-[11px] font-bold"
            style={{
              borderColor: 'var(--settings-avatar-border)',
              background: 'var(--settings-avatar-bg)',
              color: 'var(--settings-avatar-text)',
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {accountName}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-tertiary)' }}>
              {accountMeta}
            </div>
          </div>
        </div>
      </div>
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
  accountMeta: string;
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
  accountMeta,
  refreshKey,
}) => {
  const searchPlaceholder = getSearchPlaceholder(activeView);
  const accountInitials = getAccountInitials(accountName);
  const toolbarButtonStyle: React.CSSProperties = {
    border: '1px solid var(--settings-button-secondary-border)',
    background: 'var(--settings-button-secondary-bg)',
    color: 'var(--text-secondary)',
  };

  return (
    <div
      className="settings-shell-desktop overflow-hidden"
      style={{
        width: 'min(1480px, calc(100vw - 48px))',
        height: 'min(920px, calc(100vh - 48px))',
        gap: 0,
        borderRadius: 32,
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
        accountMeta={accountMeta}
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
            padding: '16px 32px',
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
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                borderColor: 'var(--settings-status-border)',
                background: 'var(--settings-status-bg)',
                color: 'var(--settings-status-text)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
              <span className="text-[10px] font-medium tracking-[0.18em] text-emerald-300">系统运行中</span>
            </div>
            <button
              type="button"
              onClick={onRefreshCurrentView}
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-zinc-50"
              style={toolbarButtonStyle}
              aria-label="刷新当前页面"
              title="刷新当前页面"
            >
              <RefreshCw size={17} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('system-logs')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-zinc-50"
              style={toolbarButtonStyle}
              aria-label="查看运行日志"
              title="查看运行日志"
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
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-semibold"
              style={{
                borderColor: 'var(--settings-avatar-border)',
                background: 'var(--settings-avatar-bg)',
                color: 'var(--settings-avatar-text)',
              }}
            >
              {accountInitials}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/[0.06] hover:text-zinc-50"
              style={toolbarButtonStyle}
              aria-label="关闭设置"
              title="关闭设置"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        <main className="settings-shell-page settings-shell-page--desktop" style={{ padding: '32px' }}>
          <div key={`${activeView}:${refreshKey}`}>
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                <Route path="/settings" element={<DashboardView onNavigate={(view) => onNavigate(resolveViewId(view as SettingsViewId))} />} />
                <Route path="/settings/api-management" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/official/new" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/official/:officialId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/provider/new" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route path="/settings/api-management/provider/:providerId" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
                <Route
                  path="/settings/api-management/:supplierId"
                  element={<ApiSettingsView initialSupplier={initialSupplier} />}
                />
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
  const activeNavItem = items.find((item) => item.id === activeView) || items[0];
  const activeSection = sections.find((section) => section.id === activeNavItem.section)?.label || '工作台';

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
            aria-label={showNav ? '关闭设置' : '返回设置导航'}
          >
            {showNav ? <X size={18} /> : <ArrowLeft size={18} />}
          </button>

          <div className="settings-shell-mobile__title-wrap">
            <div className="settings-shell-kicker">{showNav ? '高级设置' : activeSection}</div>
            <div className="settings-shell-mobile__title">{showNav ? '高级设置' : activeNavItem.label}</div>
            <div className="settings-shell-mobile__description">
              {showNav ? '先选择一个设置项，再进入对应页面。' : activeNavItem.description}
            </div>
          </div>
        </div>

        {!showNav ? (
          <button type="button" onClick={onClose} className="apple-icon-button h-11 w-11 shrink-0 rounded-2xl" aria-label="关闭设置">
            <X size={18} />
          </button>
        ) : null}
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
              <Route
                path="/settings/api-management/:supplierId"
                element={<ApiSettingsView initialSupplier={initialSupplier} />}
              />
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
  const { authLoading, checkingAdmin, isAdmin, user } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = getCurrentViewId(location.pathname);
  const [navQuery, setNavQuery] = useState('');
  const [showNav, setShowNav] = useState(resolveViewId(initialView) === 'dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const canAccessAdmin = !authLoading && !checkingAdmin && isAdmin;
  const visibleNavItems = useMemo(
    () => (canAccessAdmin ? navItems : navItems.filter((item) => !ADMIN_VIEW_IDS.includes(item.id))),
    [canAccessAdmin]
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
    [visibleNavItems]
  );
  const accountName = user?.email || user?.phone || (canAccessAdmin ? '运维管理员' : '当前账户');
  const accountMeta = canAccessAdmin ? '管理员权限' : '专业版套餐';

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
      accountMeta={accountMeta}
      refreshKey={refreshKey}
    />
  );
};

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: SettingsViewId;
  initialSupplier?: Supplier | null;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
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
