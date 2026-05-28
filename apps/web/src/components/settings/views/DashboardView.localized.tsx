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
  SettingsCardGridContainer,
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
  <button 
    type="button" 
    className="settings-reference-list-item w-full text-left" 
    onClick={onClick}
    style={{ minHeight: '60px', display: 'flex', alignItems: 'center', padding: '10px 14px' }}
  >
    {/* 使用 items-center 替换原本的 items-start，实现左侧图标、中间内容、右侧控件的整体垂向居中对齐 */}
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          border: '1px solid var(--settings-border-subtle)',
          background: 'var(--settings-surface-overlay)',
          color: 'var(--text-primary)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <div className="settings-reference-list-item__title" style={{ fontSize: '13px', fontWeight: 600 }}>{title}</div>
          {status}
        </div>
        {/* 将 meta 信息与 summary 拼合在同一行，从而完全杜绝第三排描述文案的出现，保证视觉行数严禁多于 2 行 */}
        <div className="settings-reference-list-item__meta truncate text-[11px]" style={{ marginTop: '2px', opacity: 0.7 }}>
          {summary}{meta ? ` · ${meta}` : ''}
        </div>
      </div>
    </div>
    {value ? (
      <div className="settings-reference-list-item__value shrink-0 flex items-center" style={{ fontSize: '13px', fontWeight: 600 }}>
        {value}
      </div>
    ) : null}
  </button>
);

const DashboardRingRow: React.FC<{
  label: string;
  percent: number;
  helper: string;
  color: string;
  centerLabel: string;
}> = ({ label, percent, helper, color, centerLabel }) => (
  <div className="settings-reference-ring-row flex items-center gap-3" style={{ padding: '10px 14px' }}>
    <div className="settings-reference-ring shrink-0" style={{ ['--value' as string]: String(percent), ['--ring-color' as string]: color }}>
      <div>
        <strong>{percent}%</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
    <div className="min-w-0 flex-1 flex flex-col justify-center">
      <div className="settings-reference-list-item__title" style={{ fontSize: '13px', fontWeight: 600 }}>{label}</div>
      <div className="settings-reference-list-item__meta truncate text-[11px]" style={{ marginTop: '2px', opacity: 0.7 }}>{helper}</div>
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
  <button 
    type="button" 
    className="settings-reference-list-item w-full text-left" 
    onClick={onClick}
    style={{ minHeight: '56px', display: 'flex', alignItems: 'center', padding: '10px 14px' }}
  >
    <div className="flex min-w-0 items-center gap-3 w-full">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          border: '1px solid var(--settings-border-subtle)',
          background: 'var(--settings-surface-overlay)',
          color: 'var(--text-primary)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="settings-reference-list-item__title" style={{ fontSize: '13px', fontWeight: 600 }}>{title}</div>
        <div className="settings-reference-list-item__meta truncate text-[11px]" style={{ marginTop: '2px', opacity: 0.7 }}>{description}</div>
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

  return (
    <SettingsViewShell>
      <style>{`
        .dashboard-grid-card {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid var(--frost-card-framework-border, rgba(255, 255, 255, 0.08));
          background: var(--frost-card-framework-bg, rgba(22, 28, 45, 0.76));
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          backdrop-filter: blur(var(--frost-card-framework-blur, 20px)) saturate(160%);
          -webkit-backdrop-filter: blur(var(--frost-card-framework-blur, 20px)) saturate(160%);
          transition: all 0.25s ease-in-out;
          cursor: pointer;
          box-shadow: var(--frost-card-framework-shadow, 0 8px 32px rgba(0, 0, 0, 0.35));
        }
        .dashboard-grid-card:hover {
          transform: translateY(-2px);
          border-color: var(--frost-card-sub-border, rgba(255, 255, 255, 0.16));
          background: var(--frost-card-sub-bg, rgba(27, 34, 54, 0.84));
          box-shadow: var(--frost-card-sub-shadow, 0 16px 48px rgba(0, 0, 0, 0.5));
        }
        .dashboard-card-glow {
          position: absolute;
          top: -30px;
          right: -30px;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          filter: blur(45px);
          opacity: 0.12;
          pointer-events: none;
        }
      `}</style>

      <SettingsCardGridContainer className="dashboard-grid-container">
        {/* 卡片 1: 总览 (Overview) - 电脑端占 2*2 格 (4A) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row"
          onClick={() => onNavigate('consumption-records')}
        >
          <div className="dashboard-card-glow" style={{ background: 'var(--accent-color)' }} />
          <div className="flex flex-col gap-2 h-full justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-400">
                <LayoutDashboard size={14} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{pick('总览', 'Overview')}</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-1.5">{pick('系统消耗与状态', 'Usage & Status')}</h3>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                  <div className="text-[9px] text-slate-400">{pick('积分余额', 'Credits')}</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">{remainingBalanceDisplay}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                  <div className="text-[9px] text-slate-400">{pick('今日消耗', 'Today Cost')}</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">{formatUsd(todayCostUsd)}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                  <div className="text-[9px] text-slate-400">{pick('今日词元', 'Today Tokens')}</div>
                  <div className="text-sm font-bold text-blue-400 mt-0.5">{formatCompactNumber(todayTokens)}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                  <div className="text-[9px] text-slate-400">{pick('可用链路', 'Routes')}</div>
                  <div className="text-sm font-bold text-indigo-400 mt-0.5">{channelCount}</div>
                </div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className={`h-1 w-1 rounded-full ${hasAvailableRoute ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="truncate">{hasAvailableRoute ? pick('API 链路正常，状态健康', 'API routes ready') : pick('无可用 API 路由，请在工作台添加', 'API setup required')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-1 w-1 rounded-full ${storageMode ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="truncate">{storageMode ? pick(`存储健康 (${storageModeLabel})`, `Storage OK (${storageModeLabel})`) : pick('本地存储待配置', 'Storage setup required')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 卡片 2: API 工作台 (API Workspace) - 电脑端占 2*1 格 (2A) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col group"
          onClick={() => onNavigate('api-management')}
        >
          <div className="dashboard-card-glow" style={{ background: '#3b82f6' }} />
          <div className="flex items-center gap-3 w-full h-full">
            {/* 左侧：信息区域 */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-slate-400">
                <KeyRound size={14} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{pick('API 工作台', 'API Workspace')}</span>
                <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 font-semibold whitespace-nowrap">
                  {officialCount} {pick('官方', 'Official')} / {activeProviderCount} {pick('在线', 'Online')}
                </span>
              </div>
              <h3 className="text-xs font-bold text-white">{pick('多供应商与能力分配', 'API & Capability Routing')}</h3>
              <p className="text-[11px] text-slate-400 leading-normal truncate">
                {pick('管理本地 API 密钥与第三方中转', 'Manage API keys and external proxies')}
              </p>
            </div>
            {/* 右侧：圆形箭头按钮引导 */}
            <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 transition-all duration-200 group-hover:bg-blue-600/40 group-hover:scale-110">
              <ArrowRight size={16} />
            </div>
          </div>
        </div>



        {/* 卡片 4: 计费账本 (Billing Ledger) - 占 1*1 格 (1A) */}
        <div 
          className="dashboard-grid-card"
          onClick={() => onNavigate('consumption-records')}
        >
          <div className="dashboard-card-glow" style={{ background: '#f59e0b' }} />
          <div className="flex flex-col gap-1.5 justify-between h-full">
            <div>
              <div className="flex items-center gap-2 text-slate-400">
                <Coins size={13} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{pick('计费账本', 'Billing')}</span>
              </div>
              <h3 className="text-xs font-bold text-white mt-1.5">{pick('账户交易记录', 'Transaction History')}</h3>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 truncate">
              {latestRecharge ? pick(`最近充值：${formatDateTime(latestRecharge.created_at)}`, `Recharged: ${formatDateTime(latestRecharge.created_at)}`) : pick('本周暂无充值记录', 'No recent recharge')}
            </div>
          </div>
        </div>

        {/* 卡片 5: 系统日志 (Logs) - 占 1*1 格 (1A) */}
        <div 
          className="dashboard-grid-card"
          onClick={() => onNavigate('system-logs')}
        >
          <div className="dashboard-card-glow" style={{ background: '#ef4444' }} />
          <div className="flex flex-col gap-1.5 justify-between h-full">
            <div>
              <div className="flex items-center gap-2 text-slate-400">
                <ScrollText size={13} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{pick('日志诊断', 'System Logs')}</span>
              </div>
              <h3 className="text-xs font-bold text-white mt-1.5">{pick('错误排障与告警', 'Triage & Diagnostics')}</h3>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 truncate flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${hasCriticalLogs ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="truncate">{importantLogCount > 0 ? pick(`${importantLogCount} 条运行告警`, `${importantLogCount} alerts`) : pick('系统无异常记录', 'Logs clear')}</span>
            </div>
          </div>
        </div>

        {/* 卡片 6: 存储管理 (Storage) - 电脑端占 2*1 格 (2A) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col"
          onClick={() => onNavigate('storage-settings')}
        >
          <div className="dashboard-card-glow" style={{ background: '#10b981' }} />
          <div className="flex flex-col gap-2 w-full justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <HardDrive size={13} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{pick('存储容量', 'Storage Settings')}</span>
                </div>
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5 font-semibold">
                  {storageModeLabel}
                </span>
              </div>
              <h3 className="text-xs font-bold text-white mt-1.5">{pick('画布资源与空间清理', 'Usage & Cache')}</h3>
              
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>{storageSnapshotPending ? pick('更新中...', 'Updating...') : pick(`已存 ${storedImages} 张图`, `${storedImages} images`)}</span>
                  <span>{storageUsageMb.toFixed(1)} MB / 1 GB</span>
                </div>
                <ProgressBar
                  progress={storageProgress}
                  tone={storageProgress >= 85 ? 'rose' : storageProgress >= 60 ? 'amber' : 'indigo'}
                  showLabel={false}
                />
              </div>
            </div>
          </div>
        </div>
      </SettingsCardGridContainer>
    </SettingsViewShell>

  );
};

export default DashboardView;
