import React, { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Moon,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
import { Routes, useLocation, useNavigate } from 'react-router';

import { useLocale } from '../../context/LocaleContext';
import { useTheme } from '../../context/ThemeContext';
import { useBilling } from '../../context/BillingContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import type { Supplier } from '../../services/billing/supplierService';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import {
  buildSettingsPath,
  getCurrentSettingsViewId,
  getSettingsNavigationGroups,
  getSettingsViewMeta,
  type CanonicalSettingsViewId,
  type SettingsViewId,
} from './settingsRegistry';
import {
  deriveApiManagementListStateFromPath,
  isApiManagementEditorRoute,
} from './apiManagementRouteState';
import {
  resolveMobileSettingsTopbarState,
} from './mobileSettingsNavigation';
import { renderSettingsRouteElements } from './settingsRouteConfig';
import SettingsMobileDashboard from './SettingsMobileDashboard';

const ConsoleFallback: React.FC = () => (
  <div className="settings-console-loading" role="status" aria-label="正在加载设置">
    <span />
    <span />
    <span />
  </div>
);

const SettingsConsoleSidebar: React.FC<{
  activeView: CanonicalSettingsViewId;
  onNavigate: (view: CanonicalSettingsViewId) => void;
}> = ({ activeView, onNavigate }) => {
  const { language, pick } = useLocale();
  const { balance, loading } = useBilling();
  const { user, isAdmin, authLoading, checkingAdmin } = useAdminRole();
  const groups = useMemo(() => getSettingsNavigationGroups(language), [language]);
  const accountName = user?.email || user?.phone || pick('当前账户', 'Current account');
  const avatarUrl = resolveAvatarUrl(user?.user_metadata?.avatar_url);
  const accountRole = !authLoading && !checkingAdmin && isAdmin ? pick('管理员', 'Administrator') : pick('标准账户', 'Standard account');

  return (
    <aside className="settings-console-sidebar">
      <div className="settings-console-brand">
        <span className="settings-console-brand__mark">KK</span>
        <span><strong>KK Studio</strong><small>{pick('设置控制台', 'Settings console')}</small></span>
      </div>

      <nav className="settings-console-nav" aria-label={pick('设置导航', 'Settings navigation')}>
        {groups.map((group) => (
          <section key={group.id} className="settings-console-nav__group">
            {group.label ? <h2>{group.label}</h2> : null}
            <div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeView;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="settings-console-nav__item"
                    data-selected={active}
                    aria-current={active ? 'page' : undefined}
                    data-ai-settings-target={item.id}
                    onClick={() => onNavigate(item.id)}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                    <ChevronRight size={13} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <button
        type="button"
        className="settings-console-account"
        data-selected={activeView === 'user-profile' || activeView === 'recharge'}
        onClick={() => onNavigate('user-profile')}
      >
        <span className="settings-console-account__avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : accountName.slice(0, 1).toUpperCase()}
        </span>
        <span><strong>{accountName}</strong><small>{accountRole} · {loading ? '...' : formatRemainingCredits(balance, language)}</small></span>
        <ChevronRight size={13} />
      </button>
    </aside>
  );
};

const SettingsConsoleTopbar: React.FC<{
  activeView: CanonicalSettingsViewId;
  onRefresh: () => void;
  onClose: () => void;
}> = ({ activeView, onRefresh, onClose }) => {
  const { language, pick } = useLocale();
  const { resolvedTheme, toggleTheme } = useTheme();
  const meta = getSettingsViewMeta(activeView, language);

  return (
    <header className="settings-console-topbar">
      <div className="settings-console-topbar__title">
        <span>{meta.eyebrow}</span>
        <div><h1>{meta.title}</h1><p>{meta.description}</p></div>
      </div>
      <div className="settings-console-topbar__actions">
        <button type="button" aria-label={pick('切换主题', 'Toggle theme')} onClick={toggleTheme}>
          {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button type="button" aria-label={pick('刷新当前页面', 'Refresh current view')} onClick={onRefresh}><RefreshCw size={16} /></button>
        <button type="button" aria-label={pick('关闭设置', 'Close settings')} onClick={onClose}><X size={16} /></button>
      </div>
    </header>
  );
};

const SettingsConsoleRoutes: React.FC<{
  initialSupplier: Supplier | null;
  refreshKey: number;
  onNavigate: (view: CanonicalSettingsViewId) => void;
}> = ({ initialSupplier, refreshKey, onNavigate }) => (
  <Suspense fallback={<ConsoleFallback />}>
    <Routes>
      {renderSettingsRouteElements({
        initialSupplier,
        refreshKey,
        onDashboardNavigate: onNavigate,
      })}
    </Routes>
  </Suspense>
);

export const SettingsConsoleShell: React.FC<{
  initialSupplier: Supplier | null;
  onClose: () => void;
  initialView: SettingsViewId;
  isMobile: boolean;
}> = ({ initialSupplier, onClose, initialView, isMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = getCurrentSettingsViewId(location.pathname);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLElement | null>(null);
  const dashboardScrollTopRef = useRef(0);
  const nestedApiEditor = isApiManagementEditorRoute(location.pathname);
  const nestedApiState = useMemo(() => deriveApiManagementListStateFromPath(location.pathname), [location.pathname]);
  const { language, pick } = useLocale();
  const atHome = location.pathname === '/settings' || location.pathname === '/settings/';
  void initialView;

  useLayoutEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    const nextScrollTop = atHome ? dashboardScrollTopRef.current : 0;
    const frameId = requestAnimationFrame(() => {
      scrollContainer.scrollTop = nextScrollTop;
      scrollContainer.scrollTo({ top: nextScrollTop, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frameId);
  }, [atHome, location.pathname, refreshKey]);

  const handleNavigate = (view: CanonicalSettingsViewId) => {
    if (atHome) dashboardScrollTopRef.current = scrollRef.current?.scrollTop ?? 0;
    navigate(buildSettingsPath(view));
  };
  const handleBack = () => {
    if (nestedApiEditor) {
      navigate('/settings/capability-sources', { state: nestedApiState || undefined });
      return;
    }
    if (activeView === 'dashboard') onClose();
    else navigate('/settings');
  };

  if (isMobile) {
    const topbarState = resolveMobileSettingsTopbarState(
      atHome,
      getSettingsViewMeta(activeView, language).title,
      pick('系统设置', 'System Settings'),
    );
    return (
      <div className="settings-console settings-console--mobile" onClick={(event) => event.stopPropagation()}>
        <header
          className="settings-console-mobile-topbar"
          data-title-alignment={topbarState.titleAlignment}
          data-navigation-state={atHome ? 'home' : 'nested'}
        >
          {topbarState.showBackButton ? (
            <button type="button" aria-label={pick('返回系统设置', 'Back to settings')} onClick={handleBack}>
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className="settings-console-mobile-topbar__placeholder" aria-hidden="true" />
          )}
          <strong>{topbarState.title}</strong>
          <button type="button" aria-label={pick('关闭设置', 'Close settings')} onClick={onClose}><X size={18} /></button>
        </header>
        <main ref={scrollRef as React.RefObject<HTMLElement>} className="settings-console-content settings-console-content--mobile">
          {atHome ? <SettingsMobileDashboard onNavigate={handleNavigate} /> : <SettingsConsoleRoutes initialSupplier={initialSupplier} refreshKey={refreshKey} onNavigate={handleNavigate} />}
        </main>
      </div>
    );
  }

  return (
    <div className="settings-console settings-console--desktop" onClick={(event) => event.stopPropagation()}>
      <SettingsConsoleSidebar activeView={activeView} onNavigate={handleNavigate} />
      <section className="settings-console-main">
        <SettingsConsoleTopbar activeView={activeView} onRefresh={() => setRefreshKey((value) => value + 1)} onClose={onClose} />
        <main ref={scrollRef as React.RefObject<HTMLElement>} className="settings-console-content">
          <SettingsConsoleRoutes initialSupplier={initialSupplier} refreshKey={refreshKey} onNavigate={handleNavigate} />
        </main>
      </section>
    </div>
  );
};

export const SettingsRouterShell = SettingsConsoleShell;
