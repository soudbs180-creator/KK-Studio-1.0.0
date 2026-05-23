import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  RefreshCw,
  ScrollText,
  Wallet,
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
  SettingsHero,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';
import {
  getSettingsPrimaryActionMeta,
  getSettingsStatusSummaryLabel,
  getSettingsViewMeta,
} from '../settingsRegistry';
import { ProgressBar, StatusBadge } from '../ui/index';
import { useAdminRole } from '../../../hooks/useAdminRole';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

type DashboardIdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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

const buildChartPaths = (points: number[]) => {
  if (points.length === 0) {
    return { linePath: '', areaPath: '' };
  }

  const step = points.length > 1 ? 100 / (points.length - 1) : 100;
  const linePath = points
    .map((point, index) => {
      const x = Number((index * step).toFixed(2));
      const y = Number((100 - point).toFixed(2));
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return {
    linePath,
    areaPath: `${linePath} L 100 100 L 0 100 Z`,
  };
};

const DashboardActivityRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  summary: string;
  meta: string;
  value?: string;
  status?: React.ReactNode;
  onClick?: () => void;
}> = ({ icon, title, summary, meta, value, status, onClick }) => (
  <button type="button" className="settings-reference-list-item w-full text-left" onClick={onClick}>
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{
          border: '1px solid var(--settings-border-subtle)',
          background: 'var(--settings-surface-overlay)',
          color: 'var(--text-primary)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="settings-reference-list-item__title">{title}</div>
          {status}
        </div>
        <div className="settings-reference-list-item__meta">{summary}</div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{meta}</div>
      </div>
    </div>
    {value ? <div className="settings-reference-list-item__value">{value}</div> : null}
  </button>
);

const DashboardRingRow: React.FC<{
  label: string;
  percent: number;
  helper: string;
  color: string;
  centerLabel: string;
}> = ({ label, percent, helper, color, centerLabel }) => (
  <div className="settings-reference-ring-row">
    <div className="settings-reference-ring" style={{ ['--value' as string]: String(percent), ['--ring-color' as string]: color }}>
      <div>
        <strong>{percent}%</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="settings-reference-list-item__title">{label}</div>
      <div className="settings-reference-list-item__meta">{helper}</div>
    </div>
  </div>
);

const MetricTile: React.FC<{ label: string; value: string; helper: string }> = ({ label, value, helper }) => (
  <div className="settings-reference-mini-metric h-full">
    <div className="settings-reference-mini-metric__label">{label}</div>
    <div className="settings-reference-mini-metric__value">{value}</div>
    <div className="settings-reference-mini-metric__helper">{helper}</div>
  </div>
);

const QuickActionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
  <button type="button" className="settings-reference-list-item h-full w-full text-left" onClick={onClick}>
    <div className="flex min-w-0 items-start gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px]"
        style={{
          border: '1px solid var(--settings-border-subtle)',
          background: 'var(--settings-surface-overlay)',
          color: 'var(--text-primary)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="settings-reference-list-item__title">{title}</div>
        <div className="settings-reference-list-item__meta">{description}</div>
      </div>
    </div>
  </button>
);

type DashboardSignalNode = {
  key: string;
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  target: string;
  tone: 'blue' | 'green' | 'amber' | 'rose';
};

const dashboardPulseColor: Record<'emerald' | 'amber' | 'rose', string> = {
  emerald: '52 211 153',
  amber: '245 158 11',
  rose: '248 113 113',
};

const DashboardSignalHero: React.FC<{
  statusLabel: string;
  statusMeta: string;
  statusTone: 'emerald' | 'amber' | 'rose';
  readiness: number;
  usageBuckets: Array<{ label: string; count: number; percentage: number }>;
  nodes: DashboardSignalNode[];
  statusKicker: string;
  readinessLabel: string;
  requestLabel: string;
  navigationLabel: string;
  onNavigate: (view: string) => void;
}> = ({
  statusLabel,
  statusMeta,
  statusTone,
  readiness,
  usageBuckets,
  nodes,
  statusKicker,
  readinessLabel,
  requestLabel,
  navigationLabel,
  onNavigate,
}) => (
  <section className="settings-dashboard-cockpit" data-tone={statusTone}>
    <div className="settings-dashboard-cockpit__status">
      <div
        className="settings-dashboard-cockpit__pulse"
        style={{ ['--pulse-color' as string]: dashboardPulseColor[statusTone] }}
        aria-hidden="true"
      >
        <span />
      </div>
      <div className="min-w-0">
        <div className="settings-dashboard-cockpit__kicker">{statusKicker}</div>
        <div className="settings-dashboard-cockpit__title">{statusLabel}</div>
        <div className="settings-dashboard-cockpit__meta">{statusMeta}</div>
      </div>
      <div className="settings-dashboard-cockpit__readiness" aria-label={`${readiness}%`}>
        <strong>{readiness}%</strong>
        <span>{readinessLabel}</span>
      </div>
    </div>

    <div className="settings-dashboard-live-bars" aria-label={requestLabel}>
      {usageBuckets.map((bucket, index) => (
        <div key={bucket.label} className="settings-dashboard-live-bars__item" title={`${bucket.label}: ${bucket.count}`}>
          <span className="settings-dashboard-live-bars__track">
            <span
              className="settings-dashboard-live-bars__bar"
              style={{
                ['--bar-height' as string]: `${bucket.percentage}%`,
                ['--bar-delay' as string]: `${index * 80}ms`,
              }}
            />
          </span>
          <small>{bucket.label.replace(':00', '')}</small>
        </div>
      ))}
    </div>

    <div className="settings-dashboard-cockpit__flow" aria-label={navigationLabel}>
      <span className="settings-dashboard-cockpit__flow-line" aria-hidden="true" />
      {nodes.map((node) => (
        <button
          key={node.key}
          type="button"
          className="settings-dashboard-cockpit__node"
          data-tone={node.tone}
          onClick={() => onNavigate(node.target)}
        >
          <span className="settings-dashboard-cockpit__node-icon">{node.icon}</span>
          <span className="settings-dashboard-cockpit__node-body">
            <span className="settings-dashboard-cockpit__node-label">{node.label}</span>
            <strong>{node.value}</strong>
            <span>{node.helper}</span>
          </span>
        </button>
      ))}
    </div>
  </section>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user, accountRole } = useAdminRole();
  const displayName = user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    (user?.email?.endsWith('@users.kkstudio.local') ? '微信用户' : user?.email?.split('@')[0]) ||
    'Guest';

  const { locale, pick } = useLocale();
  const registryLanguage = locale.startsWith('zh') ? 'zh-CN' : 'en-US';
  const dashboardMeta = useMemo(
    () => getSettingsViewMeta('dashboard', registryLanguage),
    [registryLanguage],
  );
  const dashboardPrimaryAction = useMemo(
    () => getSettingsPrimaryActionMeta('dashboard', registryLanguage),
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
  const [refreshing, setRefreshing] = useState(false);
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
    setRefreshing(true);
    try {
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
    } finally {
      setRefreshing(false);
    }
  }, [scheduleStorageSnapshotRefresh]);

  useEffect(() => {
    void refreshDashboard();
    const unsubscribe = keyManager.subscribe(() => void refreshDashboard());
    return unsubscribe;
  }, [billingLoading, billingLogs.length, refreshDashboard, usageLogs.length]);

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

  const usageBuckets = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, index) => ({
      label: `${String(index * 4).padStart(2, '0')}:00`,
      count: 0,
    }));

    todayUsageLogs.forEach((log) => {
      const createdAt = new Date(log.created_at);
      if (Number.isNaN(createdAt.getTime())) return;
      const bucketIndex = Math.min(5, Math.floor(createdAt.getHours() / 4));
      buckets[bucketIndex]!.count += 1;
    });

    const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
    return buckets.map((bucket) => ({
      ...bucket,
      percentage: bucket.count === 0 ? 8 : Math.max(12, Math.round((bucket.count / maxCount) * 84)),
    }));
  }, [todayUsageLogs]);

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
  const hasAvailableRoute = stats.valid > 0 || activeProviderCount > 0;
  const storageModeLabel = getStorageModeLabel(storageMode);
  const channelCount = officialCount + activeProviderCount;
  const channelCoverage = officialCount + providerCount > 0
    ? Math.round((channelCount / Math.max(officialCount + providerCount, 1)) * 100)
    : 0;
  const logHealth = logs.length > 0 ? Math.max(0, 100 - Math.round((importantLogCount / logs.length) * 100)) : 100;
  const storageHealth = storageMode ? 100 : 36;
  const storageProgress = Math.min(100, (storageUsageMb / 1024) * 100);
  const peakUsageBucket = useMemo(
    () => usageBuckets.slice().sort((left, right) => right.count - left.count)[0] ?? usageBuckets[0],
    [usageBuckets],
  );
  const { linePath, areaPath } = useMemo(
    () => buildChartPaths(usageBuckets.map((bucket) => bucket.percentage)),
    [usageBuckets],
  );

  const recentActivity = useMemo(
    () => [
      {
        key: 'usage',
        icon: <Activity size={18} />,
        title: pick('最近请求', 'Recent requests'),
        summary:
          latestUsage?.model_name
          || latestUsage?.model_id
          || latestUsage?.description
          || pick('今天还没有模型请求。', 'No model request has been recorded today.'),
        meta: latestUsage
          ? formatDateTime(latestUsage.created_at)
          : pick('等待新的调用事件', 'Waiting for a new request event'),
        value: todayUsageCount > 0 ? pick(`${formatNumber(todayUsageCount)} 次`, `${formatNumber(todayUsageCount)} calls`) : undefined,
        status: <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>API</SettingsBadge>,
        onClick: () => onNavigate('consumption-records'),
      },
      {
        key: 'billing',
        icon: <Wallet size={18} />,
        title: pick('余额与充值', 'Balance and recharge'),
        summary: latestRecharge
          ? pick(`最近充值：${formatDateTime(latestRecharge.created_at)}`, `Latest recharge: ${formatDateTime(latestRecharge.created_at)}`)
          : pick(`当前余额 ${remainingBalanceDisplay}`, `Current balance ${remainingBalanceDisplay}`),
        meta: todayRechargeCount > 0
          ? pick(`今天新增 ${todayRechargeCount} 条充值`, `${todayRechargeCount} recharges today`)
          : pick('今天没有充值记录', 'No recharge activity today'),
        value: remainingBalanceDisplay,
        status: <SettingsBadge tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}>{pick('账本', 'Billing')}</SettingsBadge>,
        onClick: () => onNavigate('consumption-records'),
      },
      {
        key: 'logs',
        icon: <ScrollText size={18} />,
        title: pick('日志信号', 'Log signals'),
        summary: latestLog?.message || pick('当前没有需要优先处理的告警。', 'No warning or error logs are blocking the system right now.'),
        meta: latestLog ? `${formatDateTime(latestLog.timestamp)} · ${latestLog.source}` : pick('日志流稳定', 'Live log stream is stable'),
        value: importantLogCount > 0 ? pick(`${importantLogCount} 条`, `${importantLogCount} items`) : pick('稳定', 'Stable'),
        status: (
          <StatusBadge
            status={latestLog ? getLogTone(latestLog.level) : 'online'}
            label={hasCriticalLogs ? pick('优先处理', 'Priority') : importantLogCount > 0 ? pick('关注', 'Watch') : pick('健康', 'Healthy')}
          />
        ),
        onClick: () => onNavigate('system-logs'),
      },
      {
        key: 'channels',
        icon: <KeyRound size={18} />,
        title: pick('路由状态', 'Route status'),
        summary: hasAvailableRoute
          ? pick(`${channelCount} 条链路可用。`, `${channelCount} active routes are ready.`)
          : pick('还没有可用链路，建议先配置 API。', 'No ready route was detected. Configure API first.'),
        meta: providerCount > 0
          ? pick(`${activeProviderCount}/${providerCount} 个第三方供应商在线`, `${activeProviderCount}/${providerCount} external providers online`)
          : pick('当前仅依赖官方链路', 'Official routes only'),
        value: String(channelCount),
        status: <SettingsBadge tone={hasAvailableRoute ? 'emerald' : 'rose'}>{pick('链路', 'Routes')}</SettingsBadge>,
        onClick: () => onNavigate('api-management'),
      },
    ],
    [
      activeProviderCount,
      channelCount,
      formatDateTime,
      formatNumber,
      hasAvailableRoute,
      hasCriticalLogs,
      importantLogCount,
      latestLog,
      latestRecharge,
      latestUsage,
      onNavigate,
      pick,
      providerCount,
      remainingBalanceDisplay,
      todayRechargeCount,
      todayUsageCount,
    ],
  );

  const snapshotTiles = useMemo(
    () => [
      {
        label: pick('已接入链路', 'Connected routes'),
        value: `${formatNumber(channelCount)}`,
        helper: hasAvailableRoute
          ? pick(`${officialCount} 个官方 API / ${activeProviderCount} 个在线供应商`, `${officialCount} local APIs / ${activeProviderCount} active providers`)
          : pick('先添加本地或官方 API', 'Add a local or official API first'),
      },
      {
        label: pick('今日消耗', 'Spend today'),
        value: formatUsd(todayCostUsd),
        helper: pick(`余额 ${remainingBalanceDisplay}`, `Balance ${remainingBalanceDisplay}`),
      },
      {
        label: pick('日志状态', 'Log status'),
        value: importantLogCount > 0 ? pick(`${importantLogCount} 条告警`, `${importantLogCount} alerts`) : pick('稳定', 'Stable'),
        helper: latestLog ? latestLog.source : pick('当前没有异常日志', 'No recent warning or error'),
      },
      {
        label: pick('存储', 'Storage'),
        value: storageModeLabel,
        helper: storageSnapshotPending
          ? pick('正在整理图片与容量统计…', 'Updating image and storage totals…')
          : pick(`${formatNumber(storedImages)} 张图片 · ${storageUsageMb.toFixed(0)} MB`, `${formatNumber(storedImages)} images · ${storageUsageMb.toFixed(0)} MB`),
      },
    ],
    [
      activeProviderCount,
      channelCount,
      formatNumber,
      hasAvailableRoute,
      importantLogCount,
      latestLog,
      officialCount,
      pick,
      remainingBalanceDisplay,
      storageModeLabel,
      storageSnapshotPending,
      storageUsageMb,
      storedImages,
      todayCostUsd,
    ],
  );

  const statusTone = hasCriticalLogs ? 'rose' : hasAvailableRoute ? 'emerald' : 'amber';
  const statusLabel = hasCriticalLogs
    ? pick('需要处理', 'Needs attention')
    : hasAvailableRoute
      ? pick('已就绪', 'Ready')
      : pick('待配置', 'Setup required');
  const dashboardReadiness = Math.round((channelCoverage + logHealth + storageHealth) / 3);
  const dashboardSignalSummary = hasCriticalLogs
    ? pick(`${importantLogCount} 条异常需要处理`, `${importantLogCount} alerts need review`)
    : hasAvailableRoute
      ? pick('链路、账本、日志和存储已接入', 'Routes, billing, logs, and storage are connected')
      : pick('先添加本地或官方 API', 'Add a local or official API first');
  const cockpitNodes = useMemo<DashboardSignalNode[]>(
    () => [
      {
        key: 'api',
        label: 'API',
        value: String(channelCount),
        helper: hasAvailableRoute ? pick('链路可用', 'routes ready') : pick('待添加', 'setup'),
        icon: <KeyRound size={17} />,
        target: 'api-management',
        tone: hasAvailableRoute ? 'green' : 'amber',
      },
      {
        key: 'billing',
        label: pick('账本', 'Billing'),
        value: formatUsd(todayCostUsd),
        helper: pick('今日消耗', 'today spend'),
        icon: <Coins size={17} />,
        target: 'consumption-records',
        tone: todayCostUsd > 0 ? 'blue' : 'green',
      },
      {
        key: 'logs',
        label: pick('日志', 'Logs'),
        value: importantLogCount > 0 ? String(importantLogCount) : pick('稳', 'OK'),
        helper: importantLogCount > 0 ? pick('需要关注', 'watch') : pick('无告警', 'clear'),
        icon: <ScrollText size={17} />,
        target: 'system-logs',
        tone: hasCriticalLogs ? 'rose' : importantLogCount > 0 ? 'amber' : 'green',
      },
      {
        key: 'storage',
        label: pick('存储', 'Storage'),
        value: storageSnapshotPending ? '...' : `${storageUsageMb.toFixed(0)} MB`,
        helper: storageMode ? storageModeLabel : pick('未固定', 'unassigned'),
        icon: <HardDrive size={17} />,
        target: 'storage-settings',
        tone: storageMode ? 'green' : 'amber',
      },
    ],
    [
      channelCount,
      formatUsd,
      hasAvailableRoute,
      hasCriticalLogs,
      importantLogCount,
      pick,
      storageMode,
      storageModeLabel,
      storageSnapshotPending,
      storageUsageMb,
      todayCostUsd,
    ],
  );

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        {/* 我的信息 Clay 实心卡片 */}
        <section className="settings-reference-card !bg-[var(--settings-surface-overlay)] !border-[var(--settings-border-subtle)] flex items-center justify-between p-5 gap-4">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 bg-[var(--bg-tertiary)] flex items-center justify-center shadow-inner">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-xl font-bold uppercase text-[var(--text-secondary)]">
                  {displayName[0] || 'U'}
                </div>
              )}
            </div>
            {/* 账户详情 */}
            <div className="flex flex-col gap-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {displayName}
              </h3>
              <p className="text-xs text-[var(--text-tertiary)] truncate">
                {user?.email?.endsWith('@users.kkstudio.local') ? pick('微信授权用户', 'WeChat Authorized User') : user?.email || pick('未绑定账号', 'No account bound')}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <SettingsBadge tone={accountRole === 'admin' ? 'indigo' : 'neutral'}>
                  {accountRole === 'admin' ? pick('系统管理员', 'Administrator') : pick('普通用户', 'User')}
                </SettingsBadge>
              </div>
            </div>
          </div>
          
          {/* 实时积分余额 */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              {pick('积分余额', 'Credits Balance')}
            </span>
            <span className="text-xl font-bold text-amber-400 font-mono">
              {remainingBalanceDisplay}
            </span>
          </div>
        </section>

        <SettingsHero
          className="settings-dashboard-hero"
          eyebrow={pick('高级设置', 'Advanced settings')}
          title={dashboardMeta.title}
          description={pick(
            '一屏查看状态、流量、消耗和告警，再进入具体设置页。',
            'See status, traffic, spend, and alerts in one screen before opening a detailed settings page.',
          )}
          badge={<SettingsBadge tone={statusTone}>{statusLabel}</SettingsBadge>}
          actions={(
            <>
              <SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refreshDashboard()}>
                {pick('刷新', 'Refresh')}
              </SettingsActionButton>
              <SettingsActionButton
                className="settings-dashboard-hero__mobile-action"
                icon={ArrowRight}
                tone="primary"
                onClick={() => onNavigate(dashboardPrimaryAction.target)}
              >
                {dashboardPrimaryAction.label}
              </SettingsActionButton>
            </>
          )}
          metrics={(
            <>
              {snapshotTiles.map((item) => (
                <MetricTile key={item.label} label={item.label} value={item.value} helper={item.helper} />
              ))}
            </>
          )}
        />

        <DashboardSignalHero
          statusLabel={statusLabel}
          statusMeta={dashboardSignalSummary}
          statusTone={statusTone}
          readiness={dashboardReadiness}
          usageBuckets={usageBuckets}
          nodes={cockpitNodes}
          statusKicker={dashboardStatusSummaryLabel}
          readinessLabel={pick('就绪度', 'Ready')}
          requestLabel={pick('今日请求活跃度', 'Today request activity')}
          navigationLabel={pick('仪表盘快捷导航', 'Dashboard quick navigation')}
          onNavigate={onNavigate}
        />

        <div className="settings-dashboard-overview-grid">
          <SettingsSection
            title={pick('流量曲线', 'Traffic overview')}
            eyebrow={pick('请求趋势', 'Request trend')}
            description={pick(
              '按 4 小时窗口查看今天的请求节奏。',
              'Read today’s request rhythm by 4-hour window.',
            )}
          >
            <div className="settings-reference-chart">
              <div className="settings-reference-chart__frame">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="dashboardAreaLocalized" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(123 179 255 / 0.42)" />
                      <stop offset="100%" stopColor="rgb(123 179 255 / 0)" />
                    </linearGradient>
                  </defs>
                  {areaPath ? <path d={areaPath} fill="url(#dashboardAreaLocalized)" /> : null}
                  {linePath ? (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="rgb(123 179 255)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </svg>
              </div>
              <div className="settings-reference-chart__labels">
                {usageBuckets.map((bucket) => (
                  <span key={bucket.label}>{bucket.label}</span>
                ))}
              </div>
            </div>

            <div className="settings-dashboard-chart-metrics mt-5 grid gap-3 md:grid-cols-2">
              <MetricTile
                label={pick('高峰窗口', 'Peak window')}
                value={peakUsageBucket?.label || '00:00'}
                helper={pick('今日最活跃时段', 'Most active window today')}
              />
              <MetricTile
                label={pick('今日词元', 'Tokens today')}
                value={formatCompactNumber(todayTokens)}
                helper={pick('来自今日请求记录', 'Measured from today’s requests')}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            title={pick('运行健康', 'Operational health')}
            eyebrow={pick('当前状态', 'Current state')}
            description={pick(
              '把路由、日志和存储准备度放在同一个面板里。',
              'Keep route, log, and storage readiness in one compact panel.',
            )}
            action={<LayoutDashboard size={18} className="text-[var(--text-primary)]" />}
            surface="plain"
          >
            <div className="settings-reference-rings settings-reference-rings--flat">
              <DashboardRingRow
                label={pick('路由覆盖', 'Route coverage')}
                percent={channelCoverage}
                helper={
                  hasAvailableRoute
                    ? pick(`${channelCount} 条链路可用`, `${channelCount} routes are available`)
                    : pick('还没有可调度链路', 'No ready route is available')
                }
                color="rgb(123 179 255)"
                centerLabel={pick('健康', 'Health')}
              />
              <DashboardRingRow
                label={pick('日志健康', 'Log health')}
                percent={logHealth}
                helper={
                  importantLogCount > 0
                    ? pick(`${importantLogCount} 条告警或错误`, `${importantLogCount} warning or error rows`)
                    : pick('当前没有高优先级异常', 'No warning or error rows right now')
                }
                color={hasCriticalLogs ? 'rgb(255 122 122)' : 'rgb(52 211 153)'}
                centerLabel={pick('健康', 'Health')}
              />
              <DashboardRingRow
                label={pick('存储准备度', 'Storage readiness')}
                percent={storageHealth}
                helper={
                  storageMode
                    ? pick(`${storageModeLabel} 已启用`, `${storageModeLabel} is active`)
                    : pick('还没有固定存储目标', 'No storage target is pinned yet')
                }
                color={storageMode ? 'rgb(52 211 153)' : 'rgb(245 158 11)'}
                centerLabel={pick('健康', 'Health')}
              />
            </div>

            <div className="settings-dashboard-storage-pressure mt-5">
              <div className="mb-2 flex items-center justify-between text-[length:var(--type-caption)] text-[var(--text-secondary)]">
                <span>{pick('存储压力', 'Storage pressure')}</span>
                <span>{storageUsageMb.toFixed(0)} MB</span>
              </div>
              <ProgressBar
                progress={storageProgress}
                tone={storageProgress >= 85 ? 'rose' : storageProgress >= 60 ? 'amber' : 'indigo'}
                showLabel={false}
              />
            </div>
          </SettingsSection>
        </div>

        <div className="settings-dashboard-secondary-grid">
          <div className="settings-dashboard-quick-routes">
            <SettingsSection
              title={pick('快捷入口', 'Quick routes')}
              eyebrow={pick('直接进入', 'Jump in')}
              description={pick(
                '常用设置都放在第一屏。',
                'Keep the most-used settings surfaces on the first screen.',
              )}
            >
              <div className="settings-dashboard-mobile-flow-strip">
                <QuickActionCard
                  title={pick('配置 API', 'Configure API')}
                  description={pick('本地接口与供应商', 'Local APIs and providers')}
                  icon={<KeyRound size={18} />}
                  onClick={() => onNavigate('api-management')}
                />
                <QuickActionCard
                  title={pick('计费账本', 'Billing')}
                  description={pick('充值、消耗、账本', 'Recharge, spend, ledger')}
                  icon={<Coins size={18} />}
                  onClick={() => onNavigate('consumption-records')}
                />
                <QuickActionCard
                  title={pick('日志', 'Logs')}
                  description={pick('错误、告警、排障', 'Errors, warnings, triage')}
                  icon={<ScrollText size={18} />}
                  onClick={() => onNavigate('system-logs')}
                />
                <QuickActionCard
                  title={pick('存储', 'Storage')}
                  description={pick('模式、容量、修复', 'Modes, capacity, repair')}
                  icon={<HardDrive size={18} />}
                  onClick={() => onNavigate('storage-settings')}
                />
              </div>
            </SettingsSection>
          </div>

          <SettingsSection
            title={pick('最近信号', 'Recent signals')}
            eyebrow={pick('实时摘要', 'Live summary')}
            description={pick(
              '把最近的请求、账本、日志和路由状态集中显示。',
              'Bring recent requests, billing, logs, and route state into one list.',
            )}
          >
            <div className="settings-reference-list">
              {recentActivity.map(({ key, ...item }) => (
                <DashboardActivityRow key={key} {...item} />
              ))}
            </div>
          </SettingsSection>
        </div>
      </div>
    </SettingsViewShell>
  );
};

export default DashboardView;
