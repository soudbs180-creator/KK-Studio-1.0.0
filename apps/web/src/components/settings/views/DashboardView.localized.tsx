import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
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
  SettingsBadge,
  SettingsCardGridContainer,
  SettingsHero,
  SettingsViewShell,
} from '../SettingsScaffold';
import {
  getSettingsStatusSummaryLabel,
  getSettingsViewMeta,
} from '../settingsRegistry';
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
    const controlY = previous.y;
    path += ` C ${controlX} ${controlY}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
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
  className?: string;
  tone?: HealthTone;
}> = ({ title, eyebrow, icon, children, action, onClick, className = '', tone = 'indigo' }) => {
  const content = (
    <>
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
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`dashboard-panel dashboard-panel--button ${className}`.trim()}
        data-tone={tone}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <section className={`dashboard-panel ${className}`.trim()} data-tone={tone}>
      {content}
    </section>
  );
};

const HealthPill: React.FC<{
  label: string;
  value: string;
  tone: HealthTone;
}> = ({ label, value, tone }) => (
  <div className="dashboard-health-pill" data-tone={tone}>
    <span className="dashboard-health-pill__dot" />
    <span className="dashboard-health-pill__label">{label}</span>
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
  <div className="dashboard-topology-node" data-tone={tone}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{helper}</small>
  </div>
);

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

  const { balance, loading: billingLoading, billingLogs, usageLogs, fetchLogs } = useBilling();
  const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, locale);
  const { latestRecharge, todayRechargeCount } = useMemo(
    () => selectRemainingBalanceSummary(billingLogs),
    [billingLogs],
  );

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
  const logHealth = logs.length > 0 ? Math.max(0, 100 - Math.round((importantLogCount / logs.length) * 100)) : 100;
  const storageHealth = storageMode ? 100 : 36;
  const storageProgress = Math.min(100, (storageUsageMb / 1024) * 100);
  const hasUsageSignal = totalCreditSpend > 0 || todayUsageCount > 0 || todayCostUsd > 0 || todayTokens > 0;
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
    + storageHealth
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
          gap: 14px;
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }

        .dashboard-panel {
          --dashboard-tone-rgb: 99 102 241;
          position: relative;
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--frost-card-framework-border, rgba(255, 255, 255, 0.08));
          border-radius: 22px;
          background:
            radial-gradient(circle at top right, rgb(var(--dashboard-tone-rgb) / 0.16), transparent 34%),
            var(--frost-card-framework-bg, rgba(22, 28, 45, 0.76));
          box-shadow: var(--frost-card-framework-shadow, 0 8px 32px rgba(0, 0, 0, 0.35));
          color: var(--text-primary);
          padding: 16px;
          text-align: left;
          backdrop-filter: blur(var(--frost-card-framework-blur, 20px)) saturate(160%);
          -webkit-backdrop-filter: blur(var(--frost-card-framework-blur, 20px)) saturate(160%);
        }

        .dashboard-panel[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-panel[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-panel[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-panel[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-panel--button {
          display: block;
          width: 100%;
          cursor: pointer;
          font: inherit;
          transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
        }

        .dashboard-panel--button:hover {
          transform: translateY(-2px);
          border-color: rgb(var(--dashboard-tone-rgb) / 0.36);
          box-shadow: var(--frost-card-sub-shadow, 0 16px 48px rgba(0, 0, 0, 0.5));
        }

        .dashboard-panel__glow {
          position: absolute;
          inset: -80px -80px auto auto;
          width: 180px;
          height: 180px;
          border-radius: 999px;
          background: rgb(var(--dashboard-tone-rgb) / 0.18);
          filter: blur(34px);
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
        .dashboard-topology-node small {
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
          min-height: 254px;
          overflow: hidden;
          border: 1px solid var(--settings-border-subtle);
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgb(var(--settings-accent-rgb) / 0.10), rgb(255 255 255 / 0.015)),
            repeating-linear-gradient(0deg, transparent 0 33px, rgb(255 255 255 / 0.055) 34px 35px);
          padding: 14px;
        }

        .dashboard-chart__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
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
          height: 158px;
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
          inset: 74px 18px auto;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        .dashboard-chart__empty span {
          border: 1px solid var(--settings-border-subtle);
          border-radius: 999px;
          background: var(--settings-surface-overlay);
          color: var(--text-tertiary);
          font-size: var(--type-caption);
          padding: 6px 10px;
        }

        .dashboard-chart-bars {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 5px;
          min-height: 70px;
          align-items: end;
          margin-top: 10px;
        }

        .dashboard-chart-bar {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .dashboard-chart-bar__track {
          display: flex;
          width: 100%;
          height: 50px;
          align-items: flex-end;
          justify-content: center;
          border-radius: 999px;
          background: rgb(255 255 255 / 0.06);
          overflow: hidden;
        }

        .dashboard-chart-bar__fill {
          width: 100%;
          min-height: 4px;
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
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-chart-bar small[data-major="false"] {
          opacity: 0.34;
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
          gap: 8px;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.20);
          border-radius: 999px;
          background: rgb(var(--dashboard-tone-rgb) / 0.08);
          padding: 9px 11px;
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

        .dashboard-health-pill strong {
          margin-left: auto;
          color: var(--text-primary);
          font-size: var(--type-caption);
          font-weight: 700;
          white-space: nowrap;
        }

        .dashboard-topology {
          display: grid;
          gap: 12px;
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
          gap: 6px;
          min-width: 0;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.22);
          border-radius: 18px;
          background: color-mix(in srgb, var(--settings-surface-elevated) 78%, rgb(var(--dashboard-tone-rgb)) 8%);
          padding: 12px;
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
        }

        .dashboard-topology-node strong {
          color: rgb(var(--dashboard-tone-rgb));
          font-size: clamp(20px, 2vw, 28px);
          font-weight: 800;
          line-height: 1;
        }

        .dashboard-flow-map {
          display: grid;
          gap: 10px;
        }

        .dashboard-flow-step {
          --dashboard-tone-rgb: 99 102 241;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          border: 1px solid rgb(var(--dashboard-tone-rgb) / 0.20);
          border-radius: 16px;
          background: rgb(var(--dashboard-tone-rgb) / 0.07);
          padding: 10px;
        }

        .dashboard-flow-step[data-tone="emerald"] { --dashboard-tone-rgb: 16 185 129; }
        .dashboard-flow-step[data-tone="amber"] { --dashboard-tone-rgb: 245 158 11; }
        .dashboard-flow-step[data-tone="rose"] { --dashboard-tone-rgb: 244 63 94; }
        .dashboard-flow-step[data-tone="indigo"] { --dashboard-tone-rgb: 99 102 241; }

        .dashboard-flow-step__icon {
          display: inline-flex;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
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
          min-width: 0;
          overflow: hidden;
          color: var(--text-secondary);
          font-size: var(--type-caption);
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-inline-row strong {
          min-width: 0;
          overflow: hidden;
          color: var(--text-primary);
          font-size: var(--type-caption);
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (min-width: 900px) {
          .dashboard-command-center {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .dashboard-card-consumption {
            grid-column: span 2;
            grid-row: span 2;
          }

          .dashboard-card-api {
            grid-column: span 2;
          }

          .dashboard-card-browser {
            grid-column: span 2;
          }

          .dashboard-card-storage,
          .dashboard-card-logs {
            grid-column: span 1;
          }
        }

        @media (min-width: 1280px) {
          .dashboard-card-consumption {
            grid-column: span 2;
            grid-row: span 2;
          }

          .dashboard-card-api {
            grid-column: span 2;
          }

          .dashboard-card-browser {
            grid-column: span 2;
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
          .dashboard-health-grid,
          .dashboard-topology__rail {
            grid-template-columns: 1fr;
          }

          .dashboard-metric-tile {
            border-radius: 14px;
            padding: 10px;
          }

          .dashboard-metric-tile__value {
            font-size: 18px;
          }

          .dashboard-chart {
            min-height: 232px;
            border-radius: 16px;
            padding: 10px;
          }

          .dashboard-chart__header {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }

          .dashboard-chart svg {
            height: 146px;
          }

          .dashboard-chart__empty {
            inset: 68px 10px auto;
          }

          .dashboard-chart-bars {
            gap: 3px;
            min-height: 58px;
            margin-top: 8px;
          }

          .dashboard-chart-bar__track {
            height: 42px;
          }

          .dashboard-chart-bar small {
            font-size: 8px;
          }

          .dashboard-topology__rail::before {
            display: none;
          }

          .dashboard-flow-step {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: flex-start;
            border-radius: 14px;
            padding: 9px;
          }

          .dashboard-flow-step strong {
            grid-column: 2;
            justify-self: start;
          }

          .dashboard-inline-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }

          .dashboard-inline-row strong {
            max-width: 100%;
          }
        }

        @media (max-width: 380px) {
          .settings-hero-flat-header .settings-reference-grid-4 {
            grid-template-columns: 1fr !important;
          }

          .dashboard-panel__action {
            display: none;
          }

          .dashboard-chart-bar small[data-major="false"] {
            visibility: hidden;
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
          '把设置总览升级成可读数据的运营驾驶舱：消耗趋势、API 路由、浏览器助手链路、存储和日志健康度都在一个屏幕内判断。',
          'A data-first settings command center for spend trends, API routing, browser-assistant pipeline, storage, and log health.',
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

      <SettingsCardGridContainer className="dashboard-command-center">
        <DashboardPanel
          className="dashboard-card-consumption"
          tone="indigo"
          icon={<Activity size={18} />}
          eyebrow={pick('消耗曲线', 'Spend curve')}
          title={pick('今日累计消耗趋势', 'Today cumulative spend trend')}
          action={<SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>{pick(`${todayUsageCount} 次`, `${todayUsageCount} calls`)}</SettingsBadge>}
          onClick={() => onNavigate('consumption-records')}
        >
          <div className="dashboard-chart-shell">
            <div className="dashboard-chart-summary">
              <MetricTile
                label={pick('账单金额', 'Billed amount')}
                value={formatUsd(todayCostUsd)}
                helper={pick(`积分消耗 ${formatNumber(totalCreditSpend, 2)}`, `${formatNumber(totalCreditSpend, 2)} credits used`)}
                tone="emerald"
              />
              <MetricTile
                label={pick('峰值时段', 'Peak period')}
                value={peakUsageBucket?.label.replace(':00', '') || '--'}
                helper={peakUsageBucket && hasUsageSignal ? pick(`${formatNumber(peakUsageBucket.count)} 次请求`, `${formatNumber(peakUsageBucket.count)} calls`) : pick('暂无峰值', 'No peak yet')}
                tone="indigo"
              />
            </div>

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
                          ['--bucket-height' as string]: `${hasUsageSignal ? bucket.barPercentage : 4}%`,
                          ['--bucket-opacity' as string]: bucket.amount > 0 || bucket.count > 0 ? '1' : '0.26',
                        }}
                      />
                    </span>
                    <small data-major={bucket.isMajorTick ? 'true' : 'false'}>{bucket.label.replace(':00', '')}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-inline-list">
              <div className="dashboard-inline-row">
                <span>{pick('最近请求', 'Latest request')}</span>
                <strong>{latestUsageLabel}</strong>
              </div>
              <div className="dashboard-inline-row">
                <span>{pick('记录时间', 'Recorded at')}</span>
                <strong>{latestUsage ? formatDateTime(latestUsage.created_at) : pick('等待新调用', 'Waiting for activity')}</strong>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-api"
          tone={hasAvailableRoute ? 'emerald' : 'amber'}
          icon={<KeyRound size={18} />}
          eyebrow={pick('API 路由图', 'API topology')}
          title={pick('供应商配置与能力路由', 'Provider settings and capability routing')}
          action={<SettingsBadge tone={hasAvailableRoute ? 'emerald' : 'amber'}>{hasAvailableRoute ? pick('可用', 'Ready') : pick('待配置', 'Setup')}</SettingsBadge>}
          onClick={() => onNavigate('api-management')}
        >
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
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-browser"
          tone="indigo"
          icon={<Globe size={18} />}
          eyebrow={pick('浏览器助手图', 'Browser assistant map')}
          title={pick('本地守护、插件与网页自动化链路', 'Daemon, extension, and web automation pipeline')}
          action={<SettingsBadge tone="indigo">{pick('待检测', 'Doctor')}</SettingsBadge>}
          onClick={() => onNavigate('browser-assistant')}
        >
          <div className="dashboard-flow-map" aria-label={pick('浏览器助手流程图', 'Browser assistant flow diagram')}>
            <FlowStep
              icon={<Monitor size={16} />}
              label={pick('本地守护进程', 'Local daemon')}
              helper={pick('负责 WSS 控制与本地浏览器桥接', 'WSS control and local bridge')}
              value={pick('检测', 'Check')}
              tone="indigo"
            />
            <FlowStep
              icon={<Layers size={16} />}
              label={pick('Chrome 插件', 'Chrome extension')}
              helper={pick('承接页面读取、截图与上下文采集', 'Page reading, screenshots, context capture')}
              value={pick('连接', 'Link')}
              tone="amber"
            />
            <FlowStep
              icon={<Sparkles size={16} />}
              label={pick('网页抓取/生图素材', 'Extraction and generation assets')}
              helper={pick('价格、商品图、提示词素材流入工作流', 'Price, images, and prompts enter the workflow')}
              value={pick('自动化', 'Automate')}
              tone="emerald"
            />

            <div className="mt-1">
              <div className="mb-2 flex items-center justify-between gap-3 text-[var(--text-secondary)]" style={{ fontSize: 'var(--type-caption)' }}>
                <span>{pick('链路准备度', 'Pipeline readiness')}</span>
                <strong className="text-[var(--text-primary)]">{browserReadiness}%</strong>
              </div>
              <ProgressBar
                progress={browserReadiness}
                tone={browserReadiness >= 75 ? 'emerald' : browserReadiness >= 50 ? 'amber' : 'indigo'}
                showLabel={false}
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
          onClick={() => onNavigate('storage-settings')}
        >
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
        </DashboardPanel>

        <DashboardPanel
          className="dashboard-card-logs"
          tone={hasCriticalLogs ? 'rose' : importantLogCount > 0 ? 'amber' : 'emerald'}
          icon={<ScrollText size={18} />}
          eyebrow={pick('日志信号', 'Log signals')}
          title={pick('错误、告警与排障优先级', 'Errors, warnings, and triage priority')}
          action={(
            <StatusBadge
              status={latestLog ? getLogTone(latestLog.level) : 'online'}
              label={hasCriticalLogs ? pick('优先处理', 'Priority') : importantLogCount > 0 ? pick('关注', 'Watch') : pick('健康', 'Healthy')}
            />
          )}
          onClick={() => onNavigate('system-logs')}
        >
          <div className="dashboard-inline-list">
            <div className="dashboard-inline-row">
              <span>{pick('今日告警', 'Alerts today')}</span>
              <strong>{importantLogCount > 0 ? formatNumber(importantLogCount) : pick('无', 'None')}</strong>
            </div>
            <div className="dashboard-inline-row">
              <span>{pick('最近来源', 'Latest source')}</span>
              <strong>{latestLog ? latestLog.source : pick('日志流稳定', 'Stable stream')}</strong>
            </div>
            <div className="dashboard-inline-row">
              <span>{pick('最近消息', 'Latest message')}</span>
              <strong>{latestLog ? latestLog.message : pick('当前没有异常日志', 'No warning or error')}</strong>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          tone="amber"
          icon={<Wallet size={18} />}
          eyebrow={pick('账本', 'Ledger')}
          title={pick('余额、充值与交易快照', 'Balance, recharge, and ledger snapshot')}
          action={<SettingsBadge tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}>{pick('计费', 'Billing')}</SettingsBadge>}
          onClick={() => onNavigate('consumption-records')}
        >
          <div className="dashboard-inline-list">
            <div className="dashboard-inline-row">
              <span>{pick('当前余额', 'Current balance')}</span>
              <strong>{remainingBalanceDisplay}</strong>
            </div>
            <div className="dashboard-inline-row">
              <span>{pick('最近充值', 'Latest recharge')}</span>
              <strong>{latestRecharge ? formatDateTime(latestRecharge.created_at) : pick('暂无记录', 'No record')}</strong>
            </div>
            <div className="dashboard-inline-row">
              <span>{pick('今日充值', 'Recharge today')}</span>
              <strong>{todayRechargeCount > 0 ? formatNumber(todayRechargeCount) : pick('无', 'None')}</strong>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          tone="indigo"
          icon={<Cpu size={18} />}
          eyebrow={pick('能力流', 'Capability flow')}
          title={pick('模型调用、素材与分发的闭环', 'Closed loop for model calls, assets, and distribution')}
          action={<Zap size={18} />}
          onClick={() => onNavigate('ai-management')}
        >
          <div className="dashboard-flow-map">
            <FlowStep
              icon={<Activity size={16} />}
              label={pick('模型调用', 'Model calls')}
              helper={pick('请求记录进入消耗曲线', 'Requests feed the spend curve')}
              value={formatCompactNumber(todayUsageCount)}
              tone="indigo"
            />
            <FlowStep
              icon={<Coins size={16} />}
              label={pick('计费沉淀', 'Billing ledger')}
              helper={pick('余额、充值、消耗统一落账', 'Balance, recharge, and spend reconcile')}
              value={formatUsd(todayCostUsd)}
              tone="amber"
            />
            <FlowStep
              icon={<Globe size={16} />}
              label={pick('网页助手', 'Browser assistant')}
              helper={pick('页面素材进入自动化生成流程', 'Page assets enter automated generation')}
              value={`${browserReadiness}%`}
              tone="emerald"
            />
          </div>
        </DashboardPanel>
      </SettingsCardGridContainer>
    </SettingsViewShell>
  );
};

export default DashboardView;
