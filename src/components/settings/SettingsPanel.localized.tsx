import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Globe2, X } from 'lucide-react';
import { MemoryRouter, Routes, useLocation, useNavigate } from 'react-router-dom';

import type { Supplier } from '../../services/billing/supplierService';
import { useAdminRole } from '../../hooks/useAdminRole';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import { pickByLanguage, useLocale } from '../../context/LocaleContext';
import SettingsDesktopSidebar from './desktop/SettingsDesktopSidebar';
import SettingsDesktopWorkbenchHeader from './desktop/SettingsDesktopWorkbenchHeader';
import {
  deriveApiManagementListStateFromPath,
  isApiManagementEditorRoute,
} from './apiManagementRouteState';
import MobileSettingsHome from './mobile/MobileSettingsHome';
import {
  buildSettingsPath,
  getCurrentSettingsViewId,
  getSettingsNavItems,
  getSettingsSearchPlaceholder,
  getSettingsShellCopy,
  getSettingsViewMeta,
  resolveCanonicalSettingsViewId,
  type CanonicalSettingsViewId,
  type SettingsNavItem,
  type SettingsViewId,
} from './settingsRegistry';
import { renderSettingsRouteElements } from './settingsRouteConfig';

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: SettingsViewId;
  initialSupplier?: Supplier | null;
  presentation?: 'overlay' | 'page';
  initialPathname?: string;
}

const ViewFallback: React.FC = () => (
  <div className="flex min-h-[320px] items-center justify-center p-4">
    <div className="text-sm text-[var(--text-secondary)]">Loading settings...</div>
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

const SettingsDesktopShell: React.FC<{
  items: SettingsNavItem[];
  activeView: CanonicalSettingsViewId;
  navQuery: string;
  onQueryChange: (value: string) => void;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  onRefreshCurrentView: () => void;
  onClose: () => void;
  initialSupplier: Supplier | null;
}> = ({
  items,
  activeView,
  navQuery,
  onQueryChange,
  onNavigate,
  onRefreshCurrentView,
  onClose,
  initialSupplier,
}) => {
  const { language, pick } = useLocale();
  const { authLoading, checkingAdmin, isAdmin, user } = useAdminRole();
  const navigate = useNavigate();
  const headerMeta = getSettingsViewMeta(activeView, language);
  const shellCopy = getSettingsShellCopy(language);

  const filteredItems = items.filter((item) => {
    const keyword = navQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return `${item.label} ${item.description}`.toLowerCase().includes(keyword);
  });

  const accountName = user?.email || user?.phone || pick('当前账户', 'Current account');
  const accountMeta = !authLoading && !checkingAdmin && isAdmin
    ? pick('管理员', 'Administrator')
    : pick('标准账户', 'Standard account');
  const avatarUrl = resolveAvatarUrl(user?.user_metadata?.avatar_url);

  return (
    <div className="settings-shell settings-shell--desktop" onClick={(event) => event.stopPropagation()}>
      <section className="settings-shell-desktop">
        <SettingsDesktopSidebar
          items={filteredItems.map((item) => ({ id: item.id, label: item.label, icon: item.icon }))}
          activeView={activeView}
          navQuery={navQuery}
          searchPlaceholder={getSettingsSearchPlaceholder(activeView, language)}
          onQueryChange={onQueryChange}
          onNavigate={onNavigate}
          title={shellCopy.workbenchTitle}
          description={shellCopy.workbenchDescription}
          emptyLabel={shellCopy.emptySearchLabel}
          accountBlock={(
            <button
              type="button"
              onClick={() => {
                navigate(buildSettingsPath('api-management'));
              }}
              className="flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left"
              style={{
                borderColor: 'var(--settings-border-subtle)',
                background: 'var(--settings-surface-overlay)',
              }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--settings-avatar-bg)] text-[var(--settings-avatar-text)]">
                {avatarUrl ? <img src={avatarUrl} alt={accountName} className="h-full w-full object-cover" /> : accountName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{accountName}</span>
                <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{accountMeta}</span>
              </span>
            </button>
          )}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SettingsDesktopWorkbenchHeader
            meta={headerMeta}
            languageControl={<SettingsLanguageToggle />}
            activeView={activeView}
            onRefreshCurrentView={onRefreshCurrentView}
            onOpenLogs={() => onNavigate('system-logs')}
            onClose={onClose}
          />

          <main className="settings-shell-page settings-shell-page--desktop">
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                {renderSettingsRouteElements({
                  initialSupplier,
                  onDashboardNavigate: (view) => onNavigate(resolveCanonicalSettingsViewId(view)),
                })}
              </Routes>
            </Suspense>
          </main>
        </div>
      </section>
    </div>
  );
};

const SettingsMobileShell: React.FC<{
  activeView: CanonicalSettingsViewId;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  onBackToApiManagement: () => void;
  onClose: () => void;
  initialSupplier: Supplier | null;
  showHome: boolean;
  setShowHome: (value: boolean) => void;
  isApiManagementEditorRoute: boolean;
}> = ({
  activeView,
  onNavigate,
  onBackToApiManagement,
  onClose,
  initialSupplier,
  showHome,
  setShowHome,
  isApiManagementEditorRoute,
}) => {
  const { language, pick } = useLocale();
  const items = getSettingsNavItems(language);
  const shellCopy = getSettingsShellCopy(language);
  const activeNavItem = items.find((item) => item.id === activeView) || items[0];

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    onNavigate(view);
    setShowHome(false);
  };

  const handleLeadingAction = () => {
    if (showHome) {
      onClose();
      return;
    }

    if (isApiManagementEditorRoute) {
      onBackToApiManagement();
      return;
    }

    setShowHome(true);
  };

  return (
    <div className="settings-shell-mobile" onClick={(event) => event.stopPropagation()}>
      <div className="settings-shell-mobile__topbar">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={handleLeadingAction}
            className="apple-icon-button h-11 w-11 shrink-0 rounded-2xl"
            aria-label={showHome ? pick('关闭设置', 'Close settings') : pick('返回手机设置首页', 'Back to mobile settings home')}
          >
            {showHome ? <X size={18} /> : <ArrowLeft size={18} />}
          </button>

          <div className="settings-shell-mobile__title-wrap">
            <div className="settings-shell-kicker">{showHome ? shellCopy.mobileHomeKicker : pick('当前入口', 'Current Entry')}</div>
            <div className="settings-shell-mobile__title">{showHome ? shellCopy.mobileHomeTitle : activeNavItem.label}</div>
            <div className="settings-shell-mobile__description">
              {showHome ? shellCopy.mobileHomeDescription : activeNavItem.description}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SettingsLanguageToggle compact />
          {!showHome ? (
            <button
              type="button"
              onClick={onClose}
              className="apple-icon-button h-11 w-11 shrink-0 rounded-2xl"
              aria-label={pick('关闭设置', 'Close settings')}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="settings-shell-page settings-shell-page--mobile">
        {showHome ? (
          <div className="space-y-3">
            <div
              className="rounded-[24px] border px-4 py-3"
              style={{
                borderColor: 'var(--settings-button-secondary-border)',
                background: 'var(--settings-button-secondary-bg)',
              }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                {shellCopy.mobileHomeKicker}
              </div>
              <div className="mt-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Dashboard / API / Usage / Errors
              </div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                {pickByLanguage(language, '消耗账单', 'Billing Ledger')} / {pickByLanguage(language, '系统错误日志', 'System Error Logs')}
              </div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                {pickByLanguage(language, '排查运行异常、错误和警告', 'Inspect runtime errors, warnings, and troubleshooting details.')}
              </div>
            </div>
            <MobileSettingsHome
              activeSection={activeView === 'storage-settings' ? 'dashboard' : activeView}
              onSelectSection={handleNavigate}
            />
          </div>
        ) : (
          <Suspense fallback={<ViewFallback />}>
            {/* CostEstimation embedded route is provided by settingsRouteConfig. */}
            <Routes>
              {renderSettingsRouteElements({
                initialSupplier,
                onDashboardNavigate: (view) => handleNavigate(resolveCanonicalSettingsViewId(view)),
              })}
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
  const { language } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = getCurrentSettingsViewId(location.pathname);
  const [navQuery, setNavQuery] = useState('');
  const [showHome, setShowHome] = useState(resolveCanonicalSettingsViewId(initialView) === 'dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const nestedApiEditorRoute = isApiManagementEditorRoute(location.pathname);
  const nestedApiListState = useMemo(
    () => deriveApiManagementListStateFromPath(location.pathname),
    [location.pathname],
  );
  const navItems = useMemo(() => getSettingsNavItems(language), [language]);

  useEffect(() => {
    setShowHome(resolveCanonicalSettingsViewId(initialView) === 'dashboard');
    setNavQuery('');
  }, [initialView]);

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    navigate(buildSettingsPath(view));
  };

  const handleBackToApiManagement = () => {
    navigate('/settings/api-management', {
      state: nestedApiListState || undefined,
    });
    setShowHome(false);
  };

  return isMobile ? (
    <SettingsMobileShell
      activeView={activeView}
      onNavigate={handleNavigate}
      onBackToApiManagement={handleBackToApiManagement}
      onClose={onClose}
      initialSupplier={initialSupplier}
      showHome={showHome}
      setShowHome={setShowHome}
      isApiManagementEditorRoute={nestedApiEditorRoute}
    />
  ) : (
    <SettingsDesktopShell
      items={navItems}
      activeView={activeView}
      navQuery={navQuery}
      onQueryChange={setNavQuery}
      onNavigate={handleNavigate}
      onRefreshCurrentView={() => setRefreshKey((current) => current + 1)}
      onClose={onClose}
      initialSupplier={initialSupplier}
      key={refreshKey}
    />
  );
};

const SettingsWorkbenchPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  initialView = 'dashboard',
  initialSupplier = null,
  presentation = 'overlay',
  initialPathname,
}) => {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));
  const safeInitialView = resolveCanonicalSettingsViewId(initialView);
  const normalizedInitialPathname = initialPathname && initialPathname.startsWith('/settings') ? initialPathname : null;
  const initialEntry = normalizedInitialPathname || (
    safeInitialView === 'api-management' && initialSupplier
      ? `/settings/api-management/provider/${encodeURIComponent(initialSupplier.id || initialSupplier.baseUrl)}`
      : buildSettingsPath(safeInitialView)
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen || presentation !== 'overlay') return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const shellContent = (
    <MemoryRouter initialEntries={[initialEntry]} key={initialEntry}>
      <SettingsRouterShell
        initialSupplier={initialSupplier}
        onClose={onClose}
        initialView={safeInitialView}
        isMobile={isMobile}
      />
    </MemoryRouter>
  );

  const content = presentation === 'page' ? (
    <div
      className="settings-panel settings-page-root"
      data-testid="settings-page-root"
    >
      {shellContent}
    </div>
  ) : (
    <div
      className="settings-panel settings-shell-backdrop"
      style={{
        padding: isMobile ? 0 : 24,
        background: 'var(--settings-backdrop-bg)',
        backdropFilter: 'blur(18px)',
      }}
      onClick={onClose}
    >
      {shellContent}
    </div>
  );

  if (presentation === 'page') {
    return content;
  }

  return createPortal(content, document.body);
};

export type { SettingsViewId } from './settingsRegistry';
export default SettingsWorkbenchPanel;
