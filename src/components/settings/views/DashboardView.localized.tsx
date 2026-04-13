import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Coins,
  HardDrive,
  KeyRound,
  LayoutDashboard,
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
import { EmptyState, ProgressBar, StatusBadge } from '../ui/index';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

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

const MetricTile: React.FC<{ label: string; value: string; helper: string }> = ({ label, value, helper }) => (
  <div className="settings-reference-mini-metric">
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
  <button type="button" className="settings-reference-list-item w-full text-left" onClick={onClick}>
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

const RingRow: React.FC<{
  label: string;
  percent: number;
  helper: string;
  color: string;
}> = ({ label, percent, helper, color }) => {
  const { pick } = useLocale();

  return (
    <div className="settings-reference-ring-row">
      <div className="settings-reference-ring" style={{ ['--value' as string]: String(percent), ['--ring-color' as string]: color }}>
        <div>
          <strong>{percent}%</strong>
          <span>{pick('健康', 'Health')}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="settings-reference-list-item__title">{label}</div>
        <div className="settings-reference-list-item__meta">{helper}</div>
      </div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { locale, pick } = useLocale();
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
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getTodayLogs());

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
    if (mode === 'local') return pick('本地文件夹', 'Local Folder');
    if (mode === 'opfs') return pick('设备私有存储', 'Private Device');
    if (mode === 'browser') return pick('浏览器缓存', 'Browser Cache');
    return pick('未指定', 'Unassigned');
  };

  const refreshDashboard = async () => {
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
  };

  useEffect(() => {
    void refreshDashboard();
    const unsubscribe = keyManager.subscribe(() => void refreshDashboard());
    return unsubscribe;
  }, [billingLogs.length, usageLogs.length, billingLoading]);

  useEffect(() => {
    setLogs(getTodayLogs());
    const unsubscribe = subscribeToLogs((next) => setLogs(next));
    return unsubscribe;
  }, []);

  const todayUsageLogs = useMemo(
    () => usageLogs.filter((log) => isSameLocalDay(log.created_at)),
    [usageLogs]
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
  const latestUsage = todayUsageLogs[0] || usageLogs[0] || null;
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
        title: pick('最近请求', 'Recent Requests'),
        summary:
          latestUsage?.model_name ||
          latestUsage?.model_id ||
          latestUsage?.description ||
          pick('今天还没有记录到模型请求。', 'No model request has been recorded today.'),
        meta: latestUsage ? formatDateTime(latestUsage.created_at) : pick('等待新的请求事件', 'Waiting for a new request event'),
        value: todayUsageCount > 0 ? pick(`${formatNumber(todayUsageCount)} 次`, `${formatNumber(todayUsageCount)} calls`) : undefined,
        status: <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>API</SettingsBadge>,
        onClick: () => onNavigate('consumption-records'),
      },
      {
        key: 'billing',
        icon: <Wallet size={18} />,
        title: pick('积分与充值', 'Credits & Recharge'),
        summary: latestRecharge
          ? pick(`最近一次充值时间：${formatDateTime(latestRecharge.created_at)}`, `Latest recharge settled at ${formatDateTime(latestRecharge.created_at)}`)
          : pick(`当前余额 ${remainingBalanceDisplay}`, `Current balance ${remainingBalanceDisplay}`),
        meta: todayRechargeCount > 0 ? pick(`今天新增 ${todayRechargeCount} 条充值记录`, `${todayRechargeCount} recharges today`) : pick('今天还没有充值记录', 'No recharge activity today'),
        value: remainingBalanceDisplay,
        status: <SettingsBadge tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}>{pick('积分', 'Credits')}</SettingsBadge>,
        onClick: () => onNavigate('consumption-records'),
      },
      {
        key: 'logs',
        icon: <ScrollText size={18} />,
        title: pick('系统告警', 'System Alerts'),
        summary: latestLog?.message || pick('当前没有阻塞系统的告警或错误日志。', 'No warning or error logs are blocking the system right now.'),
        meta: latestLog ? `${formatDateTime(latestLog.timestamp)} · ${latestLog.source}` : pick('实时日志流稳定', 'Live log stream is stable'),
        value: importantLogCount > 0 ? pick(`${importantLogCount} 条`, `${importantLogCount} items`) : pick('稳定', 'Stable'),
        status: (
          <StatusBadge
            status={latestLog ? getLogTone(latestLog.level) : 'online'}
            label={hasCriticalLogs ? pick('需处理', 'Critical') : importantLogCount > 0 ? pick('关注', 'Watch') : pick('健康', 'Healthy')}
          />
        ),
        onClick: () => onNavigate('system-logs'),
      },
      {
        key: 'channels',
        icon: <KeyRound size={18} />,
        title: pick('链路可用性', 'Route Availability'),
        summary: hasAvailableRoute
          ? pick(`${channelCount} 条可用链路已准备就绪。`, `${channelCount} active channels are ready for dispatch.`)
          : pick('尚未检测到可用链路，建议优先完成 API 配置。', 'No ready route was detected. API setup should be prioritised.'),
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
    ]
  );

  const statusTone = hasCriticalLogs ? 'rose' : hasAvailableRoute ? 'emerald' : 'amber';

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <SettingsHero
          eyebrow={pick('高级设置', 'Advanced Settings')}
          title={pick('总览', 'Dashboard')}
          description={pick(
            '这里集中展示链路、消耗、告警和存储状态，帮助你先看全局，再进入具体设置页处理问题。',
            'A calmer overview for routes, spend, alerts, and storage before you open a detailed settings page.',
          )}
          badge={(
            <SettingsBadge tone={statusTone}>
              {hasCriticalLogs
                ? pick('需要处理', 'Needs Attention')
                : hasAvailableRoute
                  ? pick('系统运行中', 'System Active')
                  : pick('等待配置', 'Setup Required')}
            </SettingsBadge>
          )}
          actions={(
            <SettingsActionButton icon={ArrowRight} tone="primary" onClick={() => onNavigate('api-management')}>
              {pick('打开 API 管理', 'Open API Management')}
            </SettingsActionButton>
          )}
        />

        <SettingsSection
          title={pick('快捷操作', 'Quick actions')}
          eyebrow={pick('常用入口', 'Frequent actions')}
          description={pick(
            '把最常用的管理入口提前，减少在设置里来回切换的成本。',
            'Bring common routes forward so desktop management feels quicker and calmer.',
          )}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <QuickActionCard
              title={pick('API 路由', 'API routes')}
              description={pick('检查连通性、预算和模型可用性。', 'Review connectivity, budgets, and model availability.')}
              icon={<KeyRound size={18} />}
              onClick={() => onNavigate('api-management')}
            />
            <QuickActionCard
              title={pick('账单与余额', 'Billing & balance')}
              description={pick('查看今日消耗、充值和剩余积分。', 'Review spend, recharges, and remaining credits.')}
              icon={<Coins size={18} />}
              onClick={() => onNavigate('consumption-records')}
            />
            <QuickActionCard
              title={pick('系统日志', 'System logs')}
              description={pick('优先排查错误、警告和异常来源。', 'Investigate errors, warnings, and unusual signals.')}
              icon={<ScrollText size={18} />}
              onClick={() => onNavigate('system-logs')}
            />
            <QuickActionCard
              title={pick('存储设置', 'Storage settings')}
              description={pick('检查缓存体积、模式和落盘目标。', 'Inspect cache footprint, mode, and persistence target.')}
              icon={<HardDrive size={18} />}
              onClick={() => onNavigate('storage-settings')}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title={pick('系统概览', 'System overview')}
          eyebrow={pick('核心状态', 'Core signals')}
          description={pick(
            '保留最重要的两个概览指标：今日请求与今日消耗，作为进入详细排查前的第一视图。',
            'Keep only the two top-level signals you most often need before opening a detailed page.',
          )}
        >
        <div className="settings-reference-grid-2">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('今日请求', 'Requests Today')}</div>
                <div className="settings-reference-card__title">{pick('流量概览', 'Traffic Overview')}</div>
              </div>
              <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>
                {todayUsageCount > 0 ? pick('实时流量', 'Live Volume') : pick('等待流量', 'Waiting')}
              </SettingsBadge>
            </div>
            <div className="settings-reference-kpi__value">{formatNumber(todayUsageCount)}</div>
            <div className="settings-reference-kpi__helper">
              {pick(
                `今天累计消耗 ${formatNumber(todayTokens)} 个词元，覆盖官方与第三方链路。`,
                `${formatNumber(todayTokens)} tokens consumed today across official and third-party routes.`
              )}
            </div>
            <div className="mt-5 settings-reference-metric-grid">
              <MetricTile
                label={pick('活跃链路', 'Active Channels')}
                value={String(channelCount)}
                helper={hasAvailableRoute ? pick('当前可参与调度的链路数', 'Routes currently available for dispatch') : pick('尚未检测到可用链路', 'No active route detected')}
              />
              <MetricTile
                label={pick('有效密钥', 'Valid Keys')}
                value={String(stats.valid)}
                helper={pick(`密钥管理器中共登记 ${stats.total} 个密钥槽位`, `${stats.total} total key slots are registered in the key manager`)}
              />
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('今日消耗', 'Spend Today')}</div>
                <div className="settings-reference-card__title">{pick('成本快照', 'Cost Snapshot')}</div>
              </div>
              <SettingsBadge tone={todayCostUsd > 0 ? 'amber' : 'neutral'}>
                {todayCostUsd > 0 ? pick('持续跟踪', 'Tracking') : pick('暂无消耗', 'No Spend')}
              </SettingsBadge>
            </div>
            <div className="settings-reference-kpi__value">{formatUsd(todayCostUsd)}</div>
            <div className="settings-reference-kpi__helper">
              {todayRechargeCount > 0
                ? pick(`今天新增了 ${todayRechargeCount} 条充值记录。`, `${todayRechargeCount} recharge records were added today.`)
                : pick('今天账本里还没有新的充值流水。', 'No recharge movement has been written to the ledger today.')}
            </div>
            <div className="mt-5 settings-reference-metric-grid">
              <MetricTile
                label={pick('余额', 'Balance')}
                value={remainingBalanceDisplay}
                helper={pick('当前工作区可用积分', 'Remaining credits currently available to the workspace')}
              />
              <MetricTile
                label={pick('最近充值', 'Latest Recharge')}
                value={latestRecharge ? formatDateTime(latestRecharge.created_at) : pick('暂无记录', 'No record')}
                helper={pick('最近一次余额充值事件', 'Most recent balance top-up event')}
              />
            </div>
          </section>
        </div>
        </SettingsSection>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('请求趋势', 'Request Trend')}</div>
                <div className="settings-reference-card__title">{pick('4 小时窗口流量', 'Traffic by 4-Hour Window')}</div>
                <div className="settings-reference-card__meta">
                  {pick('基于今天的真实调用数据生成，用来快速判断流量高峰和空窗。', 'Built from today’s real request buckets to highlight peak and idle windows.')}
                </div>
              </div>
              <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>
                {todayUsageCount > 0 ? pick('实时更新', 'Updated Live') : pick('暂无样本', 'No Samples')}
              </SettingsBadge>
            </div>

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

            <div className="mt-5 settings-reference-metric-grid">
              <MetricTile
                label={pick('高峰窗口', 'Peak Window')}
                value={usageBuckets.slice().sort((left, right) => right.count - left.count)[0]?.label || '00:00'}
                helper={pick('今天调用最密集的 4 小时时段', 'Most active 4-hour segment recorded today')}
              />
              <MetricTile
                label={pick('平均窗口', 'Average Window')}
                value={formatCompactNumber(todayUsageCount / Math.max(usageBuckets.length, 1))}
                helper={pick('每个 4 小时桶的平均请求数', 'Mean request count per 4-hour bucket')}
              />
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('系统健康度', 'System Health')}</div>
                <div className="settings-reference-card__title">{pick('运行环指标', 'Operational Rings')}</div>
                <div className="settings-reference-card__meta">
                  {pick('从链路、日志和存储三个维度判断当前工作区状态。', 'A compact health stack for routing, logging, and storage readiness.')}
                </div>
              </div>
              <LayoutDashboard size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 settings-reference-rings">
              <RingRow
                label={pick('链路覆盖率', 'Channel Coverage')}
                percent={channelCoverage}
                helper={
                  hasAvailableRoute
                    ? pick(`${channelCount} 条链路可参与调度。`, `${channelCount} routes are currently available across official and third-party pools.`)
                    : pick('当前没有可直接调度的链路。', 'No dispatch-ready route is available right now.')
                }
                color="rgb(123 179 255)"
              />
              <RingRow
                label={pick('日志健康度', 'Log Health')}
                percent={logHealth}
                helper={
                  importantLogCount > 0
                    ? pick(`今日有 ${importantLogCount} 条警告或错误日志。`, `${importantLogCount} warning or error entries are in today’s stream.`)
                    : pick('今日实时日志中没有警告或错误。', 'No warning or error entries are present in today’s live stream.')
                }
                color={hasCriticalLogs ? 'rgb(255 122 122)' : 'rgb(52 211 153)'}
              />
              <RingRow
                label={pick('存储就绪度', 'Storage Readiness')}
                percent={storageHealth}
                helper={
                  storageMode
                    ? pick(`${storageModeLabel} 已设为当前存储目标。`, `${storageModeLabel} is configured as the active storage target.`)
                    : pick('还没有固定存储目标。', 'A storage target has not been pinned yet.')
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
                <div className="settings-reference-card__eyebrow">{pick('最近活动', 'Recent Activity')}</div>
                <div className="settings-reference-card__title">{pick('调用与告警流', 'Live Consumption & Alerts')}</div>
                <div className="settings-reference-card__meta">
                  {pick('聚合最近一次调用、充值、日志和链路状态，方便你一键跳转到对应页面处理。', 'Jump straight into billing, routing, or logs from the most recent activity feed.')}
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
                <div className="settings-reference-card__eyebrow">{pick('存储分布', 'Storage Distribution')}</div>
                <div className="settings-reference-card__title">{pick('缓存与模式快照', 'Cache & Mode Snapshot')}</div>
                <div className="settings-reference-card__meta">
                  {pick('用来查看当前缓存体积、存储模式和图片数量是否健康。', 'Inspect cache footprint, storage mode, and image volume in one place.')}
                </div>
              </div>
              <HardDrive size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="settings-reference-kpi__value">{storageUsageMb.toFixed(2)} MB</div>
            <div className="settings-reference-kpi__helper">
              {pick(`当前工作区缓存中追踪到 ${storedImages} 张图片。`, `${storedImages} stored images tracked in the current workspace cache.`)}
            </div>

            <div className="mt-4">
              <ProgressBar
                progress={storageProgress}
                tone={storageProgress >= 85 ? 'rose' : storageProgress >= 60 ? 'amber' : 'indigo'}
                showLabel={false}
              />
              <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">
                {pick('按 1 GB 参考阈值可视化，用于快速判断容量压力。', 'Visualised against a 1 GB reference threshold for quick capacity checks.')}
              </div>
            </div>

            <div className="settings-reference-segments">
              <span className={`settings-reference-segment ${storageMode === 'browser' ? 'is-active' : ''}`.trim()} />
              <span className={`settings-reference-segment ${storageMode === 'opfs' ? 'is-active' : ''}`.trim()} />
              <span className={`settings-reference-segment ${storageMode === 'local' ? 'is-active' : ''}`.trim()} />
            </div>

            <div className="mt-5 settings-reference-metric-grid">
              <MetricTile
                label={pick('主存储模式', 'Primary Mode')}
                value={storageModeLabel}
                helper={pick('当前本地资源的默认落盘位置', 'The current destination used for local asset persistence')}
              />
              <MetricTile
                label={pick('图片记录', 'Stored Images')}
                value={formatNumber(storedImages)}
                helper={pick('在本地缓存层中检测到的图片记录数', 'Detected image records in the local cache layer')}
              />
              <MetricTile
                label={pick('在线供应商', 'Providers Online')}
                value={formatNumber(activeProviderCount)}
                helper={pick('当前允许参与调度的第三方供应商', 'Third-party providers currently allowed to participate')}
              />
              <MetricTile
                label={pick('最近告警', 'Latest Alert')}
                value={latestLog ? formatDateTime(latestLog.timestamp) : pick('无告警', 'No alert')}
                helper={latestLog ? latestLog.source : pick('系统日志当前稳定', 'System logs are currently stable')}
              />
            </div>

            {!hasAvailableRoute && !storageMode ? (
              <div className="mt-5">
                <EmptyState
                  title={pick('设置尚未完成', 'Setup is still incomplete')}
                  description={pick('至少接入一条 API 链路并配置一个存储模式后，这个总览页才会完全进入稳定状态。', 'Connect at least one API route and assign a storage mode to bring this dashboard fully online.')}
                />
              </div>
            ) : null}
          </section>
        </div>

        {importantLogCount > 0 ? (
          <section className="settings-reference-card settings-reference-card--soft">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('风险提示', 'Risk Reminder')}</div>
                <div className="settings-reference-card__title">{pick('当前存在需要关注的日志信号', 'Warnings Need Review')}</div>
                <div className="settings-reference-card__meta">
                  {pick('建议优先进入系统日志页排查错误和警告来源。', 'Open the system logs page first if you want to triage the most urgent issues.')}
                </div>
              </div>
              <AlertTriangle size={18} className="text-[var(--state-warning-text)]" />
            </div>
            <div className="mt-4 text-[14px] leading-6 text-[var(--text-secondary)]">
              {latestLog?.message || pick('已经检测到需要关注的日志条目。', 'There are warning or error entries waiting to be reviewed.')}
            </div>
          </section>
        ) : null}
      </div>
    </SettingsViewShell>
  );
};

export default DashboardView;
