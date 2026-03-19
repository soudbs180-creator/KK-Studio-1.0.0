import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ChevronRight,
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
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
  { id: 'system', label: '系统' },
  { id: 'admin', label: '管理员' },
];

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: '仪表盘',
    description: '纯展示当前链路、消费、充值和待处理状态。',
    icon: LayoutDashboard,
    section: 'workspace',
    path: '',
  },
  {
    id: 'api-management',
    label: 'API 管理',
    description: '统一管理官方接口与第三方供应商。',
    icon: KeyRound,
    section: 'workspace',
    path: 'api-management',
  },
  {
    id: 'consumption-records',
    label: '消费记录',
    description: '查看消费、充值和账单明细。',
    icon: Coins,
    section: 'workspace',
    path: 'consumption-records',
  },
  {
    id: 'storage-settings',
    label: '储存设置',
    description: '管理本地与浏览器存储、清理缓存和项目整理。',
    icon: HardDrive,
    section: 'system',
    path: 'storage-settings',
  },
  {
    id: 'system-logs',
    label: '系统日志',
    description: '集中查看警告、错误与运行风险。',
    icon: ScrollText,
    section: 'system',
    path: 'system-logs',
  },
  {
    id: 'admin-console',
    label: '管理员后台',
    description: '集中处理积分模型、汇率设置和后台权限。',
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

const getCurrentViewId = (pathname: string): CanonicalSettingsViewId => {
  const currentPath = pathname.replace(/^\/settings\/?/, '');
  if (currentPath === 'credit-models' || currentPath === 'exchange-rates' || currentPath === 'admin-system') {
    return 'admin-console';
  }
  if (currentPath === 'cost-estimation') {
    return 'consumption-records';
  }
  return navItems.find((item) => item.path === currentPath)?.id || 'dashboard';
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
  const filteredNavItems = useMemo(() => {
    const keyword = navQuery.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const sectionLabel = sections.find((section) => section.id === item.section)?.label || '';
      return `${item.label} ${item.description} ${sectionLabel}`.toLowerCase().includes(keyword);
    });
  }, [items, navQuery, sections]);

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

const SettingsDesktopShell: React.FC<{
  sections: Array<{ id: NavSectionId; label: string }>;
  items: NavItem[];
  activeView: CanonicalSettingsViewId;
  navQuery: string;
  onQueryChange: (value: string) => void;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  onClose: () => void;
  initialSupplier: Supplier | null;
}> = ({ sections, items, activeView, navQuery, onQueryChange, onNavigate, onClose, initialSupplier }) => {
  const activeNavItem = items.find((item) => item.id === activeView) || items[0];
  const activeSection = sections.find((section) => section.id === activeNavItem.section)?.label || '工作台';

  return (
    <div className="settings-shell-desktop" onClick={(event) => event.stopPropagation()}>
      <aside className="settings-shell-nav">
        <div className="settings-shell-nav__hero">
          <div className="settings-shell-kicker">Settings</div>
          <div className="settings-shell-nav__title">高级设置</div>
          <div className="settings-shell-nav__description">
            用更清晰的层级整理工作台、系统维护和管理员配置。
          </div>
        </div>

        <SettingsNavList
          sections={sections}
          items={items}
          activeView={activeView}
          navQuery={navQuery}
          onQueryChange={onQueryChange}
          onNavigate={onNavigate}
        />
      </aside>

      <section className="settings-shell-main">
        <header className="settings-shell-main__topbar">
          <div className="settings-shell-main__module">
            <div className="settings-shell-kicker">{activeSection}</div>
            <div className="settings-shell-main__title">{activeNavItem.label}</div>
            <div className="settings-shell-toolbar__description">{activeNavItem.description}</div>
          </div>

          <div className="flex items-center gap-2">
            <SettingsBadge tone="neutral">{activeSection}</SettingsBadge>
            <button type="button" onClick={onClose} className="apple-icon-button h-11 w-11 rounded-2xl" aria-label="关闭设置">
              <X size={18} />
            </button>
          </div>
        </header>

        <main className="settings-shell-page settings-shell-page--desktop">
          <Suspense fallback={<ViewFallback />}>
            <Routes>
              <Route path="/settings" element={<DashboardView onNavigate={(view) => onNavigate(resolveViewId(view as SettingsViewId))} />} />
              <Route path="/settings/api-management" element={<ApiSettingsView initialSupplier={initialSupplier} />} />
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
            <div className="settings-shell-kicker">{showNav ? 'Settings' : activeSection}</div>
            <div className="settings-shell-mobile__title">{showNav ? '高级设置' : activeNavItem.label}</div>
            <div className="settings-shell-mobile__description">
              {showNav ? '先选择一个设置项，再进入对应详情。' : activeNavItem.description}
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
  const { authLoading, checkingAdmin, isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = getCurrentViewId(location.pathname);
  const [navQuery, setNavQuery] = useState('');
  const [showNav, setShowNav] = useState(resolveViewId(initialView) === 'dashboard');
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
      onClose={onClose}
      initialSupplier={initialSupplier}
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
  const initialEntry = buildSettingsPath(safeInitialView);
  const content = (
    <div className="settings-shell-backdrop" onClick={onClose}>
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
