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
import keyManager from '../../../services/auth/keyManager';
import { useBilling } from '../../../context/BillingContext';
import { getTodayCosts } from '../../../services/billing/costService';
import { getStorageMode, type StorageMode } from '../../../services/storage/storagePreference';
import {
  getTodayLogs,
  LogLevel,
  subscribeToLogs,
  type SystemLogEntry,
} from '../../../services/system/systemLogService';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_OVERLAY_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';
import { EmptyState, ProgressBar, StatusBadge } from '../ui/index';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

type Tone = 'indigo' | 'emerald' | 'amber' | 'rose' | 'neutral';

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value?: string | number | null) => {
  if (!value) return '暂无记录';
  const target = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(target.getTime())) return '暂无记录';
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
  if (mode === 'local') return '本地文件夹';
  if (mode === 'opfs') return '设备私有存储';
  if (mode === 'browser') return '浏览器存储';
  return '尚未设置';
};

const toneToBadge = (tone: Tone): 'indigo' | 'emerald' | 'amber' | 'rose' | 'neutral' => {
  if (tone === 'emerald') return 'emerald';
  if (tone === 'amber') return 'amber';
  if (tone === 'rose') return 'rose';
  if (tone === 'indigo') return 'indigo';
  return 'neutral';
};

const DashboardHealthRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  progress?: number;
  tone: Tone;
  actionLabel: string;
  onClick?: () => void;
}> = ({ icon, title, description, value, progress, tone, actionLabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-[24px] border p-4 text-left transition-all duration-200 hover:opacity-90"
    style={SETTINGS_ELEVATED_STYLE}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={SETTINGS_OVERLAY_STYLE}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 break-words text-[16px] font-semibold text-[var(--text-primary)]">{title}</div>
            <SettingsBadge tone={toneToBadge(tone)}>{actionLabel}</SettingsBadge>
          </div>
          <div className="mt-1 break-words text-[13px] leading-6 text-[var(--text-secondary)]">{description}</div>
        </div>
      </div>
      <div className="max-w-[40%] shrink-0 text-right">
        <div className="break-words text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          {value}
        </div>
      </div>
    </div>
    {typeof progress === 'number' ? (
      <div className="mt-4">
        <ProgressBar
          progress={progress}
          tone={tone === 'rose' ? 'rose' : tone === 'amber' ? 'amber' : 'emerald'}
          showLabel={false}
        />
      </div>
    ) : null}
  </button>
);

const DashboardActivityCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  summary: string;
  meta: string;
  value?: string;
  onClick?: () => void;
}> = ({ icon, title, summary, meta, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-[24px] border p-4 text-left transition-all duration-200 hover:opacity-90"
    style={SETTINGS_ELEVATED_STYLE}
  >
    <div className="flex items-start gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={SETTINGS_OVERLAY_STYLE}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[var(--text-primary)]">{title}</div>
          {value ? (
            <div className="shrink-0 text-[14px] font-semibold text-[var(--text-primary)]">{value}</div>
          ) : null}
        </div>
        <div className="mt-1 truncate text-[13px] text-[var(--text-secondary)]">{summary}</div>
        <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">{meta}</div>
      </div>
    </div>
  </button>
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
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getTodayLogs());
  const [refreshing, setRefreshing] = useState(false);

  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      const nextStats = keyManager.getStats();
      const allSlots = keyManager.getSlots();
      const providers = keyManager.getProviders();
      const cost = getTodayCosts();
      const nextStorageMode = await getStorageMode();

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

  const keyHealthPercent =
    stats.total > 0 ? Math.max(0, Math.min(100, Math.round((stats.valid / stats.total) * 100))) : 0;

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
      height: bucket.count === 0 ? 16 : Math.max(20, Math.round((bucket.count / maxCount) * 110)),
    }));
  }, [todayUsageLogs]);

  const todayUsageCount = todayUsageLogs.length;
  const todayRechargeCount = todayRechargeLogs.length;
  const latestUsage = todayUsageLogs[0] || usageLogs[0] || null;
  const latestRecharge = todayRechargeLogs[0] || billingLogs[0] || null;
  const latestLog = importantLogs.slice(-1)[0] || null;
  const importantLogCount = importantLogs.length;
  const storageModeLabel = getStorageModeLabel(storageMode);
  const hasCriticalLogs = importantLogs.some(
    (item) => item.level === LogLevel.ERROR || item.level === LogLevel.CRITICAL
  );
  const hasAvailableRoute = stats.valid > 0 || activeProviderCount > 0;
  const providerHealthPercent =
    providerCount > 0 ? Math.round((activeProviderCount / providerCount) * 100) : hasAvailableRoute ? 100 : 0;
  const storageReadyPercent = storageMode ? 100 : 42;

  const heroTone: Tone = hasCriticalLogs ? 'rose' : hasAvailableRoute ? 'emerald' : 'amber';
  const heroMetrics = (
    <>
      <SettingsMetricCard
        label="可用链路"
        value={hasAvailableRoute ? `${officialCount + activeProviderCount}` : '0'}
        helper={
          hasAvailableRoute
            ? `官方 ${officialCount} 条，在线供应商 ${activeProviderCount} 个`
            : '当前还没有可用接口链路'
        }
        icon={KeyRound}
        tone={hasAvailableRoute ? 'indigo' : 'rose'}
      />
      <SettingsMetricCard
        label="今日消耗"
        value={formatUsd(todayCostUsd)}
        helper={`${formatNumber(todayTokens)} 令牌，${todayUsageCount} 次调用`}
        icon={Wallet}
        tone={todayCostUsd > 0 ? 'amber' : 'neutral'}
      />
      <SettingsMetricCard
        label="今日充值"
        value={todayRechargeCount > 0 ? `${todayRechargeCount} 笔` : '暂无'}
        helper={
          latestRecharge ? `最近一笔：${formatDateTime(latestRecharge.created_at)}` : '今天没有新的充值记录'
        }
        icon={Coins}
        tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}
      />
      <SettingsMetricCard
        label="风险事件"
        value={importantLogCount > 0 ? `${importantLogCount} 条` : '稳定'}
        helper={
          hasCriticalLogs ? '存在错误或严重告警' : importantLogCount > 0 ? '存在待处理警告' : '当前没有高优先级问题'
        }
        icon={AlertTriangle}
        tone={hasCriticalLogs ? 'rose' : importantLogCount > 0 ? 'amber' : 'emerald'}
      />
    </>
  );

  const healthRows = [
    {
      icon: <KeyRound size={18} className="text-[var(--text-primary)]" />,
      title: '密钥池健康度',
      description:
        stats.total > 0
          ? `有效 ${stats.valid} / 总计 ${stats.total}，限流 ${stats.rateLimited}，异常 ${stats.invalid}`
          : '还没有可统计的官方接口或密钥池数据。',
      value: stats.total > 0 ? `${keyHealthPercent}%` : '未配置',
      progress: stats.total > 0 ? keyHealthPercent : undefined,
      tone:
        stats.total === 0 || stats.valid === 0
          ? 'rose'
          : stats.invalid > 0 || stats.rateLimited > 0
            ? 'amber'
            : 'emerald',
      actionLabel: '查看接口',
      onClick: () => onNavigate('api-management'),
    },
    {
      icon: <LayoutDashboard size={18} className="text-[var(--text-primary)]" />,
      title: '供应商连通率',
      description:
        providerCount > 0
          ? `在线 ${activeProviderCount} / 总计 ${providerCount} 个第三方供应商`
          : officialCount > 0
            ? '当前主要由官方接口承担请求调度。'
            : '还没有接入第三方供应商。',
      value: providerCount > 0 ? `${activeProviderCount}/${providerCount}` : '未接入',
      progress: providerCount > 0 ? providerHealthPercent : undefined,
      tone:
        providerCount === 0
          ? hasAvailableRoute
            ? 'neutral'
            : 'rose'
          : activeProviderCount === 0
            ? 'rose'
            : activeProviderCount < providerCount
              ? 'amber'
              : 'emerald',
      actionLabel: '管理供应商',
      onClick: () => onNavigate('api-management'),
    },
    {
      icon: <HardDrive size={18} className="text-[var(--text-primary)]" />,
      title: '存储状态',
      description:
        storageMode
          ? '图片和项目数据已经有明确的落盘策略，可继续清理或迁移。'
          : '尚未设置固定存储位置，建议尽快完成。',
      value: storageModeLabel,
      progress: storageReadyPercent,
      tone: storageMode ? 'emerald' : 'amber',
      actionLabel: '打开存储设置',
      onClick: () => onNavigate('storage-settings'),
    },
  ] as const;

  const activityRows = [
    {
      icon: <Activity size={18} className="text-[var(--text-primary)]" />,
      title: '最近生成',
      summary:
        latestUsage?.model_name ||
        latestUsage?.model_id ||
        latestUsage?.description ||
        '今天还没有新的生成记录。',
      meta: latestUsage ? formatDateTime(latestUsage.created_at) : '等待新的调用事件',
      value: todayUsageCount > 0 ? `${todayUsageCount} 次` : undefined,
      onClick: () => onNavigate('consumption-records'),
    },
    {
      icon: <Wallet size={18} className="text-[var(--text-primary)]" />,
      title: '充值与余额',
      summary: latestRecharge
        ? `最近充值时间：${formatDateTime(latestRecharge.created_at)}`
        : `当前余额：${formatNumber(balance, Number.isInteger(balance) ? 0 : 2)}`,
      meta: todayRechargeCount > 0 ? `今日新增 ${todayRechargeCount} 笔充值` : '今天没有新的充值记录',
      value: todayRechargeCount > 0 ? `${todayRechargeCount} 笔` : undefined,
      onClick: () => onNavigate('consumption-records'),
    },
    {
      icon: <ScrollText size={18} className="text-[var(--text-primary)]" />,
      title: '系统日志',
      summary: latestLog?.message || '今天没有高优先级的告警或错误。',
      meta: latestLog ? `${formatDateTime(latestLog.timestamp)} · ${latestLog.source}` : '系统运行稳定',
      value: importantLogCount > 0 ? `${importantLogCount} 条` : undefined,
      onClick: () => onNavigate('system-logs'),
    },
  ];

  const priorityItems: Array<{
    title: string;
    description: string;
    actionLabel: string;
    actionView: string;
    tone: Tone;
  }> = [];

  if (!hasAvailableRoute) {
    priorityItems.push({
      title: '缺少可用链路',
      description: '当前没有任何可用接口，建议先补齐官方接口或第三方供应商。',
      actionLabel: '前往 API 管理',
      actionView: 'api-management',
      tone: 'rose',
    });
  }

  if (hasCriticalLogs) {
    priorityItems.push({
      title: '存在高优先级日志',
      description: latestLog?.message || '系统检测到需要优先处理的错误日志。',
      actionLabel: '查看系统日志',
      actionView: 'system-logs',
      tone: 'amber',
    });
  }

  if (!storageMode) {
    priorityItems.push({
      title: '存储尚未配置完成',
      description: '建议尽快确定图片存储位置，后续清理和迁移会更顺手。',
      actionLabel: '打开存储设置',
      actionView: 'storage-settings',
      tone: 'amber',
    });
  }

  return (
    <SettingsViewShell>
      <SettingsHero
        eyebrow="高级设置"
        title="总览"
        description="从链路、消费、日志和存储四个维度快速判断系统状态，优先处理会影响生产的异常。"
        icon={LayoutDashboard}
        tone={toneToBadge(heroTone)}
        badge={
          <SettingsBadge tone={toneToBadge(heroTone)}>
            {hasCriticalLogs ? '存在风险' : hasAvailableRoute ? '系统运行中' : '待补齐链路'}
          </SettingsBadge>
        }
        actions={
          <>
            <SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refreshDashboard()}>
              刷新总览
            </SettingsActionButton>
            <SettingsActionButton icon={ArrowRight} tone="primary" onClick={() => onNavigate('api-management')}>
              管理 API
            </SettingsActionButton>
          </>
        }
        metrics={heroMetrics}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <SettingsSection
          title="调用概况"
          eyebrow="今日调用"
          description="根据今天的请求分布生成简报，便于快速判断调用高峰和预算压力。"
        >
          <div className="space-y-4">
            <div className="rounded-[24px] border p-5" style={SETTINGS_ELEVATED_STYLE}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[12px] font-medium tracking-[0.16em] text-[var(--text-tertiary)]">
                    API 请求趋势
                  </div>
                  <div className="mt-2 text-[40px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                    {formatNumber(todayUsageCount)}
                  </div>
                  <div className="mt-2 text-[13px] text-[var(--text-secondary)]">
                    今日累计 {formatNumber(todayTokens)} 令牌，支出 {formatUsd(todayCostUsd)}
                  </div>
                </div>
                <SettingsBadge tone={todayUsageCount > 0 ? 'indigo' : 'neutral'}>
                  {todayUsageCount > 0 ? '按 4 小时分段' : '等待新调用'}
                </SettingsBadge>
              </div>

              <div className="mt-8 flex items-end gap-2">
                {usageBuckets.map((bucket) => (
                  <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-[12px] bg-[linear-gradient(180deg,rgba(96,165,250,0.92)_0%,rgba(37,99,235,0.55)_100%)]"
                      style={{ height: `${bucket.height}px` }}
                    />
                    <div className="text-[11px] text-[var(--text-tertiary)]">{bucket.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
                <div className="text-[12px] text-[var(--text-tertiary)]">当前余额</div>
                <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {formatNumber(balance, Number.isInteger(balance) ? 0 : 2)}
                </div>
                <div className="mt-2 text-[13px] text-[var(--text-secondary)]">可在消费记录里查看明细和充值流水。</div>
              </div>
              <div className="rounded-[22px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
                <div className="text-[12px] text-[var(--text-tertiary)]">今日充值</div>
                <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {todayRechargeCount > 0 ? `${todayRechargeCount} 笔` : '暂无'}
                </div>
                <div className="mt-2 text-[13px] text-[var(--text-secondary)]">
                  {latestRecharge ? `最近一笔：${formatDateTime(latestRecharge.created_at)}` : '今天没有新的充值动作。'}
                </div>
              </div>
              <div className="rounded-[22px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
                <div className="text-[12px] text-[var(--text-tertiary)]">日志风险</div>
                <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {importantLogCount > 0 ? `${importantLogCount} 条` : '稳定'}
                </div>
                <div className="mt-2 text-[13px] text-[var(--text-secondary)]">
                  {hasCriticalLogs ? '存在错误或严重告警，建议优先排查。' : '当前没有需要立刻处理的高优先级日志。'}
                </div>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="系统健康度"
          eyebrow="运行状态"
          description="这里聚合了接口、供应商和存储三个最容易影响可用性的关键面板。"
        >
          <div className="space-y-3">
            {healthRows.map((row) => (
              <DashboardHealthRow key={row.title} {...row} />
            ))}
          </div>
        </SettingsSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <SettingsSection
          title="最近活动"
          eyebrow="事件流"
          description="优先展示最近一条生成、充值和日志事件，方便快速回到对应模块继续处理。"
        >
          <div className="space-y-3">
            {activityRows.map((row) => (
              <DashboardActivityCard key={row.title} {...row} />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="待处理事项"
          eyebrow="运维提醒"
          description="只列出会影响链路、数据安全或运维效率的重点项。"
        >
          {priorityItems.length > 0 ? (
            <div className="space-y-3">
              {priorityItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border p-4"
                  style={
                    item.tone === 'rose'
                      ? {
                          borderColor: 'var(--state-danger-border)',
                          backgroundColor: 'var(--state-danger-bg)',
                        }
                      : {
                          borderColor: 'var(--state-warning-border)',
                          backgroundColor: 'var(--state-warning-bg)',
                        }
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-[16px] font-semibold text-[var(--text-primary)]">{item.title}</div>
                      <div className="mt-2 break-words text-[13px] leading-6 text-[var(--text-secondary)]">
                        {item.description}
                      </div>
                    </div>
                    <StatusBadge status={item.tone === 'rose' ? 'error' : 'warning'} />
                  </div>
                  <div className="mt-4">
                    <SettingsActionButton
                      icon={ArrowRight}
                      tone={item.tone === 'rose' ? 'danger' : 'secondary'}
                      onClick={() => onNavigate(item.actionView)}
                    >
                      {item.actionLabel}
                    </SettingsActionButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="当前没有待优先处理的事项"
              description="链路、日志和存储状态都比较稳定，可以直接处理日常配置。"
            />
          )}
        </SettingsSection>
      </div>

      {!latestLog && !latestUsage && !latestRecharge ? (
        <div className="rounded-[26px] border p-6" style={SETTINGS_ELEVATED_STYLE}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={SETTINGS_OVERLAY_STYLE}
            >
              <ShieldCheck size={18} className="text-[var(--text-primary)]" />
            </div>
            <div>
              <div className="break-words text-[16px] font-semibold text-[var(--text-primary)]">当前系统很安静</div>
              <div className="mt-1 break-words text-[13px] text-[var(--text-secondary)]">
                今天还没有新的关键事件写入，你可以从左侧继续进入具体设置页。
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsViewShell>
  );
};

export default DashboardView;
