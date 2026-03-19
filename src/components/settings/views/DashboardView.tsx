/**
 * Dashboard View - Extracted from SettingsPanel
 * 仪表盘视图 - 从 SettingsPanel 提取
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, DollarSign, HardDrive, Key, LayoutDashboard, RefreshCw, ScrollText } from 'lucide-react';
import keyManager from '../../../services/auth/keyManager';
import { getTodayCosts } from '../../../services/billing/costService';
import { getTodayLogs, LogLevel, subscribeToLogs, type SystemLogEntry } from '../../../services/system/systemLogService';
import { getStorageMode, type StorageMode } from '../../../services/storage/storagePreference';
import { useBilling } from '../../../context/BillingContext';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_SUCCESS_STYLE,
  SettingsBadge,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';

export type DashboardTone = 'indigo' | 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'neutral';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

type DashboardPriorityItem = {
  id: string;
  tone: DashboardTone;
  title: string;
  description: string;
  actionLabel: string;
  actionView: string;
};

const dashboardToneStyles: Record<DashboardTone, { iconStyle: React.CSSProperties; meterColor: string }> = {
  indigo: {
    iconStyle: {
      border: '1px solid var(--state-info-border)',
      backgroundColor: 'var(--state-info-bg)',
      color: 'var(--state-info-text)',
    },
    meterColor: 'var(--state-info-text)',
  },
  emerald: {
    iconStyle: {
      border: '1px solid var(--state-success-border)',
      backgroundColor: 'var(--state-success-bg)',
      color: 'var(--state-success-text)',
    },
    meterColor: 'var(--state-success-text)',
  },
  sky: {
    iconStyle: {
      border: '1px solid var(--state-info-border)',
      backgroundColor: 'var(--state-info-bg)',
      color: 'var(--state-info-text)',
    },
    meterColor: 'var(--state-info-text)',
  },
  amber: {
    iconStyle: {
      border: '1px solid var(--state-warning-border)',
      backgroundColor: 'var(--state-warning-bg)',
      color: 'var(--state-warning-text)',
    },
    meterColor: 'var(--state-warning-text)',
  },
  rose: {
    iconStyle: {
      border: '1px solid var(--state-danger-border)',
      backgroundColor: 'var(--state-danger-bg)',
      color: 'var(--state-danger-text)',
    },
    meterColor: 'var(--state-danger-text)',
  },
  slate: {
    iconStyle: {
      border: '1px solid var(--settings-border-subtle)',
      backgroundColor: 'var(--settings-surface-overlay)',
      color: 'var(--text-secondary)',
    },
    meterColor: 'var(--text-secondary)',
  },
  neutral: {
    iconStyle: {
      border: '1px solid var(--settings-border-subtle)',
      backgroundColor: 'var(--settings-surface-overlay)',
      color: 'var(--text-secondary)',
    },
    meterColor: 'var(--text-secondary)',
  },
};

const formatMetricNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(value);

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

const getStorageModeLabel = (mode: StorageMode | null) => {
  if (mode === 'local') return '本地文档夹';
  if (mode === 'opfs') return '设备私有存储';
  if (mode === 'browser') return '浏览器存储';
  return '未设置';
};

const DashboardInfoCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  tone: DashboardTone;
}> = ({ icon, title, value, description, tone }) => {
  const toneStyle = dashboardToneStyles[tone];
  return (
    <div className="settings-dashboard-card">
      <div className="settings-dashboard-card__header">
        <div className="settings-dashboard-card__icon" style={toneStyle.iconStyle}>
          {icon}
        </div>
        <SettingsBadge tone={tone} className="settings-dashboard-card__value">
          {value}
        </SettingsBadge>
      </div>
      <div className="settings-dashboard-card__title">{title}</div>
      <div className="settings-dashboard-card__description">{description}</div>
    </div>
  );
};

const DashboardCheckCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  tone: DashboardTone;
  progress?: number;
}> = ({ icon, title, description, value, tone, progress }) => {
  const toneStyle = dashboardToneStyles[tone];
  return (
    <div className="settings-dashboard-card">
      <div className="settings-dashboard-card__header">
        <div className="settings-dashboard-card__icon" style={toneStyle.iconStyle}>
          {icon}
        </div>
        <SettingsBadge tone={tone} className="settings-dashboard-card__value">
          {value}
        </SettingsBadge>
      </div>
      <div className="settings-dashboard-card__title">{title}</div>
      <div className="settings-dashboard-card__description">{description}</div>
      {typeof progress === 'number' && (
        <div className="settings-dashboard-card__meter">
          <span
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              backgroundColor: toneStyle.meterColor,
            }}
          />
        </div>
      )}
    </div>
  );
};

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
  const importantLogCount = importantLogs.length;
  const latestUsage = todayUsageLogs[0] || usageLogs[0] || null;
  const latestRecharge = todayRechargeLogs[0] || billingLogs[0] || null;
  const latestImportantLogs = importantLogs.slice(-3).reverse();
  const latestLog = latestImportantLogs[0];

  const storageModeLabel = getStorageModeLabel(storageMode);
  const hasCriticalLogs = importantLogs.some(
    (item) => item.level === LogLevel.ERROR || item.level === LogLevel.CRITICAL
  );
  const hasAvailableRoute = stats.valid > 0 || activeProviderCount > 0;

  const readinessTone: DashboardTone = !hasAvailableRoute
    ? 'rose'
    : hasCriticalLogs || stats.rateLimited > 0 || !storageMode
      ? 'amber'
      : 'emerald';
  const readinessLabel =
    readinessTone === 'emerald' ? '已就绪' : readinessTone === 'amber' ? '需留意' : '待补齐';
  const readinessDescription =
    readinessTone === 'emerald'
      ? '接口、存储和日志状态基本正常，可以直接继续使用。'
      : readinessTone === 'amber'
        ? '链路大体可用，但日志、限流或存储状态可能影响稳定性。'
        : '当前缺少可用链路或基础配置，建议先进入 API 管理补齐。';

  const keyTone: DashboardTone =
    stats.total === 0 || stats.valid === 0
      ? 'rose'
      : stats.invalid > 0 || stats.rateLimited > 0
        ? 'amber'
        : 'emerald';
  const providerTone: DashboardTone =
    providerCount === 0
      ? 'slate'
      : activeProviderCount === 0
        ? 'rose'
        : activeProviderCount < providerCount
          ? 'amber'
          : 'emerald';
  const logTone: DashboardTone = hasCriticalLogs
    ? 'rose'
    : importantLogCount > 0
      ? 'amber'
      : 'emerald';
  const storageTone: DashboardTone = storageMode
    ? storageMode === 'browser'
      ? 'sky'
      : 'emerald'
    : 'amber';

  const priorityItems: DashboardPriorityItem[] = [];
  if (!hasAvailableRoute) {
    priorityItems.push({
      id: 'missing-route',
      tone: 'rose',
      title: '没有可继续生成的主链路',
      description: '当前既没有可用密钥，也没有在线供应商。建议优先去 API 管理补齐接口来源。',
      actionLabel: '前往 API 管理',
      actionView: 'api-management',
    });
  }
  if (stats.rateLimited > 0) {
    priorityItems.push({
      id: 'rate-limited',
      tone: 'amber',
      title: `${stats.rateLimited} 个密钥处于限流冷却`,
      description: '继续高频调用会影响稳定性，建议先检查接口配额，或者补充备用通道。',
      actionLabel: '检查接口状态',
      actionView: 'api-management',
    });
  }
  if (importantLogCount > 0) {
    priorityItems.push({
      id: 'important-logs',
      tone: hasCriticalLogs ? 'rose' : 'amber',
      title: `${importantLogCount} 条重要日志待处理`,
      description: latestLog?.message || '建议先查看系统日志，确认有没有会影响生成的错误或警告。',
      actionLabel: '查看系统日志',
      actionView: 'system-logs',
    });
  }
  if (!storageMode) {
    priorityItems.push({
      id: 'storage-mode',
      tone: 'amber',
      title: '图片存储方式还没明确',
      description: '建议尽快确认存储位置，后续排查图片缺失、迁移或清缓存会更简单。',
      actionLabel: '打开存储设置',
      actionView: 'storage-settings',
    });
  }

  const recentRows = [
    {
      key: 'generation',
      icon: <RefreshCw size={16} />,
      title: '最近一条生成',
      value:
        latestUsage?.model_name || latestUsage?.model_id || latestUsage?.description || '今天暂无生成记录',
      description: latestUsage
        ? `${formatDateTime(latestUsage.created_at)} · ${latestUsage.type === 'consumption' ? '生成扣费' : latestUsage.type}`
        : '完成一次生成后，这里会显示最近一条记录。',
      tone: 'indigo' as DashboardTone,
    },
    {
      key: 'recharge',
      icon: <DollarSign size={16} />,
      title: '充值与余额',
      value: todayRechargeCount > 0 ? `今天新增 ${todayRechargeCount} 条` : '今天没有新增充值',
      description: latestRecharge
        ? `最近充值时间：${formatDateTime(latestRecharge.created_at)}`
        : `当前余额 ${formatMetricNumber(balance, Number.isInteger(balance) ? 0 : 2)}`,
      tone: 'emerald' as DashboardTone,
    },
    {
      key: 'logs',
      icon: <ScrollText size={16} />,
      title: '系统反馈',
      value: importantLogCount > 0 ? `${importantLogCount} 条待看` : '暂无异常日志',
      description: latestLog
        ? `${formatDateTime(latestLog.timestamp)} · ${latestLog.message}`
        : '如果后续出现告警或错误，这里会优先显示。',
      tone: logTone,
    },
  ];

  const healthRows = [
    {
      key: 'keys',
      icon: <Key size={16} />,
      title: '密钥池健康',
      description:
        stats.total > 0
          ? `有效 ${stats.valid} / 总计 ${stats.total}，限流 ${stats.rateLimited}，失效 ${stats.invalid}`
          : '当前还没有可统计的密钥，建议先补齐至少一个可调度入口。',
      value: stats.total > 0 ? `${keyHealthPercent}%` : '未配置',
      tone: keyTone,
      progress: stats.total > 0 ? keyHealthPercent : undefined,
    },
    {
      key: 'providers',
      icon: <LayoutDashboard size={16} />,
      title: '供应商连通',
      description:
        providerCount > 0
          ? `在线 ${activeProviderCount} / ${providerCount}，第三方通道越完整，越适合长期工作。`
          : officialCount > 0
            ? '当前没有启用第三方供应商，主要使用官方接口。'
            : '还没有任何供应商或官方接口入口。',
      value: providerCount > 0 ? `${activeProviderCount}/${providerCount}` : '未接入',
      tone: providerTone,
      progress: providerCount > 0 ? Math.round((activeProviderCount / providerCount) * 100) : undefined,
    },
    {
      key: 'storage',
      icon: <HardDrive size={16} />,
      title: '存储状态',
      description: storageMode
        ? '图片存储位置已经明确，后续清理和迁移会更直接。'
        : '存储方式未明确时，后续排查成本会更高。',
      value: storageModeLabel,
      tone: storageTone,
    },
    {
      key: 'logs',
      icon: <Activity size={16} />,
      title: '日志风险',
      description: importantLogCount > 0 ? '今天有告警或错误，建议尽快检查。' : '今天没有新的警告或错误。',
      value: importantLogCount > 0 ? `${importantLogCount} 条` : '正常',
      tone: logTone,
    },
  ];

  return (
    <SettingsViewShell>
      <SettingsSection
        title="仪表盘"
        description={readinessDescription}
        action={<SettingsBadge tone={readinessTone}>{readinessLabel}</SettingsBadge>}
      >
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsMetricCard
            label="可用链路"
            value={hasAvailableRoute ? `${officialCount + activeProviderCount}` : '0'}
            helper={
              hasAvailableRoute
                ? `官方 ${officialCount} / 在线供应商 ${activeProviderCount}`
                : '还没有可以直接工作的入口。'
            }
            icon={Key}
            tone={hasAvailableRoute ? 'indigo' : 'rose'}
          />
          <SettingsMetricCard
            label="今日消费"
            value={`$${todayCostUsd.toFixed(2)}`}
            helper={`Tokens ${formatMetricNumber(todayTokens)} / 调用 ${formatMetricNumber(todayUsageCount)}`}
            icon={Activity}
            tone="amber"
          />
          <SettingsMetricCard
            label="今日充值"
            value={todayRechargeCount > 0 ? `${todayRechargeCount} 笔` : '暂无'}
            helper={
              latestRecharge
                ? `最近一笔 ${formatDateTime(latestRecharge.created_at)}`
                : '今天还没有新的充值记录。'
            }
            icon={DollarSign}
            tone={todayRechargeCount > 0 ? 'emerald' : 'neutral'}
          />
          <SettingsMetricCard
            label="待处理"
            value={priorityItems.length > 0 ? `${priorityItems.length} 项` : '稳定'}
            helper={
              importantLogCount > 0 ? `重要日志 ${importantLogCount} 条` : '当前没有需要立刻处理的问题。'
            }
            icon={ScrollText}
            tone={priorityItems.length > 0 ? (hasCriticalLogs ? 'rose' : 'amber') : 'emerald'}
          />
        </div>
      </SettingsSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr),minmax(320px,0.8fr)]">
        <SettingsSection title="当前状态" description="只保留最关键的系统状态，避免继续堆信息。">
          <div className="settings-dashboard-grid settings-dashboard-grid--health">
            {healthRows.map((row) => (
              <DashboardCheckCard
                key={row.key}
                icon={row.icon}
                title={row.title}
                description={row.description}
                value={row.value}
                tone={row.tone}
                progress={row.progress}
              />
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="待处理"
          description="这里只放真正影响继续使用的事项。"
          action={
            <SettingsBadge tone={priorityItems.length > 0 ? 'amber' : 'emerald'}>
              {priorityItems.length > 0 ? `${priorityItems.length} 项` : '当前稳定'}
            </SettingsBadge>
          }
        >
          {priorityItems.length === 0 ? (
            <div className="settings-dashboard-quiet" style={SETTINGS_SUCCESS_STYLE}>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                当前没有必须立刻处理的问题
              </div>
              <div className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                可以继续使用；如果后续出现异常，再进入对应设置页处理。
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {priorityItems.map((item) => (
                <div key={item.id} className="settings-dashboard-priority">
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs leading-5" style={{ color: 'var(--text-tertiary)' }}>
                      {item.description}
                    </div>
                  </div>
                    <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>
                      建议前往：{item.actionLabel}
                    </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      </div>

      <SettingsSection
        title="最近变化"
        description="最近生成、充值和日志会集中在这里。"
        action={
          <SettingsBadge tone={todayUsageCount > 0 || todayRechargeCount > 0 ? 'indigo' : 'neutral'}>
            {todayUsageCount > 0 || todayRechargeCount > 0 ? '有新变化' : '暂无新变化'}
          </SettingsBadge>
        }
      >
        <div className="settings-dashboard-grid">
          {recentRows.map((row) => (
            <DashboardInfoCard
              key={row.key}
              icon={row.icon}
              title={row.title}
              value={row.value}
              description={row.description}
              tone={row.tone}
            />
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {latestImportantLogs.length === 0 ? (
            <div className="settings-dashboard-quiet" style={SETTINGS_ELEVATED_STYLE}>
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                今日暂无需要优先关注的告警或错误。
              </div>
            </div>
          ) : (
            latestImportantLogs.map((log) => {
              const tone: DashboardTone =
                log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL ? 'rose' : 'amber';
              const detailPreview = log.details.split('\n').find((line) => line.trim()) || log.details;
              return (
                <div key={log.id} className="settings-dashboard-log">
                  <div className="flex flex-wrap items-center gap-2">
                    <SettingsBadge tone={tone}>{log.level}</SettingsBadge>
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDateTime(log.timestamp)}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      来源：{log.source}
                    </span>
                  </div>
                  <div
                    className="mt-2 text-sm font-medium leading-6"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {log.message}
                  </div>
                  <div className="mt-1 text-xs leading-5" style={{ color: 'var(--text-tertiary)' }}>
                    {detailPreview}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default DashboardView;
