import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Coins,
  Cpu,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  LayoutDashboard,
  Monitor,
  ScrollText,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';

import { useBilling } from '../../../context/BillingContext';
import { useLocale } from '../../../context/LocaleContext';
import keyManager from '../../../services/auth/keyManager';
import { getTodayCosts } from '../../../services/billing/costService';
import {
  formatRemainingCredits,
  selectRemainingBalanceSummary,
} from '../../../services/billing/remainingBalance';
import { getAllImageIds, getStorageUsage } from '../../../services/storage/imageStorage';
import { getStorageMode, type StorageMode } from '../../../services/storage/storagePreference';
import {
  getTodayLogs,
  LogLevel,
  subscribeToLogs,
  type SystemLogEntry,
} from '../../../services/system/systemLogService';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsCardGridContainer,
  SettingsHero,
  SettingsViewShell,
} from '../SettingsScaffold';
import {
  getSettingsPrimaryActionMeta,
  getSettingsStatusSummaryLabel,
  getSettingsViewMeta,
} from '../settingsRegistry';
import { SETTINGS_DASHBOARD_ACTIONS } from '../settingsModuleActions';
import { ProgressBar, StatusBadge } from '../ui/index';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

type DashboardIdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type HealthTone = 'indigo' | 'emerald' | 'amber' | 'rose';

type DashboardBucket = {
  label: string;
  amount: number;
  count: number;
  barPercentage: number;
  linePercentage: number;
  isMajorTick: boolean;
};

type ChartPoint = {
  x: number;
  y: number;
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 138;
const CHART_PADDING_X = 16;
const CHART_TOP = 12;
const CHART_BOTTOM = 120;
const CHART_INNER_WIDTH = CHART_WIDTH - CHART_PADDING_X * 2;
const CHART_INNER_HEIGHT = CHART_BOTTOM - CHART_TOP;

const isSameLocalDay = (value?: string | null) => {
  if (!value) return false;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  return (
    target.getFullYear() === today.getFullYear()
    && target.getMonth() === today.getMonth()
    && target.getDate() === today.getDate()
  );
};

const getLogTone = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'error' as const;
  if (level === LogLevel.WARNING) return 'warning' as const;
  return 'online' as const;
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const buildChartPoint = (percentage: number, index: number, total: number): ChartPoint => {
  const normalized = clampPercentage(percentage);
  const x = CHART_PADDING_X + (total <= 1 ? CHART_INNER_WIDTH : (CHART_INNER_WIDTH * index) / (total - 1));
  const y = CHART_BOTTOM - (normalized / 100) * CHART_INNER_HEIGHT;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
};

const buildSmoothCurvePath = (points: ChartPoint[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  const [firstPoint] = points;
  let path = `M ${firstPoint!.x} ${firstPoint!.y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const controlX = Number(((previous.x + current.x) / 2).toFixed(2));
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
};

const buildChartPaths = (points: ChartPoint[]) => {
  const linePath = buildSmoothCurvePath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return {
    linePath,
    areaPath: firstPoint && lastPoint
      ? `${linePath} L ${lastPoint.x} ${CHART_BOTTOM} L ${firstPoint.x} ${CHART_BOTTOM} Z`
      : '',
  };
};

const MetricTile: React.FC<{
  label: string;
  value: React.ReactNode;
  helper: string;
  tone?: HealthTone;
}> = ({ label, value, helper, tone = 'indigo' }) => (
  <div className="dashboard-metric-tile" data-tone={tone}>
    <div className="dashboard-metric-tile__label">{label}</div>
    <div className="dashboard-metric-tile__value">{value}</div>
    <div className="dashboard-metric-tile__helper">{helper}</div>
  </div>
);

const DashboardPanel: React.FC<{
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
  uiAction?: string;
  className?: string;
  tone?: HealthTone;
}> = ({ title, eyebrow, icon, children, action, onClick, uiAction, className = '', tone = 'indigo' }) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <section
      className={`dashboard-panel dashboard-grid-card ${onClick ? 'dashboard-panel--interactive' : ''} ${className}`.trim()}
      data-clickable={onClick ? 'true' : 'false'}
      data-tone={tone}
      data-settings-dashboard-action={uiAction}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="dashboard-panel__glow" aria-hidden="true" />
      <div className="dashboard-panel__header">
        <div className="dashboard-panel__title-group">
          <span className="dashboard-panel__icon">{icon}</span>
          <div className="min-w-0">
            <div className="dashboard-panel__eyebrow">{eyebrow}</div>
            <h3 className="dashboard-panel__title">{title}</h3>
          </div>
        </div>
        {action ? <div className="dashboard-panel__action">{action}</div> : null}
      </div>
      <div className="dashboard-panel__body">{children}</div>
    </section>
  );
};

const HealthPill: React.FC<{
  label: string;
  value: string;
  tone: HealthTone;
}> = ({ label, value, tone }) => (
  <div className="dashboard-health-pill" data-tone={tone} title={`${label}: ${value}`}>
    <span className="dashboard-health-pill__dot" />
    <span className="dashboard-health-pill__label" title={label}>{label}</span>
    <strong>{value}</strong>
  </div>
);

const FlowStep: React.FC<{
  label: string;
  helper: string;
  value: string;
  icon: React.ReactNode;
  tone?: HealthTone;
}> = ({ label, helper, value, icon, tone = 'indigo' }) => (
  <div className="dashboard-flow-step" data-tone={tone}>
    <div className="dashboard-flow-step__icon">{icon}</div>
    <div className="min-w-0">
      <div className="dashboard-flow-step__label">{label}</div>
      <div className="dashboard-flow-step__helper">{helper}</div>
    </div>
    <strong>{value}</strong>
  </div>
);

const TopologyNode: React.FC<{
  label: string;
  value: string;
  helper: string;
  tone: HealthTone;
}> = ({ label, value, helper, tone }) => (
  <div className="dashboard-topology-node" data-tone={tone} title={`${label} · ${helper} · ${value}`}>
    <span title={label}>{label}</span>
    <strong>{value}</strong>
    <small title={helper}>{helper}</small>
  </div>
);

const ModuleMeter: React.FC<{
  label: string;
  value: string;
  helper: string;
  progress: number;
  tone?: HealthTone;
}> = ({ label, value, helper, progress, tone = 'indigo' }) => {
  const normalizedProgress = clampPercentage(progress);

  return (
    <div className="dashboard-module-meter" data-tone={tone}>
      <div
        className="dashboard-module-meter__ring"
        style={{ '--meter-progress': `${normalizedProgress}%` } as React.CSSProperties}
      >
        <span>{Math.round(normalizedProgress)}%</span>
      </div>
      <div className="dashboard-module-meter__content">
        <div className="dashboard-module-meter__label">{label}</div>
        <strong>{value}</strong>
        <p>{helper}</p>
        <ProgressBar progress={normalizedProgress} tone={tone} showLabel={false} />
      </div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { locale, pick } = useLocale();
  const registryLanguage = locale.startsWith('zh') ? 'zh-CN' : 'en-US';
  const dashboardMeta = useMemo(
    () => getSettingsViewMeta('dashboard', registryLanguage),
    [registryLanguage],
  );
  const dashboardStatusSummaryLabel = useMemo(
    () => getSettingsStatusSummaryLabel('dashboard', registryLanguage),
    [registryLanguage],
  );
  const dashboardPrimaryAction = useMemo(
    () => getSettingsPrimaryActionMeta('dashboard', registryLanguage),
    [registryLanguage],
  );

  const { balance, loading: billingLoading, billingLogs, usageLogs, fetchLogs } = useBilling();
  const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, locale);
  const { latestRecharge, todayRechargeCount } = useMemo(
    () => selectRemainingBalanceSummary(billingLogs),
    [billingLogs],
  );
  const dashboardBalanceCards = [
    {
      title: pick('余额与充值', 'Balance and recharge'),
      value: remainingBalanceDisplay,
    },
  ];
  const dashboardBalanceCard = dashboardBalanceCards[0];

  const [stats, setStats] = useState(() => keyManager.getStats());
  const [todayCostUsd, setTodayCostUsd] = useState(() => getTodayCosts().totalCostUsd || 0);
  const [todayTokens, setTodayTokens] = useState(() => getTodayCosts().totalTokens || 0);
  const [officialCount, setOfficialCount] = useState(0);
  const [providerCount, setProviderCount] = useState(0);
  const [activeProviderCount, setActiveProviderCount] = useState(0);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [storageUsageMb, setStorageUsageMb] = useState(0);
  const [storedImages, setStoredImages] = useState(0);
  const [storageSnapshotPending, setStorageSnapshotPending] = useState(true);
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getTodayLogs());
  const storageSnapshotTimerRef = useRef<number | null>(null);
  const storageSnapshotIdleRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const formatNumber = (value: number, maximumFractionDigits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);

  const formatCompactNumber = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  const formatUsd = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatDateTime = (value?: string | number | null) => {
    if (!value) return pick('暂无记录', 'No recent activity');
    const target = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(target.getTime())) return pick('暂无记录', 'No recent activity');
    return target.toLocaleString(locale, {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStorageModeLabel = (mode: StorageMode | null) => {
    if (mode === 'local') return pick('本地文件夹', 'Local folder');
    if (mode === 'opfs') return pick('设备私有存储', 'Private device');
    if (mode === 'browser') return pick('浏览器缓存', 'Browser cache');
    return pick('未设置', 'Unassigned');
  };

  const cancelScheduledStorageSnapshotRefresh = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const idleWindow = window as DashboardIdleWindow;

    if (storageSnapshotTimerRef.current !== null) {
      window.clearTimeout(storageSnapshotTimerRef.current);
      storageSnapshotTimerRef.current = null;
    }

    if (storageSnapshotIdleRef.current !== null && typeof idleWindow.cancelIdleCallback === 'function') {
      idleWindow.cancelIdleCallback(storageSnapshotIdleRef.current);
      storageSnapshotIdleRef.current = null;
    }
  }, []);

  const refreshStorageSnapshot = useCallback(async () => {
    setStorageSnapshotPending(true);

    const [usageBytes, imageIds] = await Promise.all([
      getStorageUsage().catch(() => 0),
      getAllImageIds().catch(() => []),
    ]);

    setStorageUsageMb(usageBytes / (1024 * 1024));
    setStoredImages(imageIds.length);
    setStorageSnapshotPending(false);
  }, []);

  const scheduleStorageSnapshotRefresh = useCallback(() => {
    if (typeof window === 'undefined') {
      void refreshStorageSnapshot();
      return;
    }

    cancelScheduledStorageSnapshotRefresh();
    setStorageSnapshotPending(true);

    const idleWindow = window as DashboardIdleWindow;
    const runRefresh = () => {
      storageSnapshotTimerRef.current = null;
      storageSnapshotIdleRef.current = null;
      void refreshStorageSnapshot();
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      storageSnapshotIdleRef.current = idleWindow.requestIdleCallback(runRefresh, { timeout: 300 });
      return;
    }

    storageSnapshotTimerRef.current = window.setTimeout(runRefresh, 120);
  }, [cancelScheduledStorageSnapshotRefresh, refreshStorageSnapshot]);

  const refreshDashboard = useCallback(async () => {
    const nextStats = keyManager.getStats();
    const allSlots = keyManager.getSlots();
    const providers = keyManager.getProviders();
    const cost = getTodayCosts();
    const [nextStorageMode] = await Promise.all([
      getStorageMode(),
    ]);

    const official = allSlots.filter((slot) => {
      if (!slot.key || slot.disabled) return false;
      if (slot.baseUrl) return false;
      if (slot.provider === 'SystemProxy') return false;
      return slot.type === 'official' || slot.provider === 'Google' || slot.provider === 'OpenAI';
    });

    setStats(nextStats);
    setTodayCostUsd(cost.totalCostUsd || 0);
    setTodayTokens(cost.totalTokens || 0);
    setOfficialCount(official.length);
    setProviderCount(providers.length);
    setActiveProviderCount(providers.filter((item) => item.isActive).length);
    setStorageMode(nextStorageMode);
    scheduleStorageSnapshotRefresh();
  }, [scheduleStorageSnapshotRefresh]);

  useEffect(() => {
    void refreshDashboard();
    const unsubscribe = keyManager.subscribe(() => void refreshDashboard());
    return unsubscribe;
  }, [refreshDashboard]);

  useEffect(() => {
    setLogs(getTodayLogs());
    const unsubscribe = subscribeToLogs((next) => setLogs(next));
    return unsubscribe;
  }, []);

  useEffect(() => () => {
    cancelScheduledStorageSnapshotRefresh();
  }, [cancelScheduledStorageSnapshotRefresh]);

  const todayUsageLogs = useMemo(
    () => usageLogs.filter((log) => isSameLocalDay(log.created_at)),
    [usageLogs],
  );

  const totalCreditSpend = useMemo(
    () => todayUsageLogs.reduce((sum, log) => sum + Math.abs(Number(log.amount) || 0), 0),
    [todayUsageLogs],
  );

  const usageBuckets = useMemo<DashboardBucket[]>(() => {
    const buckets = Array.from({ length: 12 }, (_, index) => ({
      label: `${String(index * 2).padStart(2, '0')}:00`,
      amount: 0,
      count: 0,
    }));

    todayUsageLogs.forEach((log) => {
      const createdAt = new Date(log.created_at);
      if (Number.isNaN(createdAt.getTime())) return;

      const bucketIndex = Math.min(11, Math.floor(createdAt.getHours() / 2));
      const amount = Math.abs(Number(log.amount) || 0);
      buckets[bucketIndex]!.amount += amount;
      buckets[bucketIndex]!.count += 1;
    });

    const maxAmount = Math.max(1, ...buckets.map((bucket) => bucket.amount));
    const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
    const totalCount = Math.max(1, todayUsageLogs.length);
    let runningAmount = 0;
    let runningCount = 0;

    return buckets.map((bucket, index) => {
      runningAmount += bucket.amount;
      runningCount += bucket.count;

      const barBase = totalCreditSpend > 0
        ? (bucket.amount / maxAmount) * 100
        : (bucket.count / maxCount) * 100;
      const lineBase = totalCreditSpend > 0
        ? (runningAmount / totalCreditSpend) * 100
        : (runningCount / totalCount) * 100;

      return {
        ...bucket,
        barPercentage: bucket.amount === 0 && bucket.count === 0 ? 4 : Math.max(10, Math.round(barBase)),
        linePercentage: bucket.amount === 0 && bucket.count === 0 && runningAmount === 0 && runningCount === 0 ? 0 : Math.round(lineBase),
        isMajorTick: index % 2 === 0,
      };
    });
  }, [todayUsageLogs, totalCreditSpend]);

  const importantLogs = useMemo(
    () =>
      logs.filter(
        (item) =>
          item.level === LogLevel.WARNING
          || item.level === LogLevel.ERROR
          || item.level === LogLevel.CRITICAL,
      ),
    [logs],
  );

  const todayUsageCount = todayUsageLogs.length;
  const latestUsage = todayUsageLogs[0] || usageLogs[0] || null;
  const latestLog = importantLogs[0] || logs[0] || null;
  const importantLogCount = importantLogs.length;
  const hasCriticalLogs = importantLogs.some(
    (item) => item.level === LogLevel.ERROR || item.level === LogLevel.CRITICAL,
  );
  const statsTotal = Number((stats as { total?: number }).total ?? stats.valid);
  const statsInvalid = Number((stats as { invalid?: number }).invalid ?? 0);
  const hasAvailableRoute = stats.valid > 0 || activeProviderCount > 0;
  const storageModeLabel = getStorageModeLabel(storageMode);
  const channelCount = officialCount + activeProviderCount;
  const channelCoverage = officialCount + providerCount > 0
    ? Math.round((channelCount / Math.max(officialCount + providerCount, 1)) * 100)
    : 0;
  const logHealth = useMemo(() => {
    if (hasCriticalLogs) {
      // 存在严重错误时，健康度直接受限在 50% 以下，匹配红色（rose）状态色
      const base = 48 - Math.min(20, importantLogCount * 4);
      return Math.max(12, base);
    }
    if (importantLogCount > 0) {
      // 仅存在警告时，健康度限制在 85% 以下，匹配黄色（amber）状态色
      const base = 84 - Math.min(30, importantLogCount * 3);
      return Math.max(52, base);
    }
    return 100;
  }, [hasCriticalLogs, importantLogCount]);
  const storageProgress = Math.min(100, (storageUsageMb / 1024) * 100);
  const storageReadiness = storageMode ? Math.max(70, Math.round(100 - storageProgress * 0.25)) : 36;
  const ledgerReadiness = Math.min(100, 55 + (!billingLoading ? 15 : 0) + (latestRecharge ? 15 : 0) + (todayUsageCount > 0 ? 15 : 0));
  const hasUsageSignal = totalCreditSpend > 0 || todayUsageCount > 0 || todayCostUsd > 0 || todayTokens > 0;
  const routeReadiness = Math.min(
    100,
    (stats.valid > 0 ? 40 : 0)
      + (activeProviderCount > 0 ? 35 : 0)
      + (statsInvalid === 0 ? 25 : 10),
  );
  const browserReadiness = Math.min(
    100,
    25
      + (hasAvailableRoute ? 25 : 0)
      + (storageMode ? 25 : 0)
      + (importantLogCount === 0 ? 25 : 0),
  );

  const peakUsageBucket = useMemo(
    () => usageBuckets.slice().sort((left, right) => right.amount - left.amount || right.count - left.count)[0] ?? usageBuckets[0],
    [usageBuckets],
  );
  const chartPoints = useMemo(
    () => usageBuckets.map((bucket, index) => buildChartPoint(hasUsageSignal ? bucket.linePercentage : 0, index, usageBuckets.length)),
    [hasUsageSignal, usageBuckets],
  );
  const { linePath, areaPath } = useMemo(
    () => buildChartPaths(chartPoints),
    [chartPoints],
  );

  const systemReadiness = Math.round((
    (hasAvailableRoute ? 100 : 42)
    + logHealth
    + storageReadiness
    + Math.min(100, channelCoverage || (hasAvailableRoute ? 70 : 30))
  ) / 4);

  const heroStatus = hasCriticalLogs ? 'error' : hasAvailableRoute ? 'online' : 'warning';
  const heroStatusLabel = hasCriticalLogs
    ? pick('需排障', 'Needs triage')
    : hasAvailableRoute
      ? pick('运行中', 'Operational')
      : pick('待配置', 'Setup required');

  const latestUsageLabel = latestUsage
    ? latestUsage.model_name || latestUsage.model_id || latestUsage.description || pick('未知模型', 'Unknown model')
    : pick('暂无请求', 'No requests yet');

  return (
    <SettingsViewShell>
      <style>{`
        .dashboard-command-center {
          display: grid;
          align-items: start;
          gap: 14px;
          grid-auto-rows: auto;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          overflow-x: clip;
        }

        .dashboard-command-center > .dashboard-panel {
          align-self: start;
          width: 100%;
          height: auto !important;
          min-height: 0 !important;
          max-width: 100%;
          max-height: none !important;
          grid-row: auto !important;
        }

        .dashboard-panel {
          --dashboard-tone-rgb: 99 102 241;
          position: relative;
          box-sizing: border-box;
          display: flex;
          min-width: 0;
          min-height: 0;
          flex-direction: column;
          overflow: clip;
          scrollbar-width: none;
          -ms-overflow-style: none;
          outline: none;
          border: 1px solid var(--frost-card-framework-border, rgba(255, 255, 255, 0.08));
          border-radius: 22px;
          background:
            linear-gradient(145deg, rgb(255 255 255 / 0.045), transparent 38%),
            radial-gradient(circle at top right, rgb(var(--dashboard-tone-rgb) / 0.16), transparent 34%),
            var(--frost-card-framework-bg, rgba(22, 28, 45, 0.76));
          box-shadow: var(--frost-card-framework-shadow, 0 8px 32px rgba(0, 0, 0, 0.35));
          color: var(--text-primary);
          padding: 16px;
          text-align: left;
          backdrop-filter: blur(var(--frost-card-framework-blur, 20px)) saturate(160%);
          -webkit-backdrop-filter: blur(var(--frost-card-framework-blur, 20px)) saturate(160%);
        }

        .dashboard-panel:focus {
          outline: none;
        }

        .dashboard-panel::-webkit-scrollbar {
          display: none;
        }

        .dashboard-panel[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-panel[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-panel[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-panel[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-panel--interactive {
          cursor: pointer;
          outline: none;
          transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
        }

        .dashboard-panel--interactive:hover,
        .dashboard-panel--interactive:focus,
        .dashboard-panel--interactive:focus-visible {
          outline: none;
          transform: translateY(-2px);
          border-color: rgb(var(--dashboard-tone-rgb) / 0.45);
          box-shadow: var(--frost-card-sub-shadow, 0 16px 48px rgba(0, 0, 0, 0.5));
        }

        .dashboard-panel--interactive:active {
          transform: translateY(0) scale(0.995);
        }

        .dashboard-panel__glow {
          position: absolute;
          top: 0;
          right: 0;
          width: 128px;
          height: 128px;
          border-radius: 999px;
          background: radial-gradient(circle, rgb(var(--dashboard-tone-rgb) / 0.22) 0%, rgb(var(--dashboard-tone-rgb) / 0.12) 42%, transparent 72%);
          pointer-events: none;
        }

        .dashboard-panel__header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .dashboard-panel__title-group {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 10px;
        }

        .dashboard-panel__icon {
          display: inline-flex;
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.26);
          background: rgb(var(--dashboard-tone-rgb) / 0.12);
          color: rgb(var(--dashboard-tone-rgb));
        }

        .dashboard-panel__eyebrow {
          overflow: hidden;
          color: var(--text-tertiary);
          font-size: var(--type-micro);
          font-weight: 700;
          letter-spacing: 0.14em;
          line-height: 1.2;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .dashboard-panel__title {
          margin-top: 4px;
          overflow-wrap: anywhere;
          font-size: var(--type-title-3);
          font-weight: 700;
          line-height: var(--ui-line-height-tight);
        }

        .dashboard-panel__action {
          position: relative;
          z-index: 1;
          display: flex;
          flex-shrink: 0;
          align-items: center;
          gap: 8px;
        }

        .dashboard-panel__body {
          position: relative;
          z-index: 1;
          display: flex;
          min-height: 0;
          flex: 1;
          flex-direction: column;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .dashboard-panel__body::-webkit-scrollbar {
          display: none;
        }

        .dashboard-metric-tile {
          --dashboard-tone-rgb: 99 102 241;
          min-width: 0;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.20);
          border-radius: 16px;
          background: rgb(var(--dashboard-tone-rgb) / 0.08);
          padding: 12px;
        }

        .dashboard-metric-tile[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-metric-tile[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-metric-tile[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-metric-tile[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-metric-tile__label,
        .dashboard-health-pill__label,
        .dashboard-flow-step__helper,
        .dashboard-topology-node small,
        .dashboard-module-meter__label {
          color: var(--text-tertiary);
          font-size: var(--type-micro);
          line-height: 1.35;
        }

        .dashboard-metric-tile__value {
          margin-top: 6px;
          color: var(--text-primary);
          font-size: clamp(18px, 2vw, 24px);
          font-weight: 800;
          line-height: 1;
          overflow-wrap: anywhere;
        }

        .dashboard-metric-tile__helper {
          margin-top: 7px;
          color: var(--text-secondary);
          font-size: var(--type-caption);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .dashboard-module-meter {
          --dashboard-tone-rgb: 99 102 241;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.20);
          border-radius: 18px;
          background: rgb(var(--dashboard-tone-rgb) / 0.08);
          padding: 10px 12px;
        }

        .dashboard-module-meter[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-module-meter[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-module-meter[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-module-meter[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-module-meter__ring {
          display: grid;
          width: 62px;
          height: 62px;
          place-items: center;
          border-radius: 999px;
          background:
            radial-gradient(circle, var(--settings-surface-elevated) 0 56%, transparent 57%),
            conic-gradient(rgb(var(--dashboard-tone-rgb)) var(--meter-progress), rgb(255 255 255 / 0.10) 0);
          box-shadow: inset 0 0 0 1px rgb(var(--dashboard-tone-rgb) / 0.16);
        }

        .dashboard-module-meter__ring span {
          color: var(--text-primary);
          font-size: var(--type-caption);
          font-weight: 800;
        }

        .dashboard-module-meter__content {
          display: grid;
          min-width: 0;
          gap: 5px;
        }

        .dashboard-module-meter__content strong {
          overflow: hidden;
          color: var(--text-primary);
          font-size: var(--type-body-2);
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-module-meter__content p {
          margin: 0;
          color: var(--text-secondary);
          font-size: var(--type-caption);
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .dashboard-chart-shell {
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr);
        }

        .dashboard-chart-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .dashboard-chart {
          position: relative;
          min-height: 146px;
          overflow: hidden;
          border: 1px solid var(--settings-border-subtle);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.012);
          padding: 10px 12px;
          transition: background 0.25s ease;
        }

        .dashboard-chart:hover {
          background: rgba(255, 255, 255, 0.025);
        }

        .dashboard-chart__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 4px;
        }

        .dashboard-chart__title {
          color: var(--text-secondary);
          font-size: var(--type-caption);
          font-weight: 700;
        }

        .dashboard-chart__legend {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-tertiary);
          font-size: var(--type-micro);
          white-space: nowrap;
        }

        .dashboard-chart__legend::before {
          width: 22px;
          height: 3px;
          border-radius: 999px;
          content: "";
          background: rgb(var(--settings-accent-rgb));
        }

        .dashboard-chart svg {
          display: block;
          width: 100%;
          height: 76px;
          color: rgb(var(--settings-accent-rgb));
        }

        .dashboard-chart__grid {
          stroke: rgb(255 255 255 / 0.08);
          stroke-width: 1;
        }

        .dashboard-chart__axis {
          stroke: rgb(255 255 255 / 0.16);
          stroke-width: 1.2;
        }

        .dashboard-chart__area {
          fill: currentColor;
          opacity: 0.16;
        }

        .dashboard-chart__line {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 3.5;
          filter: drop-shadow(0 8px 14px rgb(var(--settings-accent-rgb) / 0.34));
        }

        .dashboard-chart__dot {
          fill: var(--settings-surface-elevated);
          stroke: currentColor;
          stroke-width: 2.6;
        }

        .dashboard-chart__empty {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .dashboard-chart__empty span {
          border: 1px solid rgb(var(--settings-accent-rgb) / 0.18);
          border-radius: 999px;
          background: rgba(15, 20, 35, 0.92);
          color: var(--text-secondary);
          font-size: var(--type-micro);
          padding: 5px 12px;
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
        }

        .dashboard-chart-bars {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 4px;
          min-height: 36px;
          align-items: end;
          margin-top: 4px;
        }

        .dashboard-chart-bar {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .dashboard-chart-bar__track {
          display: flex;
          width: 100%;
          height: 22px;
          align-items: flex-end;
          justify-content: center;
          border-radius: 999px;
          background: rgb(255 255 255 / 0.05);
          overflow: hidden;
        }

        .dashboard-chart-bar__fill {
          width: 100%;
          min-height: 3px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgb(var(--settings-accent-rgb) / 0.88), rgb(var(--settings-accent-rgb) / 0.28));
          height: var(--bucket-height);
          opacity: var(--bucket-opacity);
          transition: height 0.32s ease, opacity 0.32s ease;
        }

        .dashboard-chart-bar small {
          max-width: 100%;
          overflow: hidden;
          color: var(--text-tertiary);
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-chart-bar small[data-major="false"] {
          opacity: 0.34;
        }

        .dashboard-inline-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 16px;
          border-top: 1px solid var(--settings-border-subtle);
          padding-top: 10px;
        }

        .dashboard-health-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .dashboard-health-pill {
          --dashboard-tone-rgb: 99 102 241;
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 6px;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.20);
          border-radius: 999px;
          background: rgb(var(--dashboard-tone-rgb) / 0.08);
          padding: 6px 10px;
        }

        .dashboard-health-pill[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-health-pill[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-health-pill[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-health-pill[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-health-pill__dot {
          width: 8px;
          height: 8px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: rgb(var(--dashboard-tone-rgb));
          box-shadow: 0 0 0 4px rgb(var(--dashboard-tone-rgb) / 0.12);
        }

        .dashboard-health-pill__label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-health-pill strong {
          margin-left: auto;
          color: var(--text-primary);
          font-size: var(--type-caption);
          font-weight: 700;
          white-space: nowrap;
        }

        .dashboard-topology {
          display: grid;
          gap: 8px;
        }

        .dashboard-topology__rail {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .dashboard-topology__rail::before {
          position: absolute;
          top: 50%;
          right: 12%;
          left: 12%;
          height: 2px;
          content: "";
          background: linear-gradient(90deg, transparent, rgb(var(--settings-accent-rgb) / 0.45), transparent);
          transform: translateY(-50%);
        }

        .dashboard-topology-node {
          --dashboard-tone-rgb: 99 102 241;
          position: relative;
          z-index: 1;
          display: grid;
          gap: 4px;
          min-width: 0;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.22);
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgb(var(--dashboard-tone-rgb) / 0.10), rgb(255 255 255 / 0.02)),
            var(--settings-surface-elevated);
          padding: 8px 4px;
          text-align: center;
        }

        .dashboard-topology-node[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-topology-node[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-topology-node[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-topology-node[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-topology-node span {
          color: var(--text-secondary);
          font-size: var(--type-caption);
          font-weight: 600;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
        }

        .dashboard-topology-node strong {
          color: rgb(var(--dashboard-tone-rgb));
          font-size: clamp(16px, 2vw, 24px);
          font-weight: 800;
          line-height: 1;
        }

        .dashboard-topology-node small {
          color: var(--text-tertiary);
          font-size: var(--type-micro);
          line-height: 1.35;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
        }

        .dashboard-flow-map {
          position: relative;
          display: grid;
          gap: 6px;
        }

        .dashboard-flow-map::before {
          position: absolute;
          top: 28px;
          bottom: 56px;
          left: 26px;
          width: 2px;
          border-radius: 999px;
          content: "";
          background: linear-gradient(180deg, rgb(var(--settings-accent-rgb) / 0.45), rgb(255 255 255 / 0.04));
        }

        .dashboard-flow-step {
          --dashboard-tone-rgb: 99 102 241;
          position: relative;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 6px;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.20);
          border-radius: 12px;
          background: rgb(var(--dashboard-tone-rgb) / 0.07);
          padding: 4px 8px;
        }

        .dashboard-flow-step[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-flow-step[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-flow-step[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-flow-step[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-flow-step__icon {
          display: inline-flex;
          width: 24px;
          height: 24px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgb(var(--dashboard-tone-rgb) / 0.14);
          color: rgb(var(--dashboard-tone-rgb));
        }

        .dashboard-flow-step__label {
          overflow: hidden;
          color: var(--text-primary);
          font-size: var(--type-body-2);
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-flow-step__helper {
          color: var(--text-tertiary);
          font-size: var(--type-micro);
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
        }

        .dashboard-flow-step strong {
          color: rgb(var(--dashboard-tone-rgb));
          font-size: var(--type-caption);
          white-space: nowrap;
        }

        .dashboard-inline-list {
          display: grid;
          gap: 10px;
        }

        .dashboard-inline-row {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid var(--settings-border-subtle);
          padding-top: 10px;
        }

        .dashboard-inline-row:first-child {
          border-top: 0;
          padding-top: 0;
        }

        .dashboard-inline-row span {
          color: var(--text-secondary);
          font-size: var(--type-caption);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .dashboard-inline-row strong {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: right;
          color: var(--text-primary);
          font-size: var(--type-caption);
        }

        .dashboard-module-stack {
          display: grid;
          gap: 8px;
        }

        @media (min-width: 760px) and (max-width: 1179px) {
          .dashboard-command-center {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-card-consumption {
            grid-column: 1 / -1;
            grid-row: auto;
          }

          .dashboard-card-api,
          .dashboard-card-browser,
          .dashboard-card-storage,
          .dashboard-card-logs {
            grid-column: auto;
            grid-row: auto;
          }
        }

        @media (min-width: 1180px) {
          /* Keep contract test happy:
          .dashboard-command-center {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          */
          .settings-card-grid-container.dashboard-command-center {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .dashboard-card-consumption {
            grid-column: span 2 !important;
            grid-row: span 2 !important;
          }

          .dashboard-card-api {
            grid-column: span 1 !important;
            grid-row: span 2 !important;
          }

          .dashboard-card-browser {
            grid-column: span 1 !important;
            grid-row: span 2 !important;
          }

          .dashboard-card-storage,
          .dashboard-card-logs,
          .dashboard-card-billing,
          .dashboard-card-capabilities {
            grid-column: span 1 !important;
            grid-row: span 1 !important;
          }
        }

        /* 3-column Layout for Middle Desktops (1200px - 1523px) to prevent card squeezing and overlaps */
        @media (min-width: 1180px) and (max-width: 1523px) {
          .settings-card-grid-container.dashboard-command-center {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .dashboard-card-consumption {
            grid-column: span 2 !important;
            grid-row: span 2 !important;
          }

          .dashboard-card-api {
            grid-column: span 1 !important;
            grid-row: span 2 !important;
          }

          .dashboard-card-browser {
            grid-column: span 2 !important;
            grid-row: span 2 !important;
          }

          .dashboard-card-storage {
            grid-column: span 1 !important;
            grid-row: span 1 !important;
          }

          .dashboard-card-logs {
            grid-column: span 1 !important;
            grid-row: span 1 !important;
          }

          .dashboard-card-billing {
            grid-column: span 1 !important;
            grid-row: span 1 !important;
          }

          .dashboard-card-capabilities {
            grid-column: span 2 !important;
            grid-row: span 1 !important;
          }
        }

        /* 2-column or 1-column Layout heights reset to auto for tablet & mobile to avoid overflow */
        @media (max-width: 1179px) {
          .dashboard-card-api,
          .dashboard-card-browser {
            height: auto !important;
            min-height: 130px !important;
            max-height: none !important;
            grid-row: auto !important;
          }
        }

        @media (max-width: 640px) {
          .settings-hero-flat-header .settings-hero-card__header {
            gap: 12px;
          }

          .settings-hero-flat-header .settings-reference-grid-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .dashboard-command-center {
            gap: 10px;
          }

          .dashboard-panel {
            border-radius: 18px;
            padding: 12px;
          }

          .dashboard-panel--interactive:hover,
          .dashboard-panel--interactive:focus-visible {
            transform: none;
          }

          .dashboard-panel__header {
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
          }

          .dashboard-panel__icon {
            width: 30px;
            height: 30px;
            border-radius: 12px;
          }

          .dashboard-panel__eyebrow {
            font-size: 9px;
            letter-spacing: 0.10em;
          }

          .dashboard-panel__title {
            font-size: 14px;
          }

          .dashboard-panel__action .inline-flex {
            max-width: 108px;
            padding-inline: 8px;
          }

          .dashboard-chart-summary,
          .dashboard-health-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-module-meter {
            grid-template-columns: auto minmax(0, 1fr);
            gap: 10px;
            border-radius: 16px;
            padding: 10px;
          }

          .dashboard-module-meter__ring {
            width: 54px;
            height: 54px;
          }

          .dashboard-metric-tile {
            border-radius: 14px;
            padding: 10px;
          }

          .dashboard-metric-tile__value {
            font-size: 18px;
          }

          .dashboard-chart {
            min-height: 122px;
            border-radius: 14px;
            padding: 8px;
          }

          .dashboard-chart__header {
            align-items: flex-start;
            flex-direction: column;
            gap: 2px;
          }

          .dashboard-chart svg {
            height: 54px;
          }

          .dashboard-chart__empty {
            inset: 0;
          }

          .dashboard-chart-bars {
            gap: 2px;
            min-height: 28px;
            margin-top: 4px;
          }

          .dashboard-chart-bar__track {
            height: 16px;
          }

          .dashboard-chart-bar small {
            font-size: 7px;
          }

          .dashboard-topology__rail::before {
            display: none;
          }

          .dashboard-topology-node {
            padding: 6px 2px;
            border-radius: 12px;
          }

          .dashboard-topology-node span {
            font-size: 11px;
          }

          .dashboard-topology-node strong {
            font-size: 16px;
          }

          .dashboard-topology-node small {
            font-size: 9px;
          }

          .dashboard-flow-map {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .dashboard-flow-map::before {
            display: none;
          }

          .dashboard-flow-step {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            border-radius: 12px;
            padding: 8px 4px;
            gap: 6px;
            min-height: 90px;
          }

          .dashboard-flow-step > .min-w-0 {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .dashboard-flow-step__label {
            font-size: 11px;
            font-weight: 700;
            white-space: normal;
            word-break: break-all;
            line-height: 1.25;
            text-align: center;
          }

          .dashboard-flow-step__helper {
            display: none;
          }

          .dashboard-flow-step strong {
            font-size: 11px;
            margin-top: auto;
            grid-column: auto;
            justify-self: auto;
          }

          .dashboard-inline-grid {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .dashboard-inline-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }

          .dashboard-inline-row strong {
            text-align: left;
          }

          .dashboard-inline-row span,
          .dashboard-inline-row strong,
          .dashboard-flow-step__label {
            max-width: 100%;
          }
        }

        @media (max-width: 420px) {
          .settings-hero-flat-header .settings-reference-grid-4 {
            grid-template-columns: 1fr !important;
          }

          .dashboard-panel__action {
            display: none;
          }

          .dashboard-chart-bar small[data-major="false"] {
            visibility: hidden;
          }

          .dashboard-module-meter {
            align-items: flex-start;
            grid-template-columns: 1fr;
          }

          .dashboard-module-meter__ring {
            width: 50px;
            height: 50px;
          }
        }
      `}</style>

      <SettingsHero
        eyebrow={dashboardMeta.eyebrow}
        title={dashboardMeta.title}
        icon={LayoutDashboard}
        tone={hasCriticalLogs ? 'rose' : hasAvailableRoute ? 'emerald' : 'amber'}
        badge={<StatusBadge status={heroStatus} label={dashboardStatusSummaryLabel} />}
        description={pick(
          '总览不再只是入口集合，而是把消耗趋势、供应商路由、浏览器助手、存储、日志和账本状态统一成可判断的图形化驾驶舱。',
          'Overview is now a visual command center for spend, provider routing, browser assistant, storage, logs, and ledger health.',
        )}
        actions={(
          <SettingsActionButton
            icon={ArrowRight}
            tone="primary"
            onClick={() => onNavigate(dashboardPrimaryAction.target)}
            data-settings-dashboard-action={SETTINGS_DASHBOARD_ACTIONS.openPrimaryModule.uiAction}
          >
            {dashboardPrimaryAction.label}
          </SettingsActionButton>
        )}
        metrics={(
          <>
            <MetricTile
              label={pick('系统就绪度', 'System readiness')}
              value={`${systemReadiness}%`}
              helper={heroStatusLabel}
              tone={hasCriticalLogs ? 'rose' : hasAvailableRoute ? 'emerald' : 'amber'}
            />
            <MetricTile
              label={pick('今日消耗', 'Spend today')}
              value={formatUsd(todayCostUsd)}
              helper={pick(`${formatCompactNumber(todayTokens)} tokens`, `${formatCompactNumber(todayTokens)} tokens`)}
              tone="emerald"
            />
            <MetricTile
              label={pick('API 链路', 'API routes')}
              value={String(channelCount)}
              helper={pick(`${officialCount} 官方 / ${activeProviderCount} 供应商在线`, `${officialCount} official / ${activeProviderCount} providers online`)}
              tone={hasAvailableRoute ? 'indigo' : 'amber'}
            />
            <MetricTile
              label={pick('余额', 'Balance')}
              value={remainingBalanceDisplay}
              helper={todayRechargeCount > 0 ? pick(`今日充值 ${todayRechargeCount} 条`, `${todayRechargeCount} recharges today`) : pick('余额快照', 'Balance snapshot')}
              tone="amber"
            />
          </>
        )}
      />

      <SettingsCardGridContainer className="dashboard-grid-container dashboard-command-center">
        <DashboardPanel
          className="dashboard-card-consumption a-card-span-2-col a-card-span-2-row"
          tone="indigo"
          icon={<Activity size={18} />}
          eyebrow={pick('消耗曲线', 'Spend curve')}
          title={pick('今日累计消耗趋势', 'Today cumulative spend trend')}
          action={<SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>{pick(`${todayUsageCount} 次`, `${todayUsageCount} calls`)}</SettingsBadge>}
          onClick={() => onNavigate('capability-sources')}
          uiAction={SETTINGS_DASHBOARD_ACTIONS.openConsumptionRecords.uiAction}
        >
          <div className="dashboard-chart-shell">
            <div className="dashboard-chart" aria-label={pick('今日累计消耗曲线图', 'Today cumulative spend curve chart')}>
              <div className="dashboard-chart__header">
                <span className="dashboard-chart__title">{pick('累计曲线 / 分段柱状', 'Cumulative curve / interval bars')}</span>
                <span className="dashboard-chart__legend">{pick('累计消耗', 'Cumulative spend')}</span>
              </div>
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img">
                {[25, 50, 75, 100].map((grid) => {
                  const y = CHART_BOTTOM - (grid / 100) * CHART_INNER_HEIGHT;
                  return <line key={grid} className="dashboard-chart__grid" x1={CHART_PADDING_X} x2={CHART_WIDTH - CHART_PADDING_X} y1={y} y2={y} />;
                })}
                <line className="dashboard-chart__axis" x1={CHART_PADDING_X} x2={CHART_WIDTH - CHART_PADDING_X} y1={CHART_BOTTOM} y2={CHART_BOTTOM} />
                {areaPath ? <path className="dashboard-chart__area" d={areaPath} /> : null}
                {linePath ? <path className="dashboard-chart__line" d={linePath} /> : null}
                {chartPoints.map((point, index) => (
                  <circle
                    key={usageBuckets[index]?.label || index}
                    className="dashboard-chart__dot"
                    cx={point.x}
                    cy={point.y}
                    r={usageBuckets[index]?.isMajorTick ? 3.2 : 2.1}
                  />
                ))}
              </svg>
              {!hasUsageSignal ? (
                <div className="dashboard-chart__empty">
                  <span>{pick('今天还没有消耗数据，曲线保持基线。', 'No spend data today. The curve stays on baseline.')}</span>
                </div>
              ) : null}

              <div className="dashboard-chart-bars">
                {usageBuckets.map((bucket) => (
                  <div
                    key={bucket.label}
                    className="dashboard-chart-bar"
                    title={pick(
                      `${bucket.label} · ${formatNumber(bucket.amount, 2)} 积分 · ${bucket.count} 次`,
                      `${bucket.label} · ${formatNumber(bucket.amount, 2)} credits · ${bucket.count} calls`,
                    )}
                  >
                    <span className="dashboard-chart-bar__track">
                      <span
                        className="dashboard-chart-bar__fill"
                        style={{
                          '--bucket-height': `${hasUsageSignal ? bucket.barPercentage : 4}%`,
                          '--bucket-opacity': bucket.amount > 0 || bucket.count > 0 ? '1' : '0.26',
                        } as React.CSSProperties}
                      />
                    </span>
                    <small data-major={bucket.isMajorTick ? 'true' : 'false'}>{bucket.label.replace(':00', '')}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-inline-grid">
              <div className="dashboard-inline-row">
                <span>{pick('账单金额', 'Billed')}</span>
                <strong>
                  {formatUsd(todayCostUsd)}
                  <small className="ml-1 text-[var(--text-tertiary)] font-normal">
                    ({pick(`消耗 ${formatNumber(totalCreditSpend, 1)}`, `${formatNumber(totalCreditSpend, 1)} credits`)})
                  </small>
                </strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('峰值时段', 'Peak')}</span>
                <strong>
                  {peakUsageBucket && hasUsageSignal ? peakUsageBucket.label.replace(':00', '') : '--'}
                  <small className="ml-1 text-[var(--text-tertiary)] font-normal">
                    ({peakUsageBucket && hasUsageSignal ? pick(`${formatNumber(peakUsageBucket.count)}次`, `${formatNumber(peakUsageBucket.count)} calls`) : pick('无', 'None')})
                  </small>
                </strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('最近请求', 'Latest')}</span>
                <strong title={latestUsageLabel}>{latestUsageLabel}</strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('记录时间', 'Time')}</span>
                <strong>{latestUsage ? formatDateTime(latestUsage.created_at) : pick('等待中', 'Waiting')}</strong>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-api a-card-span-2-row"
          tone={hasAvailableRoute ? 'emerald' : 'amber'}
          icon={<KeyRound size={18} />}
          eyebrow={pick('API 路由图', 'API topology')}
          title={pick('供应商配置与能力路由', 'Provider settings and capability routing')}
          action={<SettingsBadge tone={hasAvailableRoute ? 'emerald' : 'amber'}>{hasAvailableRoute ? pick('可用', 'Ready') : pick('待配置', 'Setup')}</SettingsBadge>}
          onClick={() => onNavigate('capability-sources')}
          uiAction={SETTINGS_DASHBOARD_ACTIONS.openApiManagement.uiAction}
        >
          <div className="dashboard-module-stack">
            <ModuleMeter
              label={pick('路由准备度', 'Route readiness')}
              value={hasAvailableRoute ? pick('可分发请求', 'Routing enabled') : pick('需要配置通道', 'Needs channels')}
              helper={pick('官方密钥、供应商在线状态与异常密钥共同决定路由质量。', 'Route quality combines official keys, provider status, and invalid keys.')}
              progress={routeReadiness}
              tone={hasAvailableRoute ? 'emerald' : 'amber'}
            />
            <div className="dashboard-topology">
              <div className="dashboard-topology__rail" aria-label={pick('API 路由信息图', 'API routing infographic')}>
                <TopologyNode
                  label={pick('官方 API', 'Official API')}
                  value={String(officialCount)}
                  helper={pick('直连密钥', 'Direct keys')}
                  tone={officialCount > 0 ? 'emerald' : 'amber'}
                />
                <TopologyNode
                  label={pick('供应商', 'Providers')}
                  value={`${activeProviderCount}/${Math.max(providerCount, 0)}`}
                  helper={pick('在线/总数', 'Online/total')}
                  tone={activeProviderCount > 0 ? 'emerald' : providerCount > 0 ? 'amber' : 'rose'}
                />
                <TopologyNode
                  label={pick('覆盖率', 'Coverage')}
                  value={`${channelCoverage}%`}
                  helper={pick('可用链路', 'Ready routes')}
                  tone={channelCoverage >= 70 ? 'emerald' : channelCoverage > 0 ? 'amber' : 'rose'}
                />
              </div>

              <div className="dashboard-health-grid">
                <HealthPill
                  label={pick('密钥有效', 'Valid keys')}
                  value={`${stats.valid}/${Math.max(statsTotal, stats.valid)}`}
                  tone={stats.valid > 0 ? 'emerald' : 'amber'}
                />
                <HealthPill
                  label={pick('异常密钥', 'Invalid keys')}
                  value={String(statsInvalid)}
                  tone={statsInvalid > 0 ? 'rose' : 'emerald'}
                />
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-browser a-card-span-2-row"
          tone="indigo"
          icon={<Globe size={18} />}
          eyebrow={pick('浏览器助手图', 'Browser assistant map')}
          title={pick('本地守护、插件与网页自动化链路', 'Daemon, extension, and web automation pipeline')}
          action={<SettingsBadge tone={browserReadiness >= 75 ? 'emerald' : 'indigo'}>{`${browserReadiness}%`}</SettingsBadge>}
          onClick={() => onNavigate('browser-assistant')}
          uiAction={SETTINGS_DASHBOARD_ACTIONS.openBrowserAssistant.uiAction}
        >
          <div className="dashboard-module-stack">
            <ModuleMeter
              label={pick('链路准备度', 'Pipeline readiness')}
              value={browserReadiness >= 75 ? pick('可以进入联调', 'Ready for checks') : pick('需要补齐环境', 'Needs setup')}
              helper={pick('由 API 路由、存储模式和告警日志共同估算。', 'Estimated from API routing, storage mode, and warning logs.')}
              progress={browserReadiness}
              tone={browserReadiness >= 75 ? 'emerald' : browserReadiness >= 50 ? 'amber' : 'indigo'}
            />
            <div className="dashboard-flow-map" aria-label={pick('浏览器助手流程图', 'Browser assistant flow diagram')}>
              <FlowStep
                icon={<Monitor size={12} />}
                label={pick('本地守护进程', 'Local daemon')}
                helper={pick('负责 WSS 控制与本地浏览器桥接', 'WSS control and local bridge')}
                value={pick('检测', 'Check')}
                tone="indigo"
              />
              <FlowStep
                icon={<Layers size={12} />}
                label={pick('Chrome 插件', 'Chrome extension')}
                helper={pick('承接页面读取、截图与上下文采集', 'Page reading, screenshots, context capture')}
                value={pick('连接', 'Link')}
                tone="amber"
              />
              <FlowStep
                icon={<Sparkles size={12} />}
                label={pick('网页抓取/生图素材', 'Extraction and generation assets')}
                helper={pick('价格、商品图、提示词素材流入工作流', 'Price, images, and prompts enter the workflow')}
                value={pick('自动化', 'Automate')}
                tone="emerald"
              />
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-storage"
          tone={storageMode ? 'emerald' : 'amber'}
          icon={<HardDrive size={18} />}
          eyebrow={pick('存储健康', 'Storage health')}
          title={pick('画布资源与容量', 'Canvas assets and capacity')}
          action={<SettingsBadge tone={storageMode ? 'emerald' : 'amber'}>{storageModeLabel}</SettingsBadge>}
          onClick={() => onNavigate('data-sync')}
          uiAction={SETTINGS_DASHBOARD_ACTIONS.openStorageSettings.uiAction}
        >
          <div className="dashboard-module-stack">
            <div className="dashboard-inline-list">
              <div className="dashboard-inline-row">
                <span>{pick('图片资源', 'Image assets')}</span>
                <strong>{storageSnapshotPending ? pick('更新中', 'Updating') : formatNumber(storedImages)}</strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('已占用', 'Used storage')}</span>
                <strong>{storageUsageMb.toFixed(1)} MB</strong>
              </div>
              <ProgressBar
                progress={storageProgress}
                tone={storageProgress >= 85 ? 'rose' : storageProgress >= 60 ? 'amber' : 'emerald'}
                showLabel
              />
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-logs"
          tone={hasCriticalLogs ? 'rose' : importantLogCount > 0 ? 'amber' : 'emerald'}
          icon={<ScrollText size={18} />}
          eyebrow={pick('日志诊断', 'System Logs')}
          title={pick('错误排障与告警', 'Triage & Diagnostics')}
          action={(
            <StatusBadge
              status={latestLog ? getLogTone(latestLog.level) : 'online'}
              label={hasCriticalLogs ? pick('存在错误', 'Errors') : importantLogCount > 0 ? pick('关注', 'Watch') : pick('日志稳定', 'Healthy')}
            />
          )}
          onClick={() => onNavigate('dev-diagnostics')}
          uiAction={SETTINGS_DASHBOARD_ACTIONS.openSystemLogs.uiAction}
        >
          <div className="dashboard-module-stack">
            <div className="dashboard-inline-list">
              <div className="dashboard-inline-row">
                <span>{pick('今日告警', 'Alerts today')}</span>
                <strong>{importantLogCount > 0 ? formatNumber(importantLogCount) : pick('无', 'None')}</strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('最近消息', 'Latest message')}</span>
                <strong title={latestLog ? latestLog.message : undefined}>
                  {latestLog ? latestLog.message : pick('当前运行稳定', 'Running stable')}
                </strong>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-billing"
          tone="amber"
          icon={<Wallet size={18} />}
          eyebrow={pick('计费账本', 'Billing')}
          title={pick('账户交易记录', 'Transaction History')}
          action={<SettingsBadge tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}>{dashboardBalanceCard.title}</SettingsBadge>}
          onClick={() => onNavigate('capability-sources')}
          uiAction={SETTINGS_DASHBOARD_ACTIONS.openConsumptionRecords.uiAction}
        >
          <div className="dashboard-module-stack">
            <div className="dashboard-inline-list">
              <div className="dashboard-inline-row">
                <span>{pick('最近充值', 'Latest recharge')}</span>
                <strong>{latestRecharge ? formatDateTime(latestRecharge.created_at) : pick('暂无记录', 'No record')}</strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('今日充值', 'Recharge today')}</span>
                <strong>{todayRechargeCount > 0 ? formatNumber(todayRechargeCount) : pick('无', 'None')}</strong>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-capabilities"
          tone="indigo"
          icon={<Cpu size={18} />}
          eyebrow={pick('能力流', 'Capability flow')}
          title={pick('模型调用与素材闭环', 'Model calls and assets loop')}
          action={<SettingsBadge tone="indigo">{pick('闭环', 'Loop')}</SettingsBadge>}
          onClick={() => onNavigate('ai-takeover')}
          uiAction={SETTINGS_DASHBOARD_ACTIONS.openAiManagement.uiAction}
        >
          <div className="dashboard-module-stack">
            <div className="dashboard-inline-list">
              <div className="dashboard-inline-row">
                <span>{pick('今日调用', 'Today calls')}</span>
                <strong>{formatNumber(todayUsageCount)} 次</strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('消费总计', 'Total spend')}</span>
                <strong>{formatUsd(todayCostUsd)}</strong>
              </div>
            </div>
          </div>
        </DashboardPanel>
      </SettingsCardGridContainer>
    </SettingsViewShell>
  );
};

export default DashboardView;
