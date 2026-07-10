import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeDollarSign,
  ChevronRight,
  CircleGauge,
  Clock3,
  Coins,
  KeyRound,
  Route,
  ShieldCheck,
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
import {
  getSettingsNavItems,
  getSettingsNavSections,
  type CanonicalSettingsViewId,
} from './settingsRegistry';
import { deriveMobileSettingsOverviewMetrics } from './mobileSettingsOverviewMetrics';

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


const getPerformanceModeLabel = (
  mode: WebPerformanceMode,
  pick: (zh: string, en: string) => string,
) => {
  if (mode === 'fast') return pick('快速', 'Fast');
  if (mode === 'visual') return pick('质感', 'Visual');
  return pick('正常', 'Normal');
};

const getNavigationTone = (view: CanonicalSettingsViewId) => {
  if (view === 'capability-sources' || view === 'data-sync') return 'success';
  if (view === 'provider-routes' || view === 'ai-takeover') return 'accent';
  if (view === 'appearance-motion' || view === 'canvas-performance') return 'warm';
  return 'neutral';
};

const SettingsMobileDashboard: React.FC<{
  onNavigate: (view: CanonicalSettingsViewId) => void;
}> = ({ onNavigate }) => {
  const { locale, pick, language } = useLocale();
  const { preferences, systemReducedMotion } = useAppearanceMotion();
  const {
    balance,
    loading: billingLoading,
    usageLogs,
    fetchLogs,
  } = useBilling();
  const [runtime, setRuntime] = useState(() => ({
    slots: keyManager.getSlots(),
    providers: keyManager.getProviders(),
    todayCosts: getTodayCosts(),
  }));
  const [browserStatus, setBrowserStatus] = useState<BrowserBridgeStatusSnapshot>(EMPTY_BROWSER_STATUS);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const refresh = () => setRuntime({
      slots: keyManager.getSlots(),
      providers: keyManager.getProviders(),
      todayCosts: getTodayCosts(),
    });
    refresh();
    return keyManager.subscribe(refresh);
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

  const metrics = useMemo(() => deriveMobileSettingsOverviewMetrics({
    slots: runtime.slots,
    providers: runtime.providers,
    usageLogs,
    todayTokens: runtime.todayCosts.totalTokens,
    browserStatus,
  }), [browserStatus, runtime, usageLogs]);
  const sections = getSettingsNavSections(language);
  const items = getSettingsNavItems(language);
  const performanceMode = systemReducedMotion ? 'fast' : preferences.performanceMode;
  const performanceLabel = getPerformanceModeLabel(performanceMode, pick);
  const remainingBalance = billingLoading
    ? '...'
    : `${formatRemainingCredits(balance, locale)} ${pick('积分', 'credits')}`;
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
      id: 'calls',
      label: pick('API 调用', 'API calls'),
      value: `${metrics.successfulApiCalls} / ${metrics.failedApiCalls}`,
      helper: pick('成功 / 失败', 'Success / failed'),
      icon: Activity,
      tone: metrics.failedApiCalls > 0 ? 'warm' : 'accent',
    },
    {
      id: 'tokens',
      label: pick('累计 Tokens', 'Total tokens'),
      value: formatCompact(metrics.totalTokens),
      helper: pick('全部能力来源', 'All capability sources'),
      icon: KeyRound,
      tone: 'accent',
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
      id: 'latency',
      label: pick('当前延迟', 'Current latency'),
      value: metrics.latencyMs == null ? '--' : `${metrics.latencyMs} ms`,
      helper: metrics.latencySourceName
        ? `${metrics.latencySource === 'recent' ? pick('最近', 'Recent') : pick('最快', 'Fastest')} · ${metrics.latencySourceName}`
        : pick('暂无调用样本', 'No request sample'),
      icon: Clock3,
      tone: metrics.latencyMs != null && metrics.latencyMs <= 1_000 ? 'success' : 'neutral',
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
    {
      id: 'performance',
      label: pick('网页表现', 'Web performance'),
      value: performanceLabel,
      helper: systemReducedMotion
        ? pick('跟随系统减少动态', 'System reduced motion')
        : pick('动效与玻璃效果', 'Motion and glass effects'),
      icon: CircleGauge,
      tone: performanceMode === 'fast' ? 'success' : 'accent',
    },
  ];

  const getItemStatus = (view: CanonicalSettingsViewId) => {
    if (view === 'capability-sources' || view === 'provider-routes') {
      return pick(`${metrics.availableRoutes} 可用`, `${metrics.availableRoutes} ready`);
    }
    if (view === 'browser-assistant') {
      return pick(`${metrics.authenticatedBrowserAccounts} 已认证`, `${metrics.authenticatedBrowserAccounts} signed in`);
    }
    if (view === 'appearance-motion') return performanceLabel;
    return null;
  };

  return (
    <div className="settings-mobile-dashboard text-[var(--text-primary)]" data-testid="settings-mobile-dashboard">
      <section className="settings-mobile-overview" aria-labelledby="settings-mobile-overview-title">
        <header className="settings-mobile-overview__header">
          <div className="min-w-0">
            <p className="settings-mobile-overview__kicker">{pick('实时概况', 'Live overview')}</p>
            <h2 id="settings-mobile-overview-title" className="settings-mobile-overview__title">
              {pick('创作系统状态', 'Creative system status')}
            </h2>
          </div>
          <button
            type="button"
            className="settings-mobile-performance-button"
            onClick={() => onNavigate('appearance-motion')}
            aria-label={pick(`网页性能：${performanceLabel}，前往调整`, `Web performance: ${performanceLabel}. Open settings`)}
          >
            <CircleGauge size={16} />
            <span>{performanceLabel}</span>
            <ChevronRight size={14} />
          </button>
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
      </section>

      <nav className="settings-mobile-navigation" aria-label={pick('设置分类', 'Settings categories')}>
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section.id && item.id !== 'dashboard');
          return (
            <section key={section.id} className="settings-mobile-navigation__section" aria-labelledby={`settings-mobile-section-${section.id}`}>
              <h2 id={`settings-mobile-section-${section.id}`} className="settings-mobile-navigation__heading">
                {section.label}
              </h2>
              <div className="settings-mobile-navigation__list">
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  const itemStatus = getItemStatus(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className="settings-mobile-navigation__item"
                      data-tone={getNavigationTone(item.id)}
                    >
                      <span className="settings-mobile-navigation__icon"><Icon size={18} /></span>
                      <span className="settings-mobile-navigation__copy">
                        <span className="settings-mobile-navigation__title">{item.label}</span>
                        <span className="settings-mobile-navigation__description">{item.description}</span>
                      </span>
                      {itemStatus && <span className="settings-mobile-navigation__status">{itemStatus}</span>}
                      <ChevronRight size={16} className="settings-mobile-navigation__chevron" />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
    </div>
  );
};

export default SettingsMobileDashboard;
