import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useBilling } from '../../../context/BillingContext';
import keyManager from '../../../services/auth/keyManager';
import { getTodayCosts } from '../../../services/billing/costService';
import { getAllImageIds, getStorageUsage } from '../../../services/storage/imageStorage';
import { getStorageMode, type StorageMode } from '../../../services/storage/storagePreference';
import {
  getTodayLogs,
  LogLevel,
  subscribeToLogs,
  type SystemLogEntry,
} from '../../../services/system/systemLogService';
import { SettingsActionButton, SettingsBadge, SettingsViewShell } from '../SettingsScaffold';
import { EmptyState, ProgressBar, StatusBadge } from '../ui/index';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(value);

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value?: string | number | null) => {
  if (!value) return 'No recent activity';
  const target = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(target.getTime())) return 'No recent activity';
  return target.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isSameLocalDay = (value?: string | null) => {
  if (!value) return false;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  return (
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth() &&
    target.getDate() === today.getDate()
  );
};

const getStorageModeLabel = (mode: StorageMode | null) => {
  if (mode === 'local') return 'Local Folder';
  if (mode === 'opfs') return 'Private Device';
  if (mode === 'browser') return 'Browser Cache';
  return 'Unassigned';
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

const getLogTone = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'error' as const;
  if (level === LogLevel.WARNING) return 'warning' as const;
  return 'online' as const;
};

const DashboardRingRow: React.FC<{
  label: string;
  percent: number;
  helper: string;
  color: string;
}> = ({ label, percent, helper, color }) => (
  <div className="settings-reference-ring-row">
    <div className="settings-reference-ring" style={{ ['--value' as string]: String(percent), ['--ring-color' as string]: color }}>
      <div>
        <strong>{percent}%</strong>
        <span>Health</span>
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="settings-reference-list-item__title">{label}</div>
      <div className="settings-reference-list-item__meta">{helper}</div>
    </div>
  </div>
);

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
          background:
            'linear-gradient(180deg, rgb(255 255 255 / 0.03) 0%, transparent 100%), var(--settings-surface-overlay)',
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

const DashboardStorageRow: React.FC<{ label: string; value: string; helper: string }> = ({
  label,
  value,
  helper,
}) => (
  <div className="settings-reference-mini-metric">
    <div className="settings-reference-mini-metric__label">{label}</div>
    <div className="settings-reference-mini-metric__value">{value}</div>
    <div className="settings-reference-mini-metric__helper">{helper}</div>
  </div>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { balance, billingLogs, usageLogs } = useBilling();
  const [stats, setStats] = useState(() => keyManager.getStats());
  const [todayCostUsd, setTodayCostUsd] = useState(() => getTodayCosts().totalCostUsd || 0);
  const [todayTokens, setTodayTokens] = useState(() => getTodayCosts().totalTokens || 0);
  const [officialCount, setOfficialCount] = useState(0);
  const [providerCount, setProviderCount] = useState(0);
  const [activeProviderCount, setActiveProviderCount] = useState(0);
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [storageUsageMb, setStorageUsageMb] = useState(0);
  const [storedImages, setStoredImages] = useState(0);
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getTodayLogs());
  const [refreshing, setRefreshing] = useState(false);

  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      const nextStats = keyManager.getStats();
      const allSlots = keyManager.getSlots();
      const providers = keyManager.getProviders();
      const cost = getTodayCosts();
      const [nextStorageMode, usageBytes, imageIds] = await Promise.all([
        getStorageMode(),
        getStorageUsage().catch(() => 0),
        getAllImageIds().catch(() => []),
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
      setStorageUsageMb(usageBytes / (1024 * 1024));
      setStoredImages(imageIds.length);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshDashboard();
    const unsubscribe = keyManager.subscribe(() => void refreshDashboard());
    return unsubscribe;
  }, [billingLogs.length, usageLogs.length]);

  useEffect(() => {
    setLogs(getTodayLogs());
    const unsubscribe = subscribeToLogs((next) => setLogs(next));
    return unsubscribe;
  }, []);

  const todayUsageLogs = useMemo(
    () => usageLogs.filter((log) => isSameLocalDay(log.created_at)),
    [usageLogs]
  );

  const todayRechargeLogs = useMemo(
    () => billingLogs.filter((log) => isSameLocalDay(log.created_at)),
    [billingLogs]
  );

  const importantLogs = useMemo(
    () =>
      logs.filter(
        (item) =>
          item.level === LogLevel.WARNING ||
          item.level === LogLevel.ERROR ||
          item.level === LogLevel.CRITICAL
      ),
    [logs]
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
      buckets[bucketIndex].count += 1;
    });

    const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
    return buckets.map((bucket) => ({
      ...bucket,
      percentage: bucket.count === 0 ? 8 : Math.max(12, Math.round((bucket.count / maxCount) * 84)),
    }));
  }, [todayUsageLogs]);

  const todayUsageCount = todayUsageLogs.length;
  const todayRechargeCount = todayRechargeLogs.length;
  const latestUsage = todayUsageLogs[0] || usageLogs[0] || null;
  const latestRecharge = todayRechargeLogs[0] || billingLogs[0] || null;
  const latestLog = importantLogs[0] || logs[0] || null;
  const importantLogCount = importantLogs.length;
  const hasCriticalLogs = importantLogs.some(
    (item) => item.level === LogLevel.ERROR || item.level === LogLevel.CRITICAL
  );
  const hasAvailableRoute = stats.valid > 0 || activeProviderCount > 0;
  const storageModeLabel = getStorageModeLabel(storageMode);
  const channelCount = officialCount + activeProviderCount;
  const channelCoverage = officialCount + providerCount > 0
    ? Math.round((channelCount / Math.max(officialCount + providerCount, 1)) * 100)
    : 0;
  const logHealth = logs.length > 0 ? Math.max(0, 100 - Math.round((importantLogCount / logs.length) * 100)) : 100;
  const storageHealth = storageMode ? 100 : 38;
  const storageProgress = Math.min(100, (storageUsageMb / 1024) * 100);
  const { linePath, areaPath } = useMemo(
    () => buildChartPaths(usageBuckets.map((bucket) => bucket.percentage)),
    [usageBuckets]
  );

  const recentActivity = useMemo(
    () => [
      {
        key: 'usage',
        icon: <Activity size={18} />,
        title: 'Recent Requests',
        summary:
          latestUsage?.model_name ||
          latestUsage?.model_id ||
          latestUsage?.description ||
          'No model request has been recorded today.',
        meta: latestUsage ? formatDateTime(latestUsage.created_at) : 'Waiting for a new request event',
        value: todayUsageCount > 0 ? `${formatNumber(todayUsageCount)} calls` : undefined,
        status: <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>API</SettingsBadge>,
        onClick: () => onNavigate('consumption-records'),
      },
      {
        key: 'billing',
        icon: <Coins size={18} />,
        title: 'Recharge & Balance',
        summary: latestRecharge
          ? `Latest recharge settled at ${formatDateTime(latestRecharge.created_at)}`
          : `Current balance ${formatNumber(balance, Number.isInteger(balance) ? 0 : 2)}`,
        meta: todayRechargeCount > 0 ? `${todayRechargeCount} recharges today` : 'No recharge activity today',
        value: formatNumber(balance, Number.isInteger(balance) ? 0 : 2),
        status: <SettingsBadge tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}>Credits</SettingsBadge>,
        onClick: () => onNavigate('consumption-records'),
      },
      {
        key: 'logs',
        icon: <ScrollText size={18} />,
        title: 'System Alerts',
        summary: latestLog?.message || 'No warning or error logs are blocking the system right now.',
        meta: latestLog ? `${formatDateTime(latestLog.timestamp)} · ${latestLog.source}` : 'Live log stream is stable',
        value: importantLogCount > 0 ? `${importantLogCount} items` : 'Stable',
        status: (
          <StatusBadge
            status={latestLog ? getLogTone(latestLog.level) : 'online'}
            label={hasCriticalLogs ? 'Critical' : importantLogCount > 0 ? 'Watch' : 'Healthy'}
          />
        ),
        onClick: () => onNavigate('system-logs'),
      },
      {
        key: 'channels',
        icon: <KeyRound size={18} />,
        title: 'Route Availability',
        summary: hasAvailableRoute
          ? `${channelCount} active channels are ready for dispatch.`
          : 'No ready route was detected. API setup should be prioritised.',
        meta: providerCount > 0 ? `${activeProviderCount}/${providerCount} external providers online` : 'Official routes only',
        value: hasAvailableRoute ? `${channelCount}` : '0',
        status: <SettingsBadge tone={hasAvailableRoute ? 'emerald' : 'rose'}>Routes</SettingsBadge>,
        onClick: () => onNavigate('api-management'),
      },
    ],
    [
      activeProviderCount,
      balance,
      channelCount,
      hasAvailableRoute,
      hasCriticalLogs,
      importantLogCount,
      latestLog,
      latestRecharge,
      latestUsage,
      onNavigate,
      providerCount,
      todayRechargeCount,
      todayUsageCount,
    ]
  );

  const statusTone = hasCriticalLogs ? 'rose' : hasAvailableRoute ? 'emerald' : 'amber';

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <div className="settings-reference-page-header">
          <div className="settings-reference-page-header__lead">
            <div className="settings-reference-page-header__eyebrow">Advanced Settings</div>
            <h2>Dashboard</h2>
            <p>
              A live control view for channels, spend, alerts, and storage. The layout now follows the
              same dark admin language as the reference screens so the entire settings area reads as one
              unified console.
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone={statusTone}>
              {hasCriticalLogs ? 'Needs Attention' : hasAvailableRoute ? 'System Active' : 'Setup Required'}
            </SettingsBadge>
            <SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refreshDashboard()}>
              Refresh
            </SettingsActionButton>
            <SettingsActionButton icon={ArrowRight} tone="primary" onClick={() => onNavigate('api-management')}>
              Open API Management
            </SettingsActionButton>
          </div>
        </div>

        <div className="settings-reference-grid-2">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Requests Today</div>
                <div className="settings-reference-card__title">Traffic Overview</div>
              </div>
              <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>
                {todayUsageCount > 0 ? 'Live volume' : 'Waiting for traffic'}
              </SettingsBadge>
            </div>
            <div className="settings-reference-kpi__value">{formatNumber(todayUsageCount)}</div>
            <div className="settings-reference-kpi__helper">
              {formatNumber(todayTokens)} tokens consumed today across official and third-party routes.
            </div>
            <div className="mt-5 settings-reference-metric-grid">
              <DashboardStorageRow
                label="Active Channels"
                value={String(channelCount)}
                helper={hasAvailableRoute ? 'Routes currently available for dispatch' : 'No active route detected'}
              />
              <DashboardStorageRow
                label="Valid Keys"
                value={String(stats.valid)}
                helper={`${stats.total} total key slots are registered in the key manager`}
              />
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Spend Today</div>
                <div className="settings-reference-card__title">Cost Snapshot</div>
              </div>
              <SettingsBadge tone={todayCostUsd > 0 ? 'amber' : 'neutral'}>
                {todayCostUsd > 0 ? 'Tracking' : 'No spend yet'}
              </SettingsBadge>
            </div>
            <div className="settings-reference-kpi__value">{formatUsd(todayCostUsd)}</div>
            <div className="settings-reference-kpi__helper">
              {todayRechargeCount > 0
                ? `${todayRechargeCount} recharge records were added today.`
                : 'No recharge movement has been written to the ledger today.'}
            </div>
            <div className="mt-5 settings-reference-metric-grid">
              <DashboardStorageRow
                label="Balance"
                value={formatNumber(balance, Number.isInteger(balance) ? 0 : 2)}
                helper="Remaining credits currently available to the workspace"
              />
              <DashboardStorageRow
                label="Latest Recharge"
                value={latestRecharge ? formatDateTime(latestRecharge.created_at) : 'No record'}
                helper="Most recent balance top-up event"
              />
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Request Trend</div>
                <div className="settings-reference-card__title">API Traffic by 4-Hour Window</div>
                <div className="settings-reference-card__meta">
                  A reference-style area chart for today&apos;s request rhythm, using real activity buckets from
                  the local billing logs.
                </div>
              </div>
              <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>
                {todayUsageCount > 0 ? 'Updated live' : 'No samples'}
              </SettingsBadge>
            </div>

            <div className="settings-reference-chart">
              <div className="settings-reference-chart__frame">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="dashboardArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(123 179 255 / 0.42)" />
                      <stop offset="100%" stopColor="rgb(123 179 255 / 0)" />
                    </linearGradient>
                  </defs>
                  {areaPath ? <path d={areaPath} fill="url(#dashboardArea)" /> : null}
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

            <div className="mt-5 settings-reference-metric-grid">
              <DashboardStorageRow
                label="Peak Window"
                value={usageBuckets.slice().sort((left, right) => right.count - left.count)[0]?.label || '00:00'}
                helper="Most active 4-hour segment recorded today"
              />
              <DashboardStorageRow
                label="Average Window"
                value={formatCompactNumber(todayUsageCount / Math.max(usageBuckets.length, 1))}
                helper="Mean request count per 4-hour bucket"
              />
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">System Health</div>
                <div className="settings-reference-card__title">Operational Rings</div>
                <div className="settings-reference-card__meta">
                  A compact health stack for routing, logging, and storage readiness.
                </div>
              </div>
              <LayoutDashboard size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 settings-reference-rings">
              <DashboardRingRow
                label="Channel Coverage"
                percent={channelCoverage}
                helper={
                  hasAvailableRoute
                    ? `${channelCount} routes are currently available across official and third-party pools.`
                    : 'No dispatch-ready route is available right now.'
                }
                color="rgb(123 179 255)"
              />
              <DashboardRingRow
                label="Log Health"
                percent={logHealth}
                helper={
                  importantLogCount > 0
                    ? `${importantLogCount} warning or error entries are in today’s stream.`
                    : 'No warning or error entries are present in today’s live stream.'
                }
                color={hasCriticalLogs ? 'rgb(255 122 122)' : 'rgb(52 211 153)'}
              />
              <DashboardRingRow
                label="Storage Readiness"
                percent={storageHealth}
                helper={
                  storageMode
                    ? `${storageModeLabel} is configured as the active storage target.`
                    : 'A storage target has not been pinned yet.'
                }
                color={storageMode ? 'rgb(52 211 153)' : 'rgb(245 158 11)'}
              />
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Recent Activity</div>
                <div className="settings-reference-card__title">Live Consumption & Alerts</div>
                <div className="settings-reference-card__meta">
                  A compact feed of the latest request, billing, routing, and log activity so you can jump
                  straight into the right settings page.
                </div>
              </div>
              <Activity size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 settings-reference-list">
              {recentActivity.map(({ key, ...item }) => (
                <DashboardActivityRow key={key} {...item} />
              ))}
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Storage Distribution</div>
                <div className="settings-reference-card__title">Cache & Mode Snapshot</div>
                <div className="settings-reference-card__meta">
                  Storage mode, cache footprint, and image volume are surfaced here so this panel visually
                  mirrors the reference dashboard’s right-side resource card.
                </div>
              </div>
              <HardDrive size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="settings-reference-kpi__value">{storageUsageMb.toFixed(2)} MB</div>
            <div className="settings-reference-kpi__helper">
              {storedImages} stored images tracked in the current workspace cache.
            </div>

            <div className="mt-4">
              <ProgressBar
                progress={storageProgress}
                tone={storageProgress >= 85 ? 'rose' : storageProgress >= 60 ? 'amber' : 'indigo'}
                showLabel={false}
              />
              <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">
                Visualised against a 1 GB reference threshold for quick capacity checks.
              </div>
            </div>

            <div className="settings-reference-segments">
              <span className={`settings-reference-segment ${storageMode === 'browser' ? 'is-active' : ''}`.trim()} />
              <span className={`settings-reference-segment ${storageMode === 'opfs' ? 'is-active' : ''}`.trim()} />
              <span className={`settings-reference-segment ${storageMode === 'local' ? 'is-active' : ''}`.trim()} />
            </div>

            <div className="mt-5 settings-reference-metric-grid">
              <DashboardStorageRow label="Primary Mode" value={storageModeLabel} helper="The current destination used for local asset persistence" />
              <DashboardStorageRow label="Stored Images" value={formatNumber(storedImages)} helper="Detected image records in the local cache layer" />
              <DashboardStorageRow label="Providers Online" value={formatNumber(activeProviderCount)} helper="Third-party providers currently allowed to participate" />
              <DashboardStorageRow
                label="Latest Alert"
                value={latestLog ? formatDateTime(latestLog.timestamp) : 'No alert'}
                helper={latestLog ? latestLog.source : 'System logs are currently stable'}
              />
            </div>

            {!hasAvailableRoute && !storageMode ? (
              <div className="mt-5">
                <EmptyState
                  title="Setup is still incomplete"
                  description="Connect at least one API route and assign a storage mode to bring this dashboard fully online."
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </SettingsViewShell>
  );
};

export default DashboardView;
