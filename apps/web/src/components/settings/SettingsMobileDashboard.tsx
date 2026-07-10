import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  ChevronRight,
  CircleGauge,
  Cloud,
  Coins,
  Globe,
  KeyRound,
  Laptop,
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
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
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
  getSettingsModules,
  type CanonicalSettingsViewId,
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
  const { balance, loading: billingLoading } = useBilling();
  const [routePreference, setRoutePreference] = useState<QuickGenerationRoute>(readQuickGenerationRoute);
  const [canvasMode, setCanvasMode] = useState(readCanvasPerformanceMode);
  const [runtime, setRuntime] = useState(() => ({
    slots: keyManager.getSlots(),
    providers: keyManager.getProviders(),
  }));
  const [browserStatus, setBrowserStatus] = useState<BrowserBridgeStatusSnapshot>(EMPTY_BROWSER_STATUS);

  useEffect(() => keyManager.subscribe(() => setRuntime({
    slots: keyManager.getSlots(),
    providers: keyManager.getProviders(),
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

  const modules = useMemo(
    () => getSettingsModules(language).filter((module) => module.id !== 'overview'),
    [language],
  );
  const activePreset = getActivePerformancePreset(preferences, canvasMode);
  const validRoutes = runtime.slots.filter((slot) => !slot.disabled && slot.status === 'valid').length
    + runtime.providers.filter((provider) => provider.isActive && provider.status === 'active').length;
  const browserReady = browserStatus.daemonStatus === 'connected' && browserStatus.extensionStatus === 'connected';
  const remainingBalance = billingLoading ? '...' : formatRemainingCredits(balance, locale);

  const routeOptions: Array<{ id: QuickGenerationRoute; label: string; icon: typeof Laptop }> = [
    { id: 'local', label: pick('本地优先', 'Local first'), icon: Laptop },
    { id: 'cloud', label: pick('服务器优先', 'Server first'), icon: Cloud },
  ];
  const performanceOptions: Array<{ id: WebPerformanceMode; label: string }> = [
    { id: 'fast', label: pick('快速', 'Fast') },
    { id: 'balanced', label: pick('正常', 'Normal') },
    { id: 'visual', label: pick('性能', 'Performance') },
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
            <p className="settings-mobile-overview__kicker">{pick('设置总览', 'Settings overview')}</p>
            <h2 id="settings-mobile-overview-title" className="settings-mobile-overview__title">
              {pick('工作区策略', 'Workspace strategy')}
            </h2>
          </div>
          <span className="settings-mobile-overview__health" data-state={validRoutes > 0 ? 'ready' : 'setup'}>
            <ShieldCheck size={14} />
            {validRoutes > 0 ? pick('可用', 'Ready') : pick('待配置', 'Setup')}
          </span>
        </header>

        <div className="settings-mobile-quick-stack">
          <div className="settings-mobile-quick-control">
            <div className="settings-mobile-quick-control__label">
              <span>{pick('默认执行位置', 'Default execution')}</span>
              <strong>{routePreference === 'local' ? pick('本地优先', 'Local first') : pick('服务器优先', 'Server first')}</strong>
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
              <strong>{activePreset === 'manual' ? pick('手动', 'Manual') : performanceOptions.find((option) => option.id === activePreset)?.label}</strong>
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

        <div className="settings-mobile-capability-strip">
          <button type="button" onClick={() => onNavigate('capability-sources')} data-ai-settings-target="capability-sources">
            <KeyRound size={15} />
            <span>{pick('API 链路', 'API routes')}</span>
            <strong>{validRoutes}</strong>
          </button>
          <button type="button" onClick={() => onNavigate('browser-assistant')} data-ai-settings-target="browser-assistant">
            <Globe size={15} />
            <span>{pick('浏览器助手', 'Browser assistant')}</span>
            <strong>{browserReady ? pick('在线', 'Online') : pick('待连接', 'Offline')}</strong>
          </button>
        </div>
      </section>

      <nav className="settings-mobile-module-list" aria-label={pick('设置模块', 'Settings modules')}>
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onNavigate(module.target)}
              className="settings-mobile-module-card"
              data-module={module.id}
              data-ai-settings-target={module.target}
            >
              <span className="settings-mobile-module-card__icon"><Icon size={19} /></span>
              <span className="min-w-0 flex-1 text-left">
                <strong>{module.label}</strong>
                <span>{module.description}</span>
              </span>
              {module.id === 'ai' ? <Bot size={14} className="settings-mobile-module-card__state" /> : <CircleGauge size={14} className="settings-mobile-module-card__state" />}
              <ChevronRight size={16} />
            </button>
          );
        })}
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
