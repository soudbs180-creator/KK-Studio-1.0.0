import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  DollarSign,
  HardDrive,
  Key,
  LayoutDashboard,
  RefreshCw,
  ScrollText,
  Shield,
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
  EmptyState,
  MetricCard,
  ProgressBar,
  SecondaryButton,
  SettingCard,
  StatusBadge,
} from '../ui/index';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

type DashboardTone = 'indigo' | 'emerald' | 'amber' | 'rose' | 'neutral';

const formatMetricNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(value);

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
  if (mode === 'local') return '本地文档夹';
  if (mode === 'opfs') return '设备私有存储';
  if (mode === 'browser') return '浏览器存储';
  return '未设置';
};

const dashboardToneToMetricTone = (tone: DashboardTone): DashboardTone => tone;

const DashboardStatusRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  progress?: number;
  tone: DashboardTone;
  onClick?: () => void;
}> = ({ icon, title, description, value, progress, tone, onClick }) => {
  const status = tone === 'rose' ? 'error' : tone === 'amber' ? 'warning' : 'online';
  const progressTone = tone === 'rose' ? 'rose' : tone === 'amber' ? 'amber' : 'emerald';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-[var(--border-light)] p-3 text-left transition-all duration-200 hover:border-[var(--border-default)] active:scale-[0.99]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--bg-hover)_92%,transparent)] text-[var(--text-primary)]">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-[var(--text-primary)]">{title}</div>
            <div className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{description}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">{value}</div>
          <div className="mt-1 flex justify-end">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>
      {typeof progress === 'number' ? (
        <div className="mt-3">
          <ProgressBar progress={progress} tone={progressTone} showLabel={false} />
        </div>
      ) : null}
    </button>
  );
};

const DashboardActivityRow: React.FC<{
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
    className="w-full rounded-xl border border-[var(--border-light)] p-3 text-left transition-all duration-200 hover:border-[var(--border-default)] active:scale-[0.99]"
    style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}
  >
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--bg-hover)_92%,transparent)] text-[var(--text-primary)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-medium text-[var(--text-primary)]">{title}</div>
          {value ? <div className="text-[14px] font-semibold text-[var(--text-primary)]">{value}</div> : null}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-[var(--text-secondary)]">{summary}</div>
        <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">{meta}</div>
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

  useEffect(() => {
    let isMounted = true;
    const refresh = async () => {
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

      if (!isMounted) return;
      setStats(nextStats);
      setTodayCostUsd(cost.totalCostUsd || 0);
      setTodayTokens(cost.totalTokens || 0);
      setOfficialCount(official.length);
      setProviderCount(providers.length);
      setActiveProviderCount(providers.filter((item) => item.isActive).length);
      setStorageMode(nextStorageMode);
    };

    void refresh();
    const unsubscribe = keyManager.subscribe(() => void refresh());
    return () => {
      isMounted = false;
      unsubscribe();
    };
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

  const metrics: Array<{
    value: string;
    label: string;
    helper: string;
    tone: DashboardTone;
  }> = [
    {
      value: hasAvailableRoute ? `${officialCount + activeProviderCount}` : '0',
      label: '可用链路',
      helper: hasAvailableRoute ? `官方 ${officialCount} · 在线供应商 ${activeProviderCount}` : '当前没有可用接口',
      tone: hasAvailableRoute ? 'indigo' : 'rose',
    },
    {
      value: `$${todayCostUsd.toFixed(2)}`,
      label: '今日消费',
      helper: `${formatMetricNumber(todayTokens)} Tokens · ${todayUsageCount} 次调用`,
      tone: todayCostUsd > 0 ? 'amber' : 'neutral',
    },
    {
      value: todayRechargeCount > 0 ? `${todayRechargeCount} 笔` : '暂无',
      label: '今日充值',
      helper: latestRecharge ? `最近 ${formatDateTime(latestRecharge.created_at)}` : '今天没有新充值',
      tone: todayRechargeCount > 0 ? 'emerald' : 'neutral',
    },
    {
      value: importantLogCount > 0 ? `${importantLogCount} 项` : '稳定',
      label: '待处理',
      helper: hasCriticalLogs ? '存在关键错误' : importantLogCount > 0 ? '存在警告日志' : '当前无异常',
      tone: hasCriticalLogs ? 'rose' : importantLogCount > 0 ? 'amber' : 'emerald',
    },
  ];

  const statusRows = [
    {
      icon: <Key size={18} />,
      title: '密钥池健康',
      description:
        stats.total > 0
          ? `有效 ${stats.valid} / 总计 ${stats.total} · 限流 ${stats.rateLimited}`
          : '还没有可统计的密钥',
      value: stats.total > 0 ? `${keyHealthPercent}%` : '未配置',
      progress: stats.total > 0 ? keyHealthPercent : undefined,
      tone:
        stats.total === 0 || stats.valid === 0
          ? 'rose'
          : stats.invalid > 0 || stats.rateLimited > 0
            ? 'amber'
            : 'emerald',
      onClick: () => onNavigate('api-management'),
    },
    {
      icon: <LayoutDashboard size={18} />,
      title: '供应商连通',
      description:
        providerCount > 0
          ? `在线 ${activeProviderCount} / 总计 ${providerCount} 个供应商`
          : officialCount > 0
            ? '当前以官方接口为主'
            : '还没有接入第三方供应商',
      value: providerCount > 0 ? `${activeProviderCount}/${providerCount}` : '未接入',
      progress: providerCount > 0 ? Math.round((activeProviderCount / providerCount) * 100) : undefined,
      tone:
        providerCount === 0
          ? 'neutral'
          : activeProviderCount === 0
            ? 'rose'
            : activeProviderCount < providerCount
              ? 'amber'
              : 'emerald',
      onClick: () => onNavigate('api-management'),
    },
    {
      icon: <HardDrive size={18} />,
      title: '存储状态',
      description: storageMode ? '图片存储位置已明确，可直接管理' : '尚未设置存储位置',
      value: storageModeLabel,
      tone: storageMode ? 'emerald' : 'amber',
      onClick: () => onNavigate('storage-settings'),
    },
  ] as const;

  const activityRows = [
    {
      icon: <RefreshCw size={18} />,
      title: '最近生成',
      summary:
        latestUsage?.model_name || latestUsage?.model_id || latestUsage?.description || '今天还没有生成记录',
      meta: latestUsage ? formatDateTime(latestUsage.created_at) : '等待新的生成记录',
      value: todayUsageCount > 0 ? `${todayUsageCount} 次` : undefined,
      onClick: () => onNavigate('consumption-records'),
    },
    {
      icon: <DollarSign size={18} />,
      title: '充值与余额',
      summary:
        latestRecharge
          ? `最近充值 ${formatDateTime(latestRecharge.created_at)}`
          : `当前余额 ${formatMetricNumber(balance, Number.isInteger(balance) ? 0 : 2)}`,
      meta: todayRechargeCount > 0 ? `今天新增 ${todayRechargeCount} 笔充值` : '今天没有新的充值记录',
      value: todayRechargeCount > 0 ? `${todayRechargeCount} 笔` : undefined,
      onClick: () => onNavigate('consumption-records'),
    },
    {
      icon: <ScrollText size={18} />,
      title: '系统日志',
      summary: latestLog?.message || '今日暂无需要优先查看的日志',
      meta: latestLog ? `${formatDateTime(latestLog.timestamp)} · ${latestLog.source}` : '系统运行正常',
      value: importantLogCount > 0 ? `${importantLogCount} 条` : undefined,
      onClick: () => onNavigate('system-logs'),
    },
  ];

  const priorityItems: Array<{
    title: string;
    description: string;
    actionLabel: string;
    actionView: string;
  }> = [];

  if (!hasAvailableRoute) {
    priorityItems.push({
      title: '缺少可用链路',
      description: '当前没有配置任何可用接口，建议先补齐官方接口或第三方供应商。',
      actionLabel: '前往 API 管理',
      actionView: 'api-management',
    });
  }
  if (hasCriticalLogs) {
    priorityItems.push({
      title: '存在关键错误',
      description: latestLog?.message || '系统检测到需要优先处理的错误日志。',
      actionLabel: '查看系统日志',
      actionView: 'system-logs',
    });
  }
  if (!storageMode) {
    priorityItems.push({
      title: '存储尚未设置',
      description: '建议尽快确定图片存储位置，后续清理和迁移会更方便。',
      actionLabel: '打开存储设置',
      actionView: 'storage-settings',
    });
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            value={metric.value}
            label={metric.label}
            helper={metric.helper}
            tone={dashboardToneToMetricTone(metric.tone)}
          />
        ))}
      </div>

      {priorityItems.length > 0 ? (
        <SettingCard title="待处理">
          <div className="space-y-3">
            {priorityItems.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] p-3"
                style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 14%, transparent)' }}
              >
                <div className="text-[15px] font-medium text-[var(--text-primary)]">{item.title}</div>
                <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">{item.description}</div>
                <div className="mt-3">
                  <SecondaryButton onClick={() => onNavigate(item.actionView)}>
                    {item.actionLabel}
                    <ArrowRight size={14} className="ml-1 inline-block" />
                  </SecondaryButton>
                </div>
              </div>
            ))}
          </div>
        </SettingCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
        <SettingCard title="系统状态">
          <div className="space-y-3">
            {statusRows.map((row) => (
              <DashboardStatusRow key={row.title} {...row} />
            ))}
          </div>
        </SettingCard>

        <SettingCard title="最近活动">
          <div className="space-y-3">
            {activityRows.map((row) => (
              <DashboardActivityRow key={row.title} {...row} />
            ))}
          </div>
        </SettingCard>
      </div>

      {importantLogCount === 0 ? (
        <SettingCard title="系统反馈">
          <EmptyState title="今日暂无高优先级日志" description="当前没有需要立刻处理的警告或错误。" />
        </SettingCard>
      ) : null}
    </div>
  );
};

export default DashboardView;
