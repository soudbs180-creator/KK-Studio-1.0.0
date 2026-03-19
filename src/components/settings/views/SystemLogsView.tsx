import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ScrollText, Shield, Trash2 } from 'lucide-react';
import {
  clearLogs,
  exportLogsForAI,
  getTodayLogs,
  LogLevel,
  subscribeToLogs,
  type SystemLogEntry,
} from '../../../services/system/systemLogService';
import { notify } from '../../../services/system/notificationService';
import { writeTextToClipboard } from '../../../utils/clipboard';
import {
  DangerButton,
  EmptyState,
  MetricCard,
  PrimaryButton,
  SecondaryButton,
  SettingCard,
  StatusBadge,
} from '../ui/index';

type LogTone = 'rose' | 'amber' | 'neutral';

const formatLogTime = (timestamp?: string | number) =>
  timestamp ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '暂无记录';

const getLogTone = (level: LogLevel): LogTone => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'rose';
  if (level === LogLevel.WARNING) return 'amber';
  return 'neutral';
};

const getLogStatus = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'error' as const;
  if (level === LogLevel.WARNING) return 'warning' as const;
  return 'online' as const;
};

export const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);

  useEffect(() => {
    setLogs(getTodayLogs());
    const unsubscribe = subscribeToLogs((next) => setLogs(next));
    return unsubscribe;
  }, []);

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

  const errorLogs = useMemo(
    () => logs.filter((item) => item.level === LogLevel.ERROR || item.level === LogLevel.CRITICAL),
    [logs]
  );

  const latestLog = useMemo(
    () =>
      logs.reduce<SystemLogEntry | null>((latest, entry) => {
        if (!latest) return entry;
        return new Date(entry.timestamp).getTime() > new Date(latest.timestamp).getTime() ? entry : latest;
      }, null),
    [logs]
  );

  const sourceCount = useMemo(() => new Set(logs.map((item) => item.source)).size, [logs]);

  const handleExport = async () => {
    try {
      const text = exportLogsForAI();
      await writeTextToClipboard(text);
      notify.success('导出成功', '系统日志已复制到剪贴板。');
    } catch (error) {
      console.error('[SystemLogsView] 导出失败:', error);
      notify.error('导出失败', '当前环境无法写入剪贴板，请稍后重试。');
    }
  };

  const handleClear = () => {
    clearLogs();
    notify.success('已清空', '今日系统日志已清空。');
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard value={`${logs.length} 条`} label="今日总日志" helper="包含普通运行记录与重点事件" tone="indigo" />
        <MetricCard value={`${importantLogs.length} 条`} label="重点事件" helper="仅统计 Warning 及以上" tone={importantLogs.length > 0 ? 'amber' : 'emerald'} />
        <MetricCard value={`${errorLogs.length} 条`} label="错误日志" helper={errorLogs.length > 0 ? '建议优先排查' : '当前未发现错误'} tone={errorLogs.length > 0 ? 'rose' : 'neutral'} />
        <MetricCard value={`${sourceCount} 个`} label="日志来源" helper={latestLog ? `最近更新 ${formatLogTime(latestLog.timestamp)}` : '今日暂无日志'} tone="neutral" />
      </div>

      <SettingCard
        title="日志操作"
        action={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => void handleExport()}>
              <ScrollText size={14} className="mr-1 inline-block" />导出日志
            </SecondaryButton>
            <DangerButton onClick={handleClear}>
              <Trash2 size={14} className="mr-1 inline-block" />清空日志
            </DangerButton>
          </div>
        }
      >
        <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
          <div className="text-[15px] font-medium text-[var(--text-primary)]">当前概况</div>
          <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
            {importantLogs.length > 0
              ? `今天共有 ${importantLogs.length} 条需要人工关注的日志，其中 ${errorLogs.length} 条为错误或严重错误。`
              : '今天没有需要人工关注的重点事件。'}
          </div>
        </div>
      </SettingCard>

      <SettingCard title="重点事件列表">
        {importantLogs.length === 0 ? (
          <EmptyState title="今日暂无重要日志" description="当前系统状态稳定，没有 Warning 以上的事件。" />
        ) : (
          <div className="space-y-3">
            {importantLogs
              .slice()
              .reverse()
              .map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-[var(--border-light)] p-3"
                  style={{
                    backgroundColor:
                      log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL
                        ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                        : 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={getLogStatus(log.level)} label={log.level} />
                      <span className="text-[12px] text-[var(--text-tertiary)]">{formatLogTime(log.timestamp)}</span>
                      <span className="text-[12px] text-[var(--text-tertiary)]">来源：{log.source}</span>
                    </div>
                    <div className="text-[12px] font-medium text-[var(--text-secondary)]">
                      {getLogTone(log.level) === 'rose' ? '需要优先处理' : '建议尽快查看'}
                    </div>
                  </div>
                  <div className="mt-3 text-[15px] font-medium leading-6 text-[var(--text-primary)]">{log.message}</div>
                  {log.details ? (
                    <div className="mt-3 rounded-xl border border-[var(--border-light)] p-3 text-[12px] leading-6 text-[var(--text-secondary)]">
                      <pre className="whitespace-pre-wrap break-all font-inherit">{log.details}</pre>
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        )}
      </SettingCard>

      {latestLog ? (
        <SettingCard title="最近一条日志">
          <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
            <div className="flex items-center gap-2">
              <StatusBadge status={getLogStatus(latestLog.level)} label={latestLog.level} />
              <span className="text-[12px] text-[var(--text-tertiary)]">{formatLogTime(latestLog.timestamp)}</span>
            </div>
            <div className="mt-3 text-[15px] font-medium text-[var(--text-primary)]">{latestLog.message}</div>
            <div className="mt-1 text-[13px] text-[var(--text-secondary)]">来源：{latestLog.source}</div>
          </div>
        </SettingCard>
      ) : null}
    </div>
  );
};

export default SystemLogsView;
