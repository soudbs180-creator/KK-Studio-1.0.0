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
  getSettingsNavSections,
  getSettingsSearchPlaceholder,
  getSettingsShellCopy,
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
  <div className="flex w-full flex-col p-8 animate-pulse" style={{ animationDuration: '1.5s', opacity: 0.6 }}>
    {/* Header Skeleton */}
    <div className="w-48 h-8 rounded-lg mb-3 bg-black/5 dark:bg-white/10"></div>
    <div className="w-3/4 h-4 rounded-md mb-10 bg-black/5 dark:bg-white/5"></div>
    
    {/* Items Skeleton */}
    <div className="flex flex-col gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="w-full h-[76px] rounded-[22px] flex items-center px-5 gap-4 bg-black/5 dark:bg-white/5">
          <div className="w-11 h-11 rounded-[14px] bg-black/10 dark:bg-white/10"></div>
          <div className="flex flex-col gap-2.5 flex-1">
            <div className="w-1/4 h-5 rounded-md bg-black/10 dark:bg-white/10"></div>
            <div className="w-2/5 h-3.5 rounded-md bg-black/5 dark:bg-white/5"></div>
          </div>
        </div>
      ))}
    </div>
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
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: 'var(--settings-nav-text-tertiary)' }}>
        <Globe2 size={compact ? 14 : 16} />
      </span>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setLanguage('zh-CN')}
        style={{
          background: language === 'zh-CN' ? 'var(--settings-nav-active-bg)' : 'transparent',
          color: language === 'zh-CN' ? 'var(--settings-nav-text-primary)' : 'var(--settings-nav-text-secondary)',
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
          color: language === 'en-US' ? 'var(--settings-nav-text-primary)' : 'var(--settings-nav-text-secondary)',
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
  contentRefreshKey: number;
}> = ({
  items,
  activeView,
  navQuery,
  onQueryChange,
  onNavigate,
  onRefreshCurrentView,
  onClose,
  initialSupplier,
  contentRefreshKey,
}) => {
  const { language, pick } = useLocale();
  const { authLoading, checkingAdmin, isAdmin, user } = useAdminRole();
  const navigate = useNavigate();
  const shellCopy = getSettingsShellCopy(language);
  const sections = getSettingsNavSections(language);

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
          items={filteredItems}
          sections={sections}
          activeView={activeView}
          navQuery={navQuery}
          searchPlaceholder={getSettingsSearchPlaceholder(activeView, language)}
          onQueryChange={onQueryChange}
          onNavigate={onNavigate}
          title={shellCopy.workbenchTitle}
          description={shellCopy.workbenchDescription}
          emptyLabel={shellCopy.emptySearchLabel}
          accountBlock={(
            <div className="space-y-3">
              <SettingsLanguageToggle compact />
              <button
                type="button"
                onClick={() => {
                  navigate(buildSettingsPath('api-management'));
                }}
                className="flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left"
                style={{
                  borderColor: 'var(--settings-nav-glass-border)',
                  background: 'color-mix(in srgb, var(--settings-nav-glass-bg) 74%, transparent)',
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--settings-avatar-bg)] text-[var(--settings-avatar-text)]">
                  {avatarUrl ? <img src={avatarUrl} alt={accountName} className="h-full w-full object-cover" /> : accountName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--settings-nav-text-primary)]">{accountName}</span>
                  <span className="mt-1 block truncate text-xs text-[var(--settings-nav-text-secondary)]">{accountMeta}</span>
                </span>
              </button>
            </div>
          )}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SettingsDesktopWorkbenchHeader
            activeView={activeView}
            onRefreshCurrentView={onRefreshCurrentView}
            onOpenLogs={() => onNavigate('system-logs')}
            onClose={onClose}
          />

          <main className="settings-shell-page settings-shell-page--desktop">
            <Suspense key={`${activeView}:${contentRefreshKey}`} fallback={<ViewFallback />}>
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
            aria-label={showHome ? pick('关闭设置', 'Close settings') : pick('返回移动设置首页', 'Back to mobile settings home')}
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
                Overview / API / Billing / Errors
              </div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                {pickByLanguage(language, '计费', 'Billing')} / {pickByLanguage(language, '错误', 'Errors')}
              </div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                {pickByLanguage(language, '系统错误、告警与排障信号。', 'System errors, warnings, and troubleshooting signals.')}
              </div>
            </div>
            <MobileSettingsHome
              activeSection={activeView === 'storage-settings' ? 'dashboard' : activeView}
              onSelectSection={handleNavigate}
            />
          </div>
        ) : (
          <Suspense fallback={<ViewFallback />}>
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
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
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
      onRefreshCurrentView={() => setContentRefreshKey((current) => current + 1)}
      onClose={onClose}
      initialSupplier={initialSupplier}
      contentRefreshKey={contentRefreshKey}
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
  const normalizedInitialPathname = initialPathname && initialPathname.startsWith('/settings') ? initialPathname : null;
  const safeInitialView = normalizedInitialPathname
    ? getCurrentSettingsViewId(normalizedInitialPathname)
    : resolveCanonicalSettingsViewId(initialView);
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
  }, [isOpen, presentation]);

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
