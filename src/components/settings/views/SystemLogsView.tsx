import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Download, Pause, Play, ScrollText, ShieldAlert, Trash2 } from 'lucide-react';
import {
  clearLogs,
  getTodayLogs,
  LogLevel,
  subscribeToLogs,
  type SystemLogEntry,
} from '../../../services/system/systemLogService';
import { notify } from '../../../services/system/notificationService';
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
import { EmptyState, SegmentedControlMulti, SettingSelect, StatusBadge } from '../ui/index';

type LevelFilter = 'all' | 'error' | 'warning' | 'info';

const LEVEL_OPTIONS = ['全部级别', '仅错误', '仅警告', '仅信息'] as const;

const formatLogTime = (timestamp?: number | string) =>
  timestamp ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '暂无记录';

const getLevelLabel = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL) return '严重';
  if (level === LogLevel.ERROR) return '错误';
  if (level === LogLevel.WARNING) return '警告';
  return '信息';
};

const getLevelStatus = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'error' as const;
  if (level === LogLevel.WARNING) return 'warning' as const;
  return 'online' as const;
};

const getLevelTone = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'rose' as const;
  if (level === LogLevel.WARNING) return 'amber' as const;
  return 'neutral' as const;
};

const parseLevelFilter = (value: string): LevelFilter => {
  if (value === '仅错误') return 'error';
  if (value === '仅警告') return 'warning';
  if (value === '仅信息') return 'info';
  return 'all';
};

const levelFilterToLabel = (value: LevelFilter) => {
  if (value === 'error') return '仅错误';
  if (value === 'warning') return '仅警告';
  if (value === 'info') return '仅信息';
  return '全部级别';
};

const formatLogsForDownload = (logs: SystemLogEntry[]) => {
  if (logs.length === 0) {
    return `KK Studio 日志导出\n日期：${new Date().toLocaleDateString('zh-CN')}\n\n当前筛选结果为空。`;
  }

  return [
    `KK Studio 日志导出`,
    `日期：${new Date().toLocaleDateString('zh-CN')}`,
    `条数：${logs.length}`,
    '',
    ...logs.map((log, index) => [
      `## 日志 ${index + 1}`,
      `时间：${formatLogTime(log.timestamp)}`,
      `级别：${getLevelLabel(log.level)}`,
      `来源：${log.source}`,
      `信息：${log.message}`,
      `详情：${log.details || '无'}`,
      log.stack ? `堆栈：${log.stack}` : '',
      '',
    ].filter(Boolean).join('\n')),
  ].join('\n');
};

const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [isStreamPaused, setIsStreamPaused] = useState(false);

  useEffect(() => {
    setLogs(getTodayLogs());
    const unsubscribe = subscribeToLogs((next) => {
      if (!isStreamPaused) {
        setLogs(next);
      }
    });
    return unsubscribe;
  }, [isStreamPaused]);

  useEffect(() => {
    if (!isStreamPaused) {
      setLogs(getTodayLogs());
    }
  }, [isStreamPaused]);

  const sourceOptions = useMemo(
    () => Array.from(new Set(logs.map((item) => item.source))).sort(),
    [logs]
  );

  useEffect(() => {
    if (sourceFilter !== 'ALL' && !sourceOptions.includes(sourceFilter)) {
      setSourceFilter('ALL');
    }
  }, [sourceFilter, sourceOptions]);

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        if (levelFilter === 'error') {
          return log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL;
        }
        if (levelFilter === 'warning') {
          return log.level === LogLevel.WARNING;
        }
        if (levelFilter === 'info') {
          return log.level === LogLevel.INFO;
        }
        return true;
      })
      .filter((log) => (sourceFilter === 'ALL' ? true : log.source === sourceFilter))
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [levelFilter, logs, sourceFilter]);

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

  const latestLog = filteredLogs[0] || null;
  const hasFilters = levelFilter !== 'all' || sourceFilter !== 'ALL';

  const handleDownload = () => {
    downloadText(
      `kk-studio-logs-${new Date().toISOString().slice(0, 10)}.txt`,
      formatLogsForDownload(filteredLogs)
    );
    notify.success('下载已开始', '当前筛选结果会导出为文本文件。');
  };

  const handleClearFilters = () => {
    setLevelFilter('all');
    setSourceFilter('ALL');
  };

  const handleToggleStream = () => {
    setIsStreamPaused((current) => !current);
  };

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
    notify.success('已清空', '今日日志已经清空。');
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        eyebrow="高级设置"
        title="系统日志"
        description="集中查看今天的警告、错误和信息日志。你可以按级别和来源筛选，也可以暂停实时日志流，避免列表在排查时不断跳动。"
        icon={ScrollText}
        tone={errorLogs.length > 0 ? 'rose' : importantLogs.length > 0 ? 'amber' : 'emerald'}
        badge={<SettingsBadge tone={isStreamPaused ? 'neutral' : 'emerald'}>{isStreamPaused ? '日志流已暂停' : '日志流运行中'}</SettingsBadge>}
        actions={
          <>
            <SettingsActionButton icon={isStreamPaused ? Play : Pause} onClick={handleToggleStream}>
              {isStreamPaused ? '恢复日志流' : '暂停日志流'}
            </SettingsActionButton>
            <SettingsActionButton icon={Download} tone="primary" onClick={handleDownload}>
              下载日志
            </SettingsActionButton>
          </>
        }
        metrics={
          <>
            <SettingsMetricCard label="今日日志" value={`${logs.length}`} helper="包含信息、警告和错误日志" icon={ScrollText} tone="indigo" />
            <SettingsMetricCard label="当前筛选" value={`${filteredLogs.length}`} helper={hasFilters ? '已应用筛选条件' : '当前展示全部日志'} icon={Activity} tone={hasFilters ? 'amber' : 'neutral'} />
            <SettingsMetricCard label="错误与严重" value={`${errorLogs.length}`} helper={errorLogs.length > 0 ? '建议优先排查' : '当前没有错误日志'} icon={ShieldAlert} tone={errorLogs.length > 0 ? 'rose' : 'emerald'} />
            <SettingsMetricCard label="日志来源" value={`${sourceOptions.length}`} helper={latestLog ? `最近更新：${formatLogTime(latestLog.timestamp)}` : '今天还没有日志'} icon={Activity} tone="neutral" />
          </>
        }
      />

      <SettingsSection
        title="筛选与实时流"
        eyebrow="筛选器"
        description="“清空筛选”只会重置筛选条件，不会删除任何日志数据。"
        action={hasFilters ? <SettingsActionButton onClick={handleClearFilters}>清空筛选</SettingsActionButton> : <SettingsBadge tone="neutral">无筛选</SettingsBadge>}
      >
        <div className="space-y-4">
          <SegmentedControlMulti
            options={[...LEVEL_OPTIONS]}
            value={levelFilterToLabel(levelFilter)}
            onChange={(value) => setLevelFilter(parseLevelFilter(value))}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <SettingSelect
              label="来源筛选"
              value={sourceFilter}
              options={[
                { value: 'ALL', label: '全部来源' },
                ...sourceOptions.map((source) => ({ value: source, label: source })),
              ]}
              onChange={setSourceFilter}
            />

            <div className="rounded-[24px] border p-4" style={SETTINGS_OVERLAY_STYLE}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">实时日志流</div>
                  <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                    {isStreamPaused
                      ? '已经暂停自动更新，当前列表会保持静止，适合逐条排查。'
                      : '当前保持实时更新，新的日志会自动进入列表顶部。'}
                  </div>
                </div>
                <StatusBadge status={isStreamPaused ? 'paused' : 'online'} label={isStreamPaused ? '已暂停' : '运行中'} />
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="日志列表"
        eyebrow="实时记录"
        description="日志卡片会保留来源、时间和详细内容，便于你快速定位问题来源。"
      >
        {filteredLogs.length === 0 ? (
          <EmptyState
            title={logs.length === 0 ? '今天还没有日志' : '当前筛选结果为空'}
            description={logs.length === 0 ? '系统还没有写入新的运行日志。' : '可以尝试切换筛选条件或清空筛选。'}
          />
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-[24px] border p-4"
                style={
                  getLevelTone(log.level) === 'rose'
                    ? { borderColor: 'var(--state-danger-border)', backgroundColor: 'var(--state-danger-bg)' }
                    : getLevelTone(log.level) === 'amber'
                      ? { borderColor: 'var(--state-warning-border)', backgroundColor: 'var(--state-warning-bg)' }
                      : SETTINGS_ELEVATED_STYLE
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={getLevelStatus(log.level)} label={getLevelLabel(log.level)} />
                    <span className="text-[12px] text-[var(--text-tertiary)]">{formatLogTime(log.timestamp)}</span>
                    <SettingsBadge tone="neutral">{log.source}</SettingsBadge>
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)]">
                    {getLevelTone(log.level) === 'rose' ? '建议优先处理' : getLevelTone(log.level) === 'amber' ? '建议尽快查看' : '普通信息'}
                  </div>
                </div>
                <div className="mt-3 text-[16px] font-semibold leading-6 text-[var(--text-primary)]">{log.message}</div>
                {log.details ? (
                  <div className="mt-3 rounded-[18px] border p-3 text-[12px] leading-6 text-[var(--text-secondary)]" style={SETTINGS_OVERLAY_STYLE}>
                    <pre className="whitespace-pre-wrap break-all font-inherit">{log.details}</pre>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      {logs.length > 0 ? (
        <div className="rounded-[26px] border p-5" style={{ borderColor: 'var(--state-danger-border)', backgroundColor: 'var(--state-danger-bg)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[16px] font-semibold text-[var(--state-danger-text)]">清空今日日志</div>
              <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                这是危险操作，会删除今天缓存的全部日志，不只是当前筛选结果。
              </div>
            </div>
            <SettingsActionButton icon={Trash2} tone="danger" onClick={handleClearLogs}>
              清空今日日志
            </SettingsActionButton>
          </div>
        </div>
      ) : null}
    </SettingsViewShell>
  );
};

export default SystemLogsView;
