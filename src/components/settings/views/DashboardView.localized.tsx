import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Coins,
  HardDrive,
  KeyRound,
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
import { StatusBadge } from '../ui/index';

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
    [usageLogs],
  );

  const importantLogs = useMemo(
    () =>
      logs.filter(
        (item) =>
          item.level === LogLevel.WARNING ||
          item.level === LogLevel.ERROR ||
          item.level === LogLevel.CRITICAL,
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

  const recentActivity = useMemo(
    () => [
      {
        key: 'usage',
        icon: <Activity size={18} />,
        title: pick('最近请求', 'Recent requests'),
        summary:
          latestUsage?.model_name ||
          latestUsage?.model_id ||
          latestUsage?.description ||
          pick('今天还没有模型请求。', 'No model request has been recorded today.'),
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
        status: <SettingsBadge tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}>{pick('账单', 'Billing')}</SettingsBadge>,
        onClick: () => onNavigate('consumption-records'),
      },
      {
        key: 'logs',
        icon: <ScrollText size={18} />,
        title: pick('系统日志', 'System logs'),
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
        title: pick('链路状态', 'Route status'),
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
        label: dashboardStatusSummaryLabel,
        value: hasCriticalLogs
          ? pick('需要处理', 'Needs attention')
          : hasAvailableRoute
            ? pick('已就绪', 'Ready')
            : pick('待配置', 'Setup required'),
        helper: hasAvailableRoute
          ? pick(`${channelCount} 条链路已接入`, `${channelCount} routes are available`)
          : pick('先完成 API 配置', 'Configure API before continuing'),
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
        helper: pick(`${formatNumber(storedImages)} 张图片 · ${storageUsageMb.toFixed(0)} MB`, `${formatNumber(storedImages)} images · ${storageUsageMb.toFixed(0)} MB`),
      },
    ],
    [
      channelCount,
      dashboardStatusSummaryLabel,
      formatNumber,
      formatUsd,
      hasAvailableRoute,
      hasCriticalLogs,
      importantLogCount,
      latestLog,
      pick,
      remainingBalanceDisplay,
      storageModeLabel,
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

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <SettingsHero
          eyebrow={pick('高级设置', 'Advanced settings')}
          title={dashboardMeta.title}
          description={pick(
            '把 API、账单、日志和存储留在第一屏，先看状态，再进入具体配置。',
            'Keep API, billing, logs, and storage on the first screen before opening a detailed page.',
          )}
          badge={<SettingsBadge tone={statusTone}>{statusLabel}</SettingsBadge>}
          actions={(
            <SettingsActionButton
              icon={ArrowRight}
              tone="primary"
              onClick={() => onNavigate(dashboardPrimaryAction.target)}
            >
              {dashboardPrimaryAction.label}
            </SettingsActionButton>
          )}
        />

        <SettingsSection
          title={pick('快捷入口', 'Quick access')}
          eyebrow={pick('一键入口', 'Direct actions')}
          description={pick(
            '常用操作直接放前面，避免在设置里反复切换。',
            'Keep the common actions upfront so the workbench stays quick to use.',
          )}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <QuickActionCard
              title={pick('配置 API', 'Configure API')}
              description={pick('本地、官方和供应商', 'Local, official, and provider routes')}
              icon={<KeyRound size={18} />}
              onClick={() => onNavigate('api-management')}
            />
            <QuickActionCard
              title={pick('账单与余额', 'Billing')}
              description={pick('查看消耗、充值和余额', 'Review spend, recharges, and balance')}
              icon={<Coins size={18} />}
              onClick={() => onNavigate('consumption-records')}
            />
            <QuickActionCard
              title={pick('系统日志', 'System logs')}
              description={pick('优先排查错误和警告', 'Inspect errors and warnings first')}
              icon={<ScrollText size={18} />}
              onClick={() => onNavigate('system-logs')}
            />
            <QuickActionCard
              title={pick('存储设置', 'Storage')}
              description={pick('查看模式、缓存和容量', 'Review mode, cache, and capacity')}
              icon={<HardDrive size={18} />}
              onClick={() => onNavigate('storage-settings')}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title={pick('工作区快照', 'Workspace snapshot')}
          eyebrow={pick('当前状态', 'Current state')}
          description={pick(
            '只保留当前最关键的 4 项状态。',
            'Keep only the four signals you need most before drilling down.',
          )}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {snapshotTiles.map((item) => (
              <MetricTile
                key={item.label}
                label={item.label}
                value={item.value}
                helper={item.helper}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title={pick('最近活动', 'Recent activity')}
          eyebrow={pick('最新信号', 'Latest signals')}
          description={pick(
            '最近的调用、账单和日志集中在这里。',
            'The latest requests, billing updates, and log signals stay here.',
          )}
        >
          <div className="settings-reference-list">
            {recentActivity.map(({ key, ...item }) => (
              <DashboardActivityRow key={key} {...item} />
            ))}
          </div>
        </SettingsSection>
      </div>
    </SettingsViewShell>
  );
};

export default DashboardView;
