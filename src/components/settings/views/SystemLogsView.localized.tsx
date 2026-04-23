import React, { useEffect, useMemo, useState } from 'react';
import { Download, Pause, Play, ScrollText, ShieldAlert, Trash2 } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
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
  const { locale, pick } = useLocale();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [isStreamPaused, setIsStreamPaused] = useState(false);

  const levelOptions = useMemo(
    () => [
      pick('全部级别', 'All Levels'),
      pick('仅错误', 'Errors Only'),
      pick('仅警告', 'Warnings Only'),
      pick('仅信息', 'Info Only'),
    ],
    [pick]
  );

  const formatLogTime = (timestamp?: number | string) =>
    timestamp ? new Date(timestamp).toLocaleString(locale, { hour12: false }) : pick('暂无记录', 'No record');

  const getLevelLabel = (level: LogLevel) => {
    if (level === LogLevel.CRITICAL) return pick('严重', 'Critical');
    if (level === LogLevel.ERROR) return pick('错误', 'Error');
    if (level === LogLevel.WARNING) return pick('警告', 'Warning');
    return pick('信息', 'Info');
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
    if (value === levelOptions[1]) return 'error';
    if (value === levelOptions[2]) return 'warning';
    if (value === levelOptions[3]) return 'info';
    return 'all';
  };

  const levelFilterToLabel = (value: LevelFilter) => {
    if (value === 'error') return levelOptions[1];
    if (value === 'warning') return levelOptions[2];
    if (value === 'info') return levelOptions[3];
    return levelOptions[0];
  };

  const formatLogsForDownload = (items: SystemLogEntry[]) => {
    if (items.length === 0) {
      return [
        pick('KK Studio 日志导出', 'KK Studio Logs Export'),
        `${pick('日期', 'Date')}: ${new Date().toLocaleDateString(locale)}`,
        '',
        pick('当前筛选条件下没有匹配的日志。', 'No log rows matched the current filters.'),
      ].join('\n');
    }

    return [
      pick('KK Studio 日志导出', 'KK Studio Logs Export'),
      `${pick('日期', 'Date')}: ${new Date().toLocaleDateString(locale)}`,
      `${pick('条目数', 'Rows')}: ${items.length}`,
      '',
      ...items.map((log, index) =>
        [
          `## ${pick('日志', 'Log')} ${index + 1}`,
          `${pick('时间', 'Time')}: ${formatLogTime(log.timestamp)}`,
          `${pick('级别', 'Level')}: ${getLevelLabel(log.level)}`,
          `${pick('来源', 'Source')}: ${log.source}`,
          `${pick('消息', 'Message')}: ${log.message}`,
          `${pick('详情', 'Details')}: ${log.details || pick('无', 'n/a')}`,
          log.stack ? `${pick('堆栈', 'Stack')}: ${log.stack}` : '',
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
    notify.success(
      pick('导出已开始', 'Export started'),
      pick('当前筛选结果会被导出为文本文件。', 'The current filtered results will be exported as a text file.')
    );
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
    notify.success(
      pick('已清空', 'Cleared'),
      pick('今日日志缓存已经清空。', 'Today’s cached logs were cleared.')
    );
  };

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <div className="settings-reference-page-header">
          <div className="settings-reference-page-header__lead">
            <div className="settings-reference-page-header__eyebrow">{pick('高级设置', 'Advanced Settings')}</div>
            <h2>{pick('系统日志', 'Logs')}</h2>
            <p>
              {pick(
                '这里集中查看实时日志流、过滤条件和高优先级告警，方便快速排查运行风险。',
                'Inspect the live stream, filters, and alert summary from a single runtime console.'
              )}
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone={isStreamPaused ? 'neutral' : errorLogs.length > 0 ? 'amber' : 'emerald'}>
              {isStreamPaused ? pick('流已暂停', 'Stream Paused') : pick('实时流', 'Live Stream')}
            </SettingsBadge>
            <SettingsActionButton icon={isStreamPaused ? Play : Pause} onClick={handleToggleStream}>
              {isStreamPaused ? pick('恢复流', 'Resume Stream') : pick('暂停流', 'Pause Stream')}
            </SettingsActionButton>
            <SettingsActionButton icon={Download} tone="primary" onClick={handleDownload}>
              {pick('导出日志', 'Export Logs')}
            </SettingsActionButton>
          </div>
        </div>

        <div className="settings-reference-grid-4">
          <LogMetricCard
            label={pick('今日', 'Today')}
            value={pick(`${logs.length} 条`, `${logs.length} rows`)}
            helper={pick('当前本地日期内写入的全部日志。', 'All log entries recorded during the current local day.')}
            badge={<SettingsBadge tone="indigo">{pick('总量', 'Total')}</SettingsBadge>}
          />
          <LogMetricCard
            label={pick('可见', 'Visible')}
            value={pick(`${filteredLogs.length} 条`, `${filteredLogs.length} rows`)}
            helper={hasFilters ? pick('当前筛选条件正在限制结果范围。', 'Current filters are limiting the live stream.') : pick('当前展示了全部可用日志。', 'The stream is showing every available log row.')}
            badge={<SettingsBadge tone={hasFilters ? 'amber' : 'neutral'}>{hasFilters ? pick('已筛选', 'Filtered') : pick('全部', 'All')}</SettingsBadge>}
          />
          <LogMetricCard
            label={pick('错误', 'Errors')}
            value={`${errorLogs.length}`}
            helper={errorLogs.length > 0 ? pick('建议优先排查严重和错误级别日志。', 'Critical or error entries should be triaged first.') : pick('当前没有严重或错误日志。', 'No critical or error entries are present right now.')}
            badge={<StatusBadge status={errorLogs.length > 0 ? 'error' : 'online'} label={errorLogs.length > 0 ? pick('需处理', 'Attention') : pick('健康', 'Healthy')} />}
          />
          <LogMetricCard
            label={pick('来源', 'Sources')}
            value={`${sourceOptions.length}`}
            helper={latestLog ? pick(`最近更新于 ${formatLogTime(latestLog.timestamp)}`, `Latest update ${formatLogTime(latestLog.timestamp)}`) : pick('还没有收到新的实时更新。', 'No live updates have arrived yet.')}
            badge={<SettingsBadge tone="neutral">{pick('信号源', 'Feeds')}</SettingsBadge>}
          />
        </div>

        <section className="settings-reference-card settings-reference-card--soft">
          <div className="settings-reference-toolbar">
            <div className="settings-reference-toolbar__filters">
              <div className="min-w-[280px] max-w-full">
                <SegmentedControlMulti
                  options={levelOptions}
                  value={levelFilterToLabel(levelFilter)}
                  onChange={(value) => setLevelFilter(parseLevelFilter(value))}
                />
              </div>
              <div className="min-w-[260px] max-w-full">
                <SettingSelect
                  label={pick('来源筛选', 'Source')}
                  value={sourceFilter}
                  options={[
                    { value: 'ALL', label: pick('全部来源', 'All Sources') },
                    ...sourceOptions.map((source) => ({ value: source, label: source })),
                  ]}
                  onChange={setSourceFilter}
                />
              </div>
            </div>
            <div className="settings-reference-toolbar__meta">
              {hasFilters ? (
                <SettingsActionButton onClick={handleClearFilters}>{pick('清空筛选', 'Clear Filters')}</SettingsActionButton>
              ) : (
                <SettingsBadge tone="neutral">{pick('无筛选', 'No Filters')}</SettingsBadge>
              )}
              <StatusBadge status={isStreamPaused ? 'paused' : 'online'} label={isStreamPaused ? pick('已暂停', 'Paused') : pick('运行中', 'Running')} />
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('实时流', 'Live Feed')}</div>
                <div className="settings-reference-card__title">{pick('日志流列表', 'Streaming Log Rows')}</div>
                <div className="settings-reference-card__meta">
                  {pick('每一条都会保留时间、来源、级别和详情，方便直接定位问题。', 'Each row keeps the timestamp, source, level, and detail block visible.')}
                </div>
              </div>
              <ScrollText size={18} className="text-[var(--text-primary)]" />
            </div>

            {filteredLogs.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title={logs.length === 0 ? pick('今天还没有日志', 'No logs recorded yet') : pick('当前筛选条件下没有结果', 'No rows match the current filters')}
                  description={
                    logs.length === 0
                      ? pick('系统今天还没有写入日志事件。', 'The system has not written any log events today.')
                      : pick('试试其他筛选组合，或者清空当前筛选。', 'Try another filter combination or clear the current filters.')
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
                  <div className="settings-reference-card__eyebrow">{pick('告警摘要', 'Alert Summary')}</div>
                  <div className="settings-reference-card__title">{pick('当前信号', 'Current Signal')}</div>
                  <div className="settings-reference-card__meta">
                    {pick('快速查看当前的告警压力和最高优先级消息。', 'A compact summary of alert pressure and the highest-priority message in the stream.')}
                  </div>
                </div>
                <ShieldAlert size={18} className="text-[var(--text-primary)]" />
              </div>

              <div className="mt-5 settings-reference-list">
                <div className="settings-reference-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="settings-reference-list-item__title">{pick('严重与错误', 'Critical & Error')}</div>
                    <div className="settings-reference-list-item__meta">
                      {pick('优先排查高优先级异常。', 'Highest-priority rows that should be investigated first.')}
                    </div>
                  </div>
                  <div className="settings-reference-list-item__value">{errorLogs.length}</div>
                </div>
                <div className="settings-reference-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="settings-reference-list-item__title">{pick('警告', 'Warnings')}</div>
                    <div className="settings-reference-list-item__meta">
                      {pick('如果持续出现，警告也可能演变为故障。', 'Advisory rows that may turn into incidents if they repeat.')}
                    </div>
                  </div>
                  <div className="settings-reference-list-item__value">{warningLogs.length}</div>
                </div>
                <div className="settings-reference-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="settings-reference-list-item__title">{pick('优先来源', 'Priority Source')}</div>
                    <div className="settings-reference-list-item__meta">
                      {pick('最近一条严重或错误日志的来源。', 'The source attached to the latest critical or error event.')}
                    </div>
                  </div>
                  <div className="settings-reference-list-item__value">{latestCritical?.source || pick('无', 'None')}</div>
                </div>
              </div>
            </section>

            <section className="settings-reference-card settings-reference-card--soft">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">{pick('最新告警', 'Latest Alert')}</div>
                  <div className="settings-reference-card__title">
                    {latestCritical ? getLevelLabel(latestCritical.level) : pick('没有严重事件', 'No critical event')}
                  </div>
                  <div className="settings-reference-card__meta">
                    {latestCritical
                      ? `${formatLogTime(latestCritical.timestamp)} · ${latestCritical.source}`
                      : pick('当前实时流中没有严重或错误日志。', 'The live stream has no critical or error rows right now.')}
                  </div>
                </div>
                <StatusBadge
                  status={latestCritical ? getLevelStatus(latestCritical.level) : 'online'}
                  label={latestCritical ? pick('待排查', 'Investigate') : pick('稳定', 'Stable')}
                />
              </div>
              <div className="mt-4 text-[14px] leading-6 text-[var(--text-secondary)]">
                {latestCritical?.message || pick('普通警告和信息日志可以在左侧日志流中继续查看。', 'Warnings and informational rows can be reviewed from the stream without urgent intervention.')}
              </div>
            </section>

            {logs.length > 0 ? (
              <section className="settings-reference-card settings-reference-danger">
                <div className="settings-reference-card__header">
                  <div>
                    <div className="settings-reference-card__eyebrow">{pick('危险操作', 'Danger Zone')}</div>
                    <div className="settings-reference-card__title">{pick('清空今日日志缓存', 'Clear Today’s Log Cache')}</div>
                    <div className="settings-reference-card__meta">
                      {pick('这会删除今天的全部缓存日志，而不仅仅是当前筛选结果。', 'This removes all cached log rows for the current day, not just the currently visible filtered result.')}
                    </div>
                  </div>
                  <Trash2 size={18} className="text-[var(--state-danger-text)]" />
                </div>
                <div className="mt-4">
                  <SettingsActionButton icon={Trash2} tone="danger" onClick={handleClearLogs}>
                    {pick('清空日志缓存', 'Clear Log Cache')}
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
