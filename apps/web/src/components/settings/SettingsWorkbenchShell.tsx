import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Globe2, X } from 'lucide-react';
import { Routes, useLocation, useNavigate } from 'react-router-dom';

import type { Supplier } from '../../services/billing/supplierService';
import { useAdminRole } from '../../hooks/useAdminRole';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import { pickByLanguage, useLocale } from '../../context/LocaleContext';
import { useBilling } from '../../context/BillingContext';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import SettingsDesktopSidebar from './desktop/SettingsDesktopSidebar';
import SettingsDesktopWorkbenchHeader from './desktop/SettingsDesktopWorkbenchHeader';
import SettingsMobileDashboard from './SettingsMobileDashboard';
import SettingsModuleNavigator from './SettingsModuleNavigator';
import {
  deriveApiManagementListStateFromPath,
  isApiManagementEditorRoute,
} from './apiManagementRouteState';
import {
  buildSettingsPath,
  getCurrentSettingsViewId,
  getSettingsNavItems,
  getSettingsModuleId,
  getSettingsModules,
  getSettingsShellCopy,
  resolveCanonicalSettingsViewId,
  type CanonicalSettingsViewId,
  type SettingsViewId,
} from './settingsRegistry';
import { renderSettingsRouteElements } from './settingsRouteConfig';

const ViewFallback: React.FC = () => (
  <div className="flex w-full flex-col p-8 animate-pulse" style={{ animationDuration: '1.5s', opacity: 0.6 }}>
    <div className="w-48 h-8 rounded-lg mb-3 bg-black/5 dark:bg-white/10"></div>
    <div className="w-3/4 h-4 rounded-md mb-10 bg-black/5 dark:bg-white/5"></div>
    
    <div className="settings-card-grid-container">
      <div 
        className="dashboard-grid-card a-card-span-2-col a-card-span-2-row flex flex-col justify-between p-4 bg-black/5 dark:bg-white/5" 
        style={{ height: '276px', cursor: 'default' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="w-1/4 h-4 rounded bg-black/10 dark:bg-white/10"></div>
            <div className="w-2/5 h-3 rounded bg-black/5 dark:bg-white/5"></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="h-12 rounded-lg bg-black/10 dark:bg-white/10"></div>
          <div className="h-12 rounded-lg bg-black/10 dark:bg-white/10"></div>
          <div className="h-12 rounded-lg bg-black/10 dark:bg-white/10"></div>
          <div className="h-12 rounded-lg bg-black/10 dark:bg-white/10"></div>
        </div>
      </div>

      <div 
        className="dashboard-grid-card a-card-span-2-col flex items-center justify-between p-4 bg-black/5 dark:bg-white/5" 
        style={{ height: '130px', cursor: 'default' }}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="w-1/3 h-4 rounded bg-black/10 dark:bg-white/10"></div>
            <div className="w-1/2 h-3 rounded bg-black/5 dark:bg-white/5"></div>
          </div>
        </div>
      </div>

      <div 
        className="dashboard-grid-card flex flex-col justify-between p-4 bg-black/5 dark:bg-white/5" 
        style={{ height: '130px', cursor: 'default' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-white/10 shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="w-1/2 h-4 rounded bg-black/10 dark:bg-white/10"></div>
            <div className="w-3/4 h-3 rounded bg-black/5 dark:bg-white/5"></div>
          </div>
        </div>
      </div>

      <div 
        className="dashboard-grid-card flex flex-col justify-between p-4 bg-black/5 dark:bg-white/5" 
        style={{ height: '130px', cursor: 'default' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-white/10 shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="w-1/2 h-4 rounded bg-black/10 dark:bg-white/10"></div>
            <div className="w-3/4 h-3 rounded bg-black/5 dark:bg-white/5"></div>
          </div>
        </div>
      </div>

      <div 
        className="dashboard-grid-card a-card-span-2-col flex flex-col justify-between p-4 bg-black/5 dark:bg-white/5" 
        style={{ height: '130px', cursor: 'default' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-white/10 shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="w-1/3 h-4 rounded bg-black/10 dark:bg-white/10"></div>
            <div className="w-1/2 h-3 rounded bg-black/5 dark:bg-white/5"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SettingsLanguageToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage, pick } = useLocale();
  const buttonClassName = compact
    ? 'inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium'
    : 'inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium';

  if (compact) {
    return (
      <div
        role="group"
        className="flex h-16 w-[38px] shrink-0 flex-col items-center justify-between gap-1 rounded-[16px] border p-1"
        style={{
          borderColor: 'var(--settings-nav-glass-border, rgba(255, 255, 255, 0.08))', // UI_TOKEN_EXCEPTION
          background: 'var(--frost-card-framework-bg, rgba(22, 28, 45, 0.65))', // UI_TOKEN_EXCEPTION
        }}
        aria-label={pick('语言切换', 'Language switch')}
      >
        <button
          type="button"
          aria-label={pick('切换为中文', 'Switch to Chinese')}
          aria-pressed={language === 'zh-CN'}
          className="flex flex-1 w-full items-center justify-center rounded-[12px] text-[10px] font-bold transition-all"
          onClick={() => setLanguage('zh-CN')}
          style={{
            background: language === 'zh-CN' ? 'var(--settings-nav-active-bg, rgba(59, 130, 246, 0.2))' : 'transparent', // UI_TOKEN_EXCEPTION
            color: language === 'zh-CN' ? 'var(--settings-nav-text-primary, #fff)' : 'var(--settings-nav-text-secondary, rgba(255,255,255,0.6))', // UI_TOKEN_EXCEPTION
          }}
        >
          中
        </button>
        <button
          type="button"
          aria-label={pick('切换为英文', 'Switch to English')}
          aria-pressed={language === 'en-US'}
          className="flex flex-1 w-full items-center justify-center rounded-[12px] text-[9px] font-bold transition-all"
          onClick={() => setLanguage('en-US')}
          style={{
            background: language === 'en-US' ? 'var(--settings-nav-active-bg, rgba(59, 130, 246, 0.2))' : 'transparent', // UI_TOKEN_EXCEPTION
            color: language === 'en-US' ? 'var(--settings-nav-text-primary, #fff)' : 'var(--settings-nav-text-secondary, rgba(255,255,255,0.6))', // UI_TOKEN_EXCEPTION
          }}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      className="inline-flex items-center gap-1 rounded-full border p-1"
      style={{
        borderColor: 'var(--settings-button-secondary-border)',
        background: 'var(--settings-button-secondary-bg)',
      }}
      aria-label={pick('语言切换', 'Language switch')}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: 'var(--settings-nav-text-tertiary)' }}>
        <Globe2 size={16} />
      </span>
      <button
        type="button"
        aria-pressed={language === 'zh-CN'}
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
        aria-pressed={language === 'en-US'}
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
  activeView: CanonicalSettingsViewId;
  onNavigate: (view: CanonicalSettingsViewId) => void;
  onRefreshCurrentView: () => void;
  onClose: () => void;
  initialSupplier: Supplier | null;
  contentRefreshKey: number;
}> = ({
  activeView,
  onNavigate,
  onRefreshCurrentView,
  onClose,
  initialSupplier,
  contentRefreshKey,
}) => {
  const location = useLocation();
  const { language, locale, pick } = useLocale();
  const { balance, loading: billingLoading } = useBilling();
  const { authLoading, checkingAdmin, isAdmin, user } = useAdminRole();
  const shellCopy = getSettingsShellCopy(language);
  const modules = getSettingsModules(language);
  const activeModuleId = getSettingsModuleId(activeView);

  const accountName = user?.email || user?.phone || pick('当前账户', 'Current account');
  const accountMeta = !authLoading && !checkingAdmin && isAdmin
    ? pick('管理员', 'Administrator')
    : pick('标准账户', 'Standard account');
  const avatarUrl = resolveAvatarUrl(user?.user_metadata?.avatar_url);
  const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, locale);
  const desktopScrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (desktopScrollContainerRef.current) {
      desktopScrollContainerRef.current.scrollTop = 0;
    }
  }, [location.pathname, contentRefreshKey]);

  return (
    <div className="settings-shell settings-shell--desktop" onClick={(event) => event.stopPropagation()}>
      <section className="settings-shell-desktop">
        <SettingsDesktopSidebar
          modules={modules}
          activeModuleId={activeModuleId}
          onNavigate={onNavigate}
          title={shellCopy.workbenchTitle}
          description={shellCopy.workbenchDescription}
          accountBlock={(
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                data-testid="settings-account-block"
                data-state={activeView === 'user-profile' ? 'active' : 'idle'}
                data-accent="profile"
                aria-current={activeView === 'user-profile' ? 'page' : undefined}
                className="settings-account-card flex h-16 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[16px] border px-3 py-2 text-left"
                onClick={() => onNavigate('user-profile')}
                style={{
                  boxSizing: 'border-box',
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--settings-avatar-bg)] text-[var(--settings-avatar-text)]">
                  {avatarUrl ? <img src={avatarUrl} alt={accountName} className="h-full w-full object-cover" /> : accountName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--settings-nav-text-primary)]">{accountName}</span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--settings-nav-text-secondary)]">
                    <span className="truncate">{accountMeta}</span>
                    <span aria-hidden="true">·</span>
                    <span className="settings-account-card__balance shrink-0">{remainingBalanceDisplay}</span>
                  </span>
                </span>
              </button>
              <div className="shrink-0 flex items-center justify-center">
                <SettingsLanguageToggle compact />
              </div>
            </div>
          )}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ position: 'relative' }}>
          <SettingsDesktopWorkbenchHeader
            activeView={activeView}
            onRefreshCurrentView={onRefreshCurrentView}
            onOpenLogs={() => onNavigate('dev-diagnostics')}
            onClose={onClose}
          />

          <main ref={desktopScrollContainerRef} className="settings-shell-page settings-shell-page--desktop">
            <SettingsModuleNavigator activeView={activeView} onNavigate={onNavigate} />
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                {renderSettingsRouteElements({
                  initialSupplier,
                  refreshKey: contentRefreshKey,
                  onDashboardNavigate: (view: SettingsViewId) => onNavigate(resolveCanonicalSettingsViewId(view)),
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
  isApiManagementEditorRoute: boolean;
}> = ({
  activeView,
  onNavigate,
  onBackToApiManagement,
  onClose,
  initialSupplier,
  isApiManagementEditorRoute,
}) => {
  const location = useLocation();
  const { language, pick } = useLocale();
  const items = getSettingsNavItems(language);
  const activeNavItem = items.find((item) => item.id === activeView) || items[0];
  const activeTitle = activeView === 'dashboard'
    ? pickByLanguage(language, '设置总览', 'Settings Overview')
    : activeView === 'user-profile'
      ? pickByLanguage(language, '个人中心', 'User Profile')
      : activeNavItem?.label || '';

  const hasContentBack = isApiManagementEditorRoute;
  const [isContentBackScrolled, setIsContentBackScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleLeadingAction = () => {
    if (isApiManagementEditorRoute) {
      onBackToApiManagement();
      return;
    }

    activeView === 'dashboard' ? onClose() : onNavigate('dashboard');
  };

  useEffect(() => {
    setIsContentBackScrolled(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!container) return;
      const backBtn = container.querySelector('[data-content-back-button="true"]');
      if (backBtn) {
        const buttonRect = backBtn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const topbarHeight = 56;
        const isShielded = buttonRect.bottom < (containerRect.top + topbarHeight);
        setIsContentBackScrolled(isShielded);
      } else {
        setIsContentBackScrolled(container.scrollTop > 30);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname, hasContentBack]);

  const isTitleLeft = hasContentBack && !isContentBackScrolled;
  const titleClass = `settings-shell-mobile__title-wrap ${
    isTitleLeft ? 'settings-shell-mobile__title-wrap--left' : 'settings-shell-mobile__title-wrap--center'
  }`;
  
  const backBtnClass = `settings-shell-mobile__back-btn-container ${
    isTitleLeft ? 'settings-shell-mobile__back-btn-container--hidden' : 'settings-shell-mobile__back-btn-container--visible'
  }`;

  return (
    <div className="settings-shell-mobile" onClick={(event) => event.stopPropagation()}>
      <div 
        className="settings-shell-mobile__topbar"
        style={{
          position: 'relative',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          paddingBottom: '8px',
          minHeight: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <div className={backBtnClass}>
          <button
            type="button"
            onClick={handleLeadingAction}
            className="mobile-header-action-btn"
            aria-label={
              isApiManagementEditorRoute
                ? pick('返回 API 管理', 'Back to API management')
                : activeView === 'dashboard'
                  ? pick('返回工作区', 'Back to workspace')
                : pick('返回设置总览', 'Back to settings overview')
            }
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className={titleClass}>
          <div className="settings-shell-kicker" style={{ fontSize: '8px', lineHeight: '1' }}>{pick('当前入口', 'Current entry')}</div>
          <div className="settings-shell-mobile__title" style={{ fontSize: '14px', lineHeight: '1.2', fontWeight: 600 }}>{activeTitle}</div>
        </div>

        <div style={{ position: 'absolute', right: '8px', top: 'calc(50% + env(safe-area-inset-top, 0px) / 2)', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            className="mobile-header-action-btn"
            aria-label={pick('关闭设置', 'Close settings')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div 
        key={location.pathname}
        ref={scrollContainerRef}
        className="settings-shell-page settings-shell-page--mobile"
      >
        {location.pathname === '/settings' || location.pathname === '/settings/' ? (
          <SettingsMobileDashboard onNavigate={onNavigate} />
        ) : (
          <>
            <SettingsModuleNavigator activeView={activeView} onNavigate={onNavigate} />
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                {renderSettingsRouteElements({
                  initialSupplier,
                  onDashboardNavigate: (view: SettingsViewId) => onNavigate(resolveCanonicalSettingsViewId(view)),
                })}
              </Routes>
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
};

const SettingsPageHistorySync: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const syncedPathRef = useRef('');
  const initializedRef = useRef(false);
  const currentRouterPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    syncedPathRef.current = currentRouterPath;
  }, [currentRouterPath]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const nextWindowPath = currentRouterPath;
    const currentWindowPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    syncedPathRef.current = nextWindowPath;

    if (!initializedRef.current) {
      initializedRef.current = true;

      if (currentWindowPath !== nextWindowPath) {
        window.history.replaceState(window.history.state, '', nextWindowPath);
        window.dispatchEvent(new CustomEvent('kk-app-locationchange', { detail: { pathname: window.location.pathname } }));
      }
      return;
    }

    if (currentWindowPath !== nextWindowPath) {
      window.history.pushState(window.history.state, '', nextWindowPath);
      window.dispatchEvent(new CustomEvent('kk-app-locationchange', { detail: { pathname: window.location.pathname } }));
    }
  }, [currentRouterPath, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const handlePopstate = () => {
      const nextWindowPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (!window.location.pathname.startsWith('/settings')) {
        window.location.assign(nextWindowPath);
        return;
      }

      if (nextWindowPath === syncedPathRef.current) {
        return;
      }

      syncedPathRef.current = nextWindowPath;
      navigate(nextWindowPath, { replace: true });
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [enabled, navigate]);

  return null;
};

export const SettingsRouterShell: React.FC<{
  initialSupplier: Supplier | null;
  onClose: () => void;
  initialView: SettingsViewId;
  isMobile: boolean;
}> = ({ initialSupplier, onClose, initialView, isMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = getCurrentSettingsViewId(location.pathname);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const nestedApiEditorRoute = isApiManagementEditorRoute(location.pathname);
  const nestedApiListState = useMemo(
    () => deriveApiManagementListStateFromPath(location.pathname),
    [location.pathname],
  );
  void initialView;

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    navigate(buildSettingsPath(view));
  };

  const handleBackToApiManagement = () => {
    navigate('/settings/capability-sources', {
      state: nestedApiListState || undefined,
    });
  };

  return isMobile ? (
    <SettingsMobileShell
      activeView={activeView}
      onNavigate={handleNavigate}
      onBackToApiManagement={handleBackToApiManagement}
      onClose={onClose}
      initialSupplier={initialSupplier}
      isApiManagementEditorRoute={nestedApiEditorRoute}
    />
  ) : (
    <SettingsDesktopShell
      activeView={activeView}
      onNavigate={handleNavigate}
      onRefreshCurrentView={() => setContentRefreshKey((current) => current + 1)}
      onClose={onClose}
      initialSupplier={initialSupplier}
      contentRefreshKey={contentRefreshKey}
    />
  );
};
