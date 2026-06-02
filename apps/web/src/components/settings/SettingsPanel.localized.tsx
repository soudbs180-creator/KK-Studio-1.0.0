import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Globe2, X } from 'lucide-react';
import { MemoryRouter, Routes, useLocation, useNavigate } from 'react-router-dom';

import type { Supplier } from '../../services/billing/supplierService';
import { useAdminRole } from '../../hooks/useAdminRole';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import { isCompactResponsiveWidth } from '../../utils/responsiveSurface';
import { pickByLanguage, useLocale } from '../../context/LocaleContext';
import SettingsDesktopSidebar from './desktop/SettingsDesktopSidebar';
import SettingsDesktopWorkbenchHeader from './desktop/SettingsDesktopWorkbenchHeader';
import {
  deriveApiManagementListStateFromPath,
  isApiManagementEditorRoute,
} from './apiManagementRouteState';
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
  isChatOpen?: boolean;
  chatSidebarWidth?: number;
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
    ? 'inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium'
    : 'inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium';

  if (compact) {
    return (
      <div
        className="flex flex-col gap-0.5 rounded-[12px] border p-0.5 w-[36px] shrink-0 items-center"
        style={{
          borderColor: 'var(--settings-nav-glass-border, rgba(255, 255, 255, 0.08))',
          background: 'var(--frost-card-framework-bg, rgba(22, 28, 45, 0.65))',
        }}
        aria-label={pick('语言切换', 'Language switch')}
      >
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold transition-all"
          onClick={() => setLanguage('zh-CN')}
          style={{
            background: language === 'zh-CN' ? 'var(--settings-nav-active-bg, rgba(59, 130, 246, 0.2))' : 'transparent',
            color: language === 'zh-CN' ? 'var(--settings-nav-text-primary, #fff)' : 'var(--settings-nav-text-secondary, rgba(255,255,255,0.6))',
          }}
        >
          中
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[9px] font-bold transition-all"
          onClick={() => setLanguage('en-US')}
          style={{
            background: language === 'en-US' ? 'var(--settings-nav-active-bg, rgba(59, 130, 246, 0.2))' : 'transparent',
            color: language === 'en-US' ? 'var(--settings-nav-text-primary, #fff)' : 'var(--settings-nav-text-secondary, rgba(255,255,255,0.6))',
          }}
        >
          EN
        </button>
      </div>
    );
  }

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
        <Globe2 size={16} />
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
            <div className="flex items-center gap-2 w-full">
              <div
                data-testid="settings-account-block"
                className={`flex flex-1 items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-all duration-220 cursor-pointer ${
                  activeView === 'user-profile' 
                    ? '' 
                    : 'hover:border-[var(--frost-card-sub-border,rgba(255,255,255,0.14))] hover:bg-[var(--frost-card-sub-bg,rgba(27,34,54,0.3))]'
                }`}
                onClick={() => onNavigate('user-profile')}
                style={{
                  borderColor: activeView === 'user-profile' ? 'rgba(59, 130, 246, 0.35)' : 'var(--settings-nav-glass-border)',
                  background: activeView === 'user-profile' 
                    ? 'radial-gradient(circle at 12% 16%, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.04) 45%, var(--frost-card-framework-bg, rgba(14, 18, 30, 0.8)) 100%)' 
                    : 'color-mix(in srgb, var(--settings-nav-glass-bg) 74%, transparent)',
                  boxShadow: activeView === 'user-profile' 
                    ? '0 0 12px rgba(59, 130, 246, 0.22), inset 2px 2px 5px rgba(0, 0, 0, 0.5), inset -1px -1px 3px rgba(255, 255, 255, 0.03)' 
                    : 'none',
                  transform: activeView === 'user-profile' ? 'translateY(0.5px)' : 'none',
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--settings-avatar-bg)] text-[var(--settings-avatar-text)]">
                  {avatarUrl ? <img src={avatarUrl} alt={accountName} className="h-full w-full object-cover" /> : accountName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--settings-nav-text-primary)]">{accountName}</span>
                  <span className="mt-1 block truncate text-xs text-[var(--settings-nav-text-secondary)]">{accountMeta}</span>
                </span>
              </div>
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
            onOpenLogs={() => onNavigate('system-logs')}
            onClose={onClose}
          />

          <main className="settings-shell-page settings-shell-page--desktop">
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                {renderSettingsRouteElements({
                  initialSupplier,
                  refreshKey: contentRefreshKey,
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
  const mobileBillingLabel = pickByLanguage(language, '计费', 'Billing');
  const activeTitle = activeView === 'dashboard'
    ? pickByLanguage(language, '设置总览', 'Settings Overview')
    : activeView === 'consumption-records'
      ? mobileBillingLabel
      : activeNavItem.label;

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
      {/* 压缩顶栏整体高度，使用 padding 和 minHeight 自适应撑开，使用 align-items: center 实现垂向居中，完美兼容 safe-area-inset-top */}
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
        {/* 左侧显隐过渡的返回按钮 */}
        <div className={backBtnClass}>
          <button
            type="button"
            onClick={handleLeadingAction}
            className="mobile-header-action-btn"
            aria-label={
              isApiManagementEditorRoute
                ? pick('返回 API 管理', 'Back to API management')
                : pick('返回设置总览', 'Back to settings overview')
            }
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        {/* 左对齐与居中平滑切换的标题 */}
        <div className={titleClass}>
          <div className="settings-shell-kicker" style={{ fontSize: '8px', lineHeight: '1' }}>{pick('当前入口', 'Current entry')}</div>
          <h2 className="settings-shell-mobile__title" style={{ fontSize: '14px', lineHeight: '1.2', fontWeight: 600 }}>{activeTitle}</h2>
        </div>

        {/* 右侧始终保留 X 关闭按钮，提供无边框大触控热区 */}
        <div style={{ position: 'absolute', right: '16px', top: 'calc(50% + env(safe-area-inset-top, 0px) / 2)', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
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
        ref={scrollContainerRef}
        className="settings-shell-page settings-shell-page--mobile"
      >
        <Suspense fallback={<ViewFallback />}>
          <Routes>
            {renderSettingsRouteElements({
              initialSupplier,
              onDashboardNavigate: (view) => onNavigate(resolveCanonicalSettingsViewId(view)),
            })}
          </Routes>
        </Suspense>
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
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const nestedApiEditorRoute = isApiManagementEditorRoute(location.pathname);
  const nestedApiListState = useMemo(
    () => deriveApiManagementListStateFromPath(location.pathname),
    [location.pathname],
  );
  const navItems = useMemo(() => getSettingsNavItems(language), [language]);

  useEffect(() => {
    setNavQuery('');
  }, [initialView]);


  const handleNavigate = (view: CanonicalSettingsViewId) => {
    navigate(buildSettingsPath(view));
  };

  const handleBackToApiManagement = () => {
    navigate('/settings/api-management', {
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
  isChatOpen = false,
  chatSidebarWidth = 420,
}) => {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? isCompactResponsiveWidth(window.innerWidth) : false
  ));
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
    const handleResize = () => setIsMobile(isCompactResponsiveWidth(window.innerWidth));
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
      <SettingsPageHistorySync enabled={presentation === 'page'} />
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
        right: !isMobile && isChatOpen ? chatSidebarWidth : 0, // 简体中文：若 AI 助手开启，则在右侧主动避让（扣除）其宽度，保持同屏常驻
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
