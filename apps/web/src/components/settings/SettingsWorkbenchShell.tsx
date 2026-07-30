import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  getSettingsNavItems,
  getSettingsViewMeta,
  type CanonicalSettingsViewId,
  type SettingsNavItem,
  type SettingsViewId,
} from './settingsRegistry';
import {
  deriveApiManagementListStateFromPath,
  isApiManagementEditorRoute,
} from './apiManagementRouteState';
import {
  buildMobileSettingsGroups,
  resolveMobileSettingsTopbarState,
} from './mobileSettingsNavigation';
import { renderSettingsRouteElements } from './settingsRouteConfig';

type ConsoleGroupId = 'workspace' | 'capabilities' | 'automation' | 'system';

const GROUPS: Array<{
  id: ConsoleGroupId;
  labelZh: string;
  labelEn: string;
  views: CanonicalSettingsViewId[];
}> = [
  { id: 'workspace', labelZh: '工作区', labelEn: 'Workspace', views: ['dashboard', 'generation-mode'] },
  { id: 'capabilities', labelZh: '能力配置', labelEn: 'Capabilities', views: ['capability-sources', 'provider-routes'] },
  { id: 'automation', labelZh: '自动化', labelEn: 'Automation', views: ['browser-assistant', 'ai-takeover'] },
  { id: 'system', labelZh: '系统维护', labelEn: 'System', views: ['data-sync', 'appearance-motion', 'canvas-performance', 'dev-diagnostics'] },
];

const ConsoleFallback: React.FC = () => (
  <div className="settings-console-loading" role="status" aria-label="正在加载设置">
    <span />
    <span />
    <span />
  </div>
);

function buildGroups(items: SettingsNavItem[], english: boolean) {
  return GROUPS.map((group) => ({
    id: group.id,
    label: english ? group.labelEn : group.labelZh,
    items: group.views
      .map((view) => items.find((item) => item.id === view))
      .filter((item): item is SettingsNavItem => Boolean(item)),
  }));
}

const SettingsConsoleSidebar: React.FC<{
  activeView: CanonicalSettingsViewId;
  onNavigate: (view: CanonicalSettingsViewId) => void;
}> = ({ activeView, onNavigate }) => {
  const { language, pick } = useLocale();
  const { balance, loading } = useBilling();
  const { user, isAdmin, authLoading, checkingAdmin } = useAdminRole();
  const items = useMemo(() => getSettingsNavItems(language), [language]);
  const groups = useMemo(() => buildGroups(items, language === 'en-US'), [items, language]);
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
            <h2>{group.label}</h2>
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

const SettingsConsoleMobileHome: React.FC<{
  onNavigate: (view: CanonicalSettingsViewId) => void;
}> = ({ onNavigate }) => {
  const { language, pick } = useLocale();
  const items = useMemo(() => getSettingsNavItems(language), [language]);
  const groups = useMemo(
    () => buildMobileSettingsGroups(items, language === 'en-US'),
    [items, language],
  );

  return (
    <div className="settings-console-mobile-home" data-testid="settings-mobile-dashboard">
      <section className="settings-console-mobile-overview" aria-labelledby="settings-console-mobile-overview-title">
        <div className="settings-console-mobile-overview__copy">
          <span>{pick('当前工作区', 'Current workspace')}</span>
          <h2 id="settings-console-mobile-overview-title">{pick('创作与能力设置', 'Creation and capability settings')}</h2>
          <p>
            {pick(
              '按模块管理生成方式、能力来源、自动化与设备性能。',
              'Manage generation, capability inputs, automation, and device performance by module.',
            )}
          </p>
        </div>
        <div className="settings-console-mobile-overview__metrics" aria-label={pick('设置总览', 'Settings overview')}>
          <span><strong>{items.length}</strong><small>{pick('设置项', 'settings')}</small></span>
          <span><strong>{groups.length}</strong><small>{pick('功能模块', 'modules')}</small></span>
          <span><strong>{pick('正常', 'Normal')}</strong><small>{pick('体验模式', 'experience')}</small></span>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.id}>
          <h2>{group.label}</h2>
          <div className="settings-console-mobile-list">
            {group.items.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => onNavigate(item.id)}><Icon size={17} /><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={14} /></button>;
            })}
          </div>
        </section>
      ))}
      <button type="button" className="settings-console-mobile-account" onClick={() => onNavigate('user-profile')}><span>个人中心</span><ChevronRight size={14} /></button>
    </div>
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
  const nestedApiEditor = isApiManagementEditorRoute(location.pathname);
  const nestedApiState = useMemo(() => deriveApiManagementListStateFromPath(location.pathname), [location.pathname]);
  const { language, pick } = useLocale();
  void initialView;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, refreshKey]);

  const handleNavigate = (view: CanonicalSettingsViewId) => navigate(buildSettingsPath(view));
  const handleBack = () => {
    if (nestedApiEditor) {
      navigate('/settings/capability-sources', { state: nestedApiState || undefined });
      return;
    }
    if (activeView === 'dashboard') onClose();
    else navigate('/settings');
  };

  if (isMobile) {
    const atHome = location.pathname === '/settings' || location.pathname === '/settings/';
    const topbarState = resolveMobileSettingsTopbarState(
      atHome,
      getSettingsViewMeta(activeView, language).title,
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
          {atHome ? <SettingsConsoleMobileHome onNavigate={handleNavigate} /> : <SettingsConsoleRoutes initialSupplier={initialSupplier} refreshKey={refreshKey} onNavigate={handleNavigate} />}
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
