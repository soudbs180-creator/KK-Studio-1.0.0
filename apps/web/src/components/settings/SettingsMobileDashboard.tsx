import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  ChevronRight,
  CircleGauge,
  Cloud,
  Coins,
  Laptop,
  Sparkles,
  Route,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { useAppearanceMotion, type WebPerformanceMode } from '../../context/AppearanceMotionContext';
import { useBilling } from '../../context/BillingContext';
import { useLocale } from '../../context/LocaleContext';
import {
  browserBridgeAdapter,
  type BrowserBridgeStatusSnapshot,
} from '../../features/ai-assistant-runtime/browser/browserBridge';
import { keyManager } from '../../services/auth/keyManager';
import { getTodayCosts } from '../../services/billing/costService';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import { deriveMobileSettingsOverviewMetrics } from './mobileSettingsOverviewMetrics';
import {
  getActivePerformancePreset,
  applyPerformancePreset,
  readCanvasPerformanceMode,
  readQuickGenerationRoute,
  setQuickGenerationRoute,
  SETTINGS_QUICK_PREFERENCES_EVENT,
  type QuickGenerationRoute,
} from './settingsQuickPreferences';
import {
  getSettingsNavItems,
  type CanonicalSettingsViewId,
  type SettingsNavItem,
} from './settingsRegistry';

const EMPTY_BROWSER_STATUS: BrowserBridgeStatusSnapshot = {
  daemonStatus: 'disconnected',
  extensionStatus: 'disconnected',
  latencyMs: null,
  setupRequired: true,
  setupHint: '',
  platforms: [],
  sessions: [],
  socialChannels: [],
};

const SettingsMobileDashboard: React.FC<{
  onNavigate: (view: CanonicalSettingsViewId) => void;
}> = ({ onNavigate }) => {
  const { language, locale, pick, setLanguage } = useLocale();
  const { preferences, setPreferences } = useAppearanceMotion();
  const {
    balance,
    loading: billingLoading,
    usageLogs,
    fetchLogs,
  } = useBilling();
  const [routePreference, setRoutePreference] = useState<QuickGenerationRoute>(readQuickGenerationRoute);
  const [canvasMode, setCanvasMode] = useState(readCanvasPerformanceMode);
  const [runtime, setRuntime] = useState(() => ({
    slots: keyManager.getSlots(),
    providers: keyManager.getProviders(),
    todayCosts: getTodayCosts(),
  }));
  const [browserStatus, setBrowserStatus] = useState<BrowserBridgeStatusSnapshot>(EMPTY_BROWSER_STATUS);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => keyManager.subscribe(() => setRuntime({
    slots: keyManager.getSlots(),
    providers: keyManager.getProviders(),
    todayCosts: getTodayCosts(),
  })), []);

  useEffect(() => {
    const refreshPreferences = () => {
      setRoutePreference(readQuickGenerationRoute());
      setCanvasMode(readCanvasPerformanceMode());
    };
    window.addEventListener(SETTINGS_QUICK_PREFERENCES_EVENT, refreshPreferences);
    window.addEventListener('storage', refreshPreferences);
    return () => {
      window.removeEventListener(SETTINGS_QUICK_PREFERENCES_EVENT, refreshPreferences);
      window.removeEventListener('storage', refreshPreferences);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const nextStatus = await browserBridgeAdapter.getStatus();
        if (active) setBrowserStatus(nextStatus);
      } catch {
        if (active) setBrowserStatus(EMPTY_BROWSER_STATUS);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const navigationGroups = useMemo(() => {
    const items = getSettingsNavItems(language);
    const resolveItems = (ids: CanonicalSettingsViewId[]) => ids
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is SettingsNavItem => Boolean(item));

    return [
      {
        id: 'creation',
        label: pick('创作与能力', 'Creation & capabilities'),
        items: resolveItems(['generation-mode', 'capability-sources', 'provider-routes']),
      },
      {
        id: 'system',
        label: pick('自动化与系统', 'Automation & system'),
        items: resolveItems([
          'browser-assistant',
          'ai-takeover',
          'data-sync',
          'appearance-motion',
          'canvas-performance',
          'dev-diagnostics',
        ]),
      },
    ];
  }, [language, pick]);
  const activePreset = getActivePerformancePreset(preferences, canvasMode);
  const metrics = useMemo(() => deriveMobileSettingsOverviewMetrics({
    slots: runtime.slots,
    providers: runtime.providers,
    usageLogs,
    todayTokens: runtime.todayCosts.totalTokens,
    browserStatus,
  }), [browserStatus, runtime, usageLogs]);
  const remainingBalance = billingLoading
    ? '...'
    : `${formatRemainingCredits(balance, locale)} ${pick('积分', 'credits')}`;

  // 四值必须与 GenerationModeView 及 ProviderRouteEngine 一致；
  // 只列两项会让用户在此处一点就把「自动」「平台」改写成「本地」。
  const routeOptions: Array<{ id: QuickGenerationRoute; label: string; icon: typeof Laptop }> = [
    { id: 'auto', label: pick('自动', 'Auto'), icon: Sparkles },
    { id: 'local', label: pick('本地优先', 'Local first'), icon: Laptop },
    { id: 'cloud', label: pick('服务器优先', 'Server first'), icon: Cloud },
    { id: 'platform', label: pick('平台积分', 'Platform'), icon: Coins },
  ];
  const performanceOptions: Array<{ id: WebPerformanceMode; label: string }> = [
    { id: 'fast', label: pick('快速', 'Fast') },
    { id: 'balanced', label: pick('正常', 'Normal') },
    { id: 'visual', label: pick('性能', 'Performance') },
  ];
  const performanceLabel = activePreset === 'manual'
    ? pick('手动', 'Manual')
    : performanceOptions.find((option) => option.id === activePreset)?.label || pick('正常', 'Normal');
  const formatCompact = (value: number) => new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
  const formatUsd = (value: number) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
  }).format(value);
  const metricItems = [
    {
      id: 'balance',
      label: pick('剩余额度', 'Balance'),
      value: remainingBalance,
      helper: pick('平台积分', 'Platform credits'),
      icon: Coins,
      tone: 'success',
    },
    {
      id: 'spend',
      label: pick('今日消耗', 'Spent today'),
      value: `${formatCompact(metrics.todayCreditSpend)} ${pick('积分', 'credits')}`,
      helper: `${pick('API 成本', 'API cost')} ${formatUsd(runtime.todayCosts.totalCostUsd)}`,
      icon: BadgeDollarSign,
      tone: 'warm',
    },
    {
      id: 'accounts',
      label: pick('网页登录', 'Web accounts'),
      value: String(metrics.authenticatedBrowserAccounts),
      helper: pick('已认证账号', 'Authenticated accounts'),
      icon: ShieldCheck,
      tone: metrics.authenticatedBrowserAccounts > 0 ? 'success' : 'neutral',
    },
    {
      id: 'routes',
      label: pick('可用路由', 'Available routes'),
      value: String(metrics.availableRoutes),
      helper: metrics.failedRoutes > 0
        ? pick(`${metrics.failedRoutes} 条异常`, `${metrics.failedRoutes} unhealthy`)
        : pick('无异常路由', 'No route errors'),
      icon: Route,
      tone: metrics.failedRoutes > 0 ? 'warm' : 'success',
    },
  ];

  const selectRoute = (route: QuickGenerationRoute) => {
    setQuickGenerationRoute(route);
    setRoutePreference(route);
  };
  const selectPerformance = (mode: WebPerformanceMode) => {
    applyPerformancePreset(mode, setPreferences);
    setCanvasMode(readCanvasPerformanceMode());
  };

  return (
    <div className="settings-mobile-dashboard text-[var(--text-primary)]" data-testid="settings-mobile-dashboard">
      <section className="settings-mobile-overview" aria-labelledby="settings-mobile-overview-title">
        <header className="settings-mobile-overview__header">
          <div className="min-w-0">
            <p className="settings-mobile-overview__kicker">{pick('工作区策略', 'Workspace strategy')}</p>
            <h2 id="settings-mobile-overview-title" className="settings-mobile-overview__title">
              {pick('创作系统状态', 'Creative system status')}
            </h2>
          </div>
          <span
            className="settings-mobile-overview__health"
            data-state="ready"
            aria-label={pick(`网页性能：${performanceLabel}`, `Web performance: ${performanceLabel}`)}
          >
            <CircleGauge size={16} />
            <span>{performanceLabel}</span>
          </span>
        </header>

        <div className="settings-mobile-metric-grid">
          {metricItems.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.id} className="settings-mobile-metric" data-tone={metric.tone}>
                <div className="settings-mobile-metric__label">
                  <Icon size={14} />
                  <span>{metric.label}</span>
                </div>
                <strong className="settings-mobile-metric__value" title={metric.value}>{metric.value}</strong>
                <span className="settings-mobile-metric__helper" title={metric.helper}>{metric.helper}</span>
              </div>
            );
          })}
        </div>

        <div className="settings-mobile-quick-stack">
          <div className="settings-mobile-quick-control">
            <div className="settings-mobile-quick-control__label">
              <span>{pick('默认执行位置', 'Default execution')}</span>
              <strong>{routeOptions.find((option) => option.id === routePreference)?.label}</strong>
            </div>
            <div className="settings-mobile-segment" role="radiogroup" aria-label={pick('默认执行位置', 'Default execution')}>
              {routeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={routePreference === option.id}
                    data-state={routePreference === option.id ? 'selected' : 'idle'}
                    onClick={() => selectRoute(option.id)}
                  >
                    <Icon size={14} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-mobile-quick-control">
            <div className="settings-mobile-quick-control__label">
              <span>{pick('体验模式', 'Experience mode')}</span>
              <strong>{performanceLabel}</strong>
            </div>
            <div className="settings-mobile-segment settings-mobile-segment--three" role="radiogroup" aria-label={pick('体验模式', 'Experience mode')}>
              {performanceOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={activePreset === option.id}
                  data-state={activePreset === option.id ? 'selected' : 'idle'}
                  onClick={() => selectPerformance(option.id)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </section>

      <nav className="settings-mobile-module-list" aria-label={pick('设置模块', 'Settings modules')}>
        {navigationGroups.map((group) => (
          <section key={group.id} className="settings-mobile-module-group" aria-labelledby={`settings-mobile-${group.id}`}>
            <h3 id={`settings-mobile-${group.id}`}>{group.label}</h3>
            <div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="settings-mobile-module-card"
                    data-module={group.id}
                    data-ai-settings-target={item.id}
                  >
                    <span className="settings-mobile-module-card__icon"><Icon size={18} /></span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <section className="settings-mobile-account-row" aria-label={pick('用户信息', 'User information')}>
        <button type="button" className="settings-mobile-account-card" onClick={() => onNavigate('user-profile')}>
          <span className="settings-mobile-account-card__icon"><UserRound size={18} /></span>
          <span className="min-w-0 flex-1 text-left">
            <strong>{pick('用户信息', 'Account')}</strong>
            <span><Coins size={12} />{pick('剩余金额', 'Balance')} {remainingBalance}</span>
          </span>
          <ChevronRight size={16} />
        </button>
        <div className="settings-mobile-language" role="group" aria-label={pick('语言切换', 'Language switch')}>
          <button type="button" aria-pressed={language === 'zh-CN'} onClick={() => setLanguage('zh-CN')}>中</button>
          <button type="button" aria-pressed={language === 'en-US'} onClick={() => setLanguage('en-US')}>EN</button>
        </div>
      </section>
    </div>
  );
};

export default SettingsMobileDashboard;
