import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  RefreshCw,
  ScrollText,
  Shield,
  Trash2,
} from 'lucide-react';
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
  SETTINGS_DANGER_STYLE,
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_PANEL_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsDangerZone,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';

type LogTone = 'rose' | 'amber' | 'neutral';

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
    () =>
      logs.filter(
        (item) => item.level === LogLevel.ERROR || item.level === LogLevel.CRITICAL
      ),
    [logs]
  );
  
  const latestLog = useMemo(
    () =>
      logs.reduce<SystemLogEntry | null>((latest, entry) => {
        if (!latest) return entry;
        return new Date(entry.timestamp).getTime() > new Date(latest.timestamp).getTime()
          ? entry
          : latest;
      }, null),
    [logs]
  );
  
  const sourceCount = useMemo(
    () => new Set(logs.map((item) => item.source)).size,
    [logs]
  );

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

  const formatLogTime = (timestamp?: string | number) =>
    timestamp ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '暂无记录';

  const getLogTone = (level: LogLevel): LogTone => {
    if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'rose';
    if (level === LogLevel.WARNING) return 'amber';
    return 'neutral';
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        tone={importantLogs.length > 0 ? 'amber' : 'emerald'}
        icon={ScrollText}
        eyebrow="LOG CENTER"
        title="系统日志"
        description="集中查看今天的重要告警、错误和关键运行信息。"
        badge={
          <SettingsBadge tone={importantLogs.length > 0 ? 'amber' : 'emerald'}>
            {importantLogs.length > 0 ? `${importantLogs.length} 条重点事件` : '运行平稳'}
          </SettingsBadge>
        }
        actions={
          <>
            <SettingsActionButton icon={ScrollText} onClick={() => void handleExport()}>
              导出日志
            </SettingsActionButton>
          </>
        }
        metrics={
          <>
            <SettingsMetricCard
              label="今日总日志数"
              value={`${logs.length} 条`}
              helper="包含普通运行记录与重点事件。"
              icon={ScrollText}
              tone="sky"
            />
            <SettingsMetricCard
              label="重点事件"
              value={`${importantLogs.length} 条`}
              helper="显示 Warning、Error、Critical。"
              icon={Activity}
              tone={importantLogs.length > 0 ? 'amber' : 'emerald'}
            />
            <SettingsMetricCard
              label="错误与严重错误"
              value={`${errorLogs.length} 条`}
              helper={errorLogs.length > 0 ? '建议优先排查最新一条。' : '当前未发现错误级事件。'}
              icon={Shield}
              tone={errorLogs.length > 0 ? 'rose' : 'neutral'}
            />
            <SettingsMetricCard
              label="最近更新时间"
              value={formatLogTime(latestLog?.timestamp)}
              helper={sourceCount > 0 ? `来自 ${sourceCount} 个日志来源。` : '今日尚未产生系统日志。'}
              icon={RefreshCw}
              tone="indigo"
            />
          </>
        }
      />

      <SettingsSection
        eyebrow="FOCUS EVENTS"
        title="重点事件列表"
        description="只保留需要人工关注的警告和错误。"
        action={<SettingsBadge tone="neutral">仅展示 Warning 及以上</SettingsBadge>}
      >
        {importantLogs.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-5 py-10 text-center"
            style={{ borderColor: 'var(--settings-border-subtle)', color: 'var(--text-tertiary)' }}
          >
            今日暂无重要日志，当前系统状态稳定。
          </div>
        ) : (
          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {importantLogs
              .slice()
              .reverse()
              .map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border p-4"
                  style={
                    log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL
                      ? SETTINGS_DANGER_STYLE
                      : SETTINGS_ELEVATED_STYLE
                  }
                >
                  <div
                    className="flex flex-wrap items-center gap-2 text-[11px]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span>{formatLogTime(log.timestamp)}</span>
                    <SettingsBadge tone={getLogTone(log.level)} className="px-2 py-0.5">
                      {log.level}
                    </SettingsBadge>
                    <span>来源：{log.source}</span>
                  </div>
                  <div
                    className="mt-3 text-sm font-medium leading-6"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {log.message}
                  </div>
                  {log.details ? (
                    <pre
                      className="mt-3 whitespace-pre-wrap break-all rounded-xl border p-3 text-xs leading-5"
                      style={SETTINGS_PANEL_STYLE}
                    >
                      {log.details}
                    </pre>
                  ) : null}
                </div>
              ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        eyebrow="DANGER ZONE"
        title="危险操作"
        description="清空动作只影响今天的系统日志，执行后无法恢复。"
      >
        <SettingsDangerZone
          title="清空今日日志"
          description="建议先导出日志再清空，避免排查问题时丢失上下文。"
          action={
            <SettingsActionButton icon={Trash2} tone="danger" onClick={handleClear}>
              清空日志
            </SettingsActionButton>
          }
        />
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default SystemLogsView;
