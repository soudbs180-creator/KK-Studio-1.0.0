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
import { SettingsActionButton, SettingsBadge, SettingsViewShell } from '../SettingsScaffold';
import { EmptyState, SegmentedControlMulti, SettingSelect, StatusBadge } from '../ui/index';

type LevelFilter = 'all' | 'error' | 'warning' | 'info';

const LEVEL_OPTIONS = ['All Levels', 'Errors Only', 'Warnings Only', 'Info Only'] as const;

const formatLogTime = (timestamp?: number | string) =>
  timestamp ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : 'No record';

const getLevelLabel = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL) return 'Critical';
  if (level === LogLevel.ERROR) return 'Error';
  if (level === LogLevel.WARNING) return 'Warning';
  return 'Info';
};

const getLevelStatus = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'error' as const;
  if (level === LogLevel.WARNING) return 'warning' as const;
  return 'online' as const;
};

const getLevelClassName = (level: LogLevel) => {
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'settings-log-entry settings-log-entry--error';
  if (level === LogLevel.WARNING) return 'settings-log-entry settings-log-entry--warning';
  return 'settings-log-entry';
};

const parseLevelFilter = (value: string): LevelFilter => {
  if (value === 'Errors Only') return 'error';
  if (value === 'Warnings Only') return 'warning';
  if (value === 'Info Only') return 'info';
  return 'all';
};

const levelFilterToLabel = (value: LevelFilter) => {
  if (value === 'error') return 'Errors Only';
  if (value === 'warning') return 'Warnings Only';
  if (value === 'info') return 'Info Only';
  return 'All Levels';
};

const formatLogsForDownload = (logs: SystemLogEntry[]) => {
  if (logs.length === 0) {
    return `KK Studio Logs Export\nDate: ${new Date().toLocaleDateString('zh-CN')}\n\nNo log rows matched the current filters.`;
  }

  return [
    'KK Studio Logs Export',
    `Date: ${new Date().toLocaleDateString('zh-CN')}`,
    `Rows: ${logs.length}`,
    '',
    ...logs.map((log, index) =>
      [
        `## Log ${index + 1}`,
        `Time: ${formatLogTime(log.timestamp)}`,
        `Level: ${getLevelLabel(log.level)}`,
        `Source: ${log.source}`,
        `Message: ${log.message}`,
        `Details: ${log.details || 'n/a'}`,
        log.stack ? `Stack: ${log.stack}` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n')
    ),
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

const LogMetricCard: React.FC<{ label: string; value: string; helper: string; badge?: React.ReactNode }> = ({
  label,
  value,
  helper,
  badge,
}) => (
  <section className="settings-reference-card settings-reference-card--elevated">
    <div className="settings-reference-card__header">
      <div>
        <div className="settings-reference-card__eyebrow">{label}</div>
        <div className="settings-reference-card__title">{value}</div>
        <div className="settings-reference-card__meta">{helper}</div>
      </div>
      {badge}
    </div>
  </section>
);

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

  const warningLogs = useMemo(
    () => logs.filter((item) => item.level === LogLevel.WARNING),
    [logs]
  );

  const latestLog = filteredLogs[0] || null;
  const latestCritical = errorLogs[0] || null;
  const hasFilters = levelFilter !== 'all' || sourceFilter !== 'ALL';

  const handleDownload = () => {
    downloadText(
      `kk-studio-logs-${new Date().toISOString().slice(0, 10)}.txt`,
      formatLogsForDownload(filteredLogs)
    );
    notify.success('下载已开始', '当前筛选结果会导出为文本文档。');
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
      <div className="settings-reference-stack">
        <div className="settings-reference-page-header">
          <div className="settings-reference-page-header__lead">
            <div className="settings-reference-page-header__eyebrow">Advanced Settings</div>
            <h2>System Logs</h2>
            <p>
              The logs page now mirrors the reference live-stream layout: a compact filter bar, a darker
              scrolling feed, and a right-side alert summary that keeps the settings area visually
              consistent with the rest of the control console.
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone={isStreamPaused ? 'neutral' : errorLogs.length > 0 ? 'amber' : 'emerald'}>
              {isStreamPaused ? 'Stream Paused' : 'Live Stream'}
            </SettingsBadge>
            <SettingsActionButton icon={isStreamPaused ? Play : Pause} onClick={handleToggleStream}>
              {isStreamPaused ? 'Resume Stream' : 'Pause Stream'}
            </SettingsActionButton>
            <SettingsActionButton icon={Download} tone="primary" onClick={handleDownload}>
              Export Logs
            </SettingsActionButton>
          </div>
        </div>

        <div className="settings-reference-grid-4">
          <LogMetricCard
            label="Today"
            value={`${logs.length} rows`}
            helper="All log entries recorded during the current local day."
            badge={<SettingsBadge tone="indigo">Total</SettingsBadge>}
          />
          <LogMetricCard
            label="Visible"
            value={`${filteredLogs.length} rows`}
            helper={hasFilters ? 'Current filters are limiting the live stream.' : 'The stream is showing every available log row.'}
            badge={<SettingsBadge tone={hasFilters ? 'amber' : 'neutral'}>{hasFilters ? 'Filtered' : 'All'}</SettingsBadge>}
          />
          <LogMetricCard
            label="Errors"
            value={`${errorLogs.length}`}
            helper={errorLogs.length > 0 ? 'Critical or error entries should be triaged first.' : 'No critical or error entries are present right now.'}
            badge={<StatusBadge status={errorLogs.length > 0 ? 'error' : 'online'} label={errorLogs.length > 0 ? 'Attention' : 'Healthy'} />}
          />
          <LogMetricCard
            label="Sources"
            value={`${sourceOptions.length}`}
            helper={latestLog ? `Latest update ${formatLogTime(latestLog.timestamp)}` : 'No live updates have arrived yet.'}
            badge={<SettingsBadge tone="neutral">Feeds</SettingsBadge>}
          />
        </div>

        <section className="settings-reference-card settings-reference-card--soft">
          <div className="settings-reference-toolbar">
            <div className="settings-reference-toolbar__filters">
              <div className="min-w-[280px] max-w-full">
                <SegmentedControlMulti
                  options={[...LEVEL_OPTIONS]}
                  value={levelFilterToLabel(levelFilter)}
                  onChange={(value) => setLevelFilter(parseLevelFilter(value))}
                />
              </div>
              <div className="min-w-[260px] max-w-full">
                <SettingSelect
                  label="Source"
                  value={sourceFilter}
                  options={[
                    { value: 'ALL', label: 'All Sources' },
                    ...sourceOptions.map((source) => ({ value: source, label: source })),
                  ]}
                  onChange={setSourceFilter}
                />
              </div>
            </div>
            <div className="settings-reference-toolbar__meta">
              {hasFilters ? (
                <SettingsActionButton onClick={handleClearFilters}>Clear Filters</SettingsActionButton>
              ) : (
                <SettingsBadge tone="neutral">No filters</SettingsBadge>
              )}
              <StatusBadge status={isStreamPaused ? 'paused' : 'online'} label={isStreamPaused ? 'Paused' : 'Running'} />
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Live Feed</div>
                <div className="settings-reference-card__title">Streaming Log Rows</div>
                <div className="settings-reference-card__meta">
                  Each row keeps the timestamp, source, level, and raw detail block visible without looking
                  like a generic form list.
                </div>
              </div>
              <ScrollText size={18} className="text-[var(--text-primary)]" />
            </div>

            {filteredLogs.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title={logs.length === 0 ? 'No logs recorded yet' : 'No rows match the current filters'}
                  description={
                    logs.length === 0
                      ? 'The system has not written any log events today.'
                      : 'Try another filter combination or clear the current filters.'
                  }
                />
              </div>
            ) : (
              <div className="mt-5 settings-log-stream">
                {filteredLogs.map((log) => (
                  <div key={log.id} className={getLevelClassName(log.level)}>
                    <div className="settings-log-entry__meta">
                      <StatusBadge status={getLevelStatus(log.level)} label={getLevelLabel(log.level)} />
                      <SettingsBadge tone="neutral">{log.source}</SettingsBadge>
                      <span className="text-[12px] text-[var(--text-tertiary)]">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <div className="settings-log-entry__title">{log.message}</div>
                    {log.details ? <div className="settings-log-entry__details">{log.details}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="settings-reference-stack">
            <section className="settings-reference-card">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">Alert Summary</div>
                  <div className="settings-reference-card__title">Current Signal</div>
                  <div className="settings-reference-card__meta">
                    A compact summary of alert pressure and the highest-priority message currently in the log
                    stream.
                  </div>
                </div>
                <ShieldAlert size={18} className="text-[var(--text-primary)]" />
              </div>

              <div className="mt-5 settings-reference-list">
                <div className="settings-reference-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="settings-reference-list-item__title">Critical & Error</div>
                    <div className="settings-reference-list-item__meta">
                      Highest-priority rows that should be investigated before routine warnings.
                    </div>
                  </div>
                  <div className="settings-reference-list-item__value">{errorLogs.length}</div>
                </div>
                <div className="settings-reference-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="settings-reference-list-item__title">Warnings</div>
                    <div className="settings-reference-list-item__meta">
                      Advisory rows that might turn into incidents if they keep repeating.
                    </div>
                  </div>
                  <div className="settings-reference-list-item__value">{warningLogs.length}</div>
                </div>
                <div className="settings-reference-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="settings-reference-list-item__title">Priority Source</div>
                    <div className="settings-reference-list-item__meta">
                      The source attached to the latest critical or error event.
                    </div>
                  </div>
                  <div className="settings-reference-list-item__value">{latestCritical?.source || 'None'}</div>
                </div>
              </div>
            </section>

            <section className="settings-reference-card settings-reference-card--soft">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">Latest Alert</div>
                  <div className="settings-reference-card__title">
                    {latestCritical ? getLevelLabel(latestCritical.level) : 'No critical event'}
                  </div>
                  <div className="settings-reference-card__meta">
                    {latestCritical
                      ? `${formatLogTime(latestCritical.timestamp)} · ${latestCritical.source}`
                      : 'The live stream has no critical or error rows right now.'}
                  </div>
                </div>
                <StatusBadge
                  status={latestCritical ? getLevelStatus(latestCritical.level) : 'online'}
                  label={latestCritical ? 'Investigate' : 'Stable'}
                />
              </div>
              <div className="mt-4 text-[14px] leading-6 text-[var(--text-secondary)]">
                {latestCritical?.message || 'Warnings and informational rows can be reviewed from the stream without urgent intervention.'}
              </div>
            </section>

            {logs.length > 0 ? (
              <section className="settings-reference-card settings-reference-danger">
                <div className="settings-reference-card__header">
                  <div>
                    <div className="settings-reference-card__eyebrow">Danger Zone</div>
                    <div className="settings-reference-card__title">Clear Today&apos;s Log Cache</div>
                    <div className="settings-reference-card__meta">
                      This removes all cached log rows for the current day, not just the currently visible
                      filtered result.
                    </div>
                  </div>
                  <Trash2 size={18} className="text-[var(--state-danger-text)]" />
                </div>
                <div className="mt-4">
                  <SettingsActionButton icon={Trash2} tone="danger" onClick={handleClearLogs}>
                    Clear Log Cache
                  </SettingsActionButton>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </SettingsViewShell>
  );
};

export default SystemLogsView;
