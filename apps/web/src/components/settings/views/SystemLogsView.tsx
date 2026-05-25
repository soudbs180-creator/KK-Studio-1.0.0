import React, { useEffect, useMemo, useState } from 'react';
import { Download, Pause, Play, ScrollText, ShieldAlert, Trash2 } from 'lucide-react';
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

// 简体中文注释：获取本地存储布尔值的辅助函数
const getLocalStorageBool = (key: string, defaultValue: boolean): boolean => {
  if (typeof window === 'undefined') return defaultValue;
  const val = localStorage.getItem(key);
  return val !== null ? val === 'true' : defaultValue;
};

// 简体中文注释：设置本地存储布尔值的辅助函数
const setLocalStorageBool = (key: string, value: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, String(value));
  }
};

export const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [isStreamPaused, setIsStreamPaused] = useState(false);

  // 简体中文注释：控制台配置选项的状态声明（均与 localStorage 持久化绑定）
  const [networkMessages, setNetworkMessages] = useState(() => getLocalStorageBool('console_network_messages', true));
  const [preserveLog, setPreserveLog] = useState(() => getLocalStorageBool('console_preserve_log', false));
  const [selectedContextOnly, setSelectedContextOnly] = useState(() => getLocalStorageBool('console_selected_context_only', false));
  const [groupSimilar, setGroupSimilar] = useState(() => getLocalStorageBool('console_group_similar', true));
  const [corsErrors, setCorsErrors] = useState(() => getLocalStorageBool('console_cors_errors', true));
  const [logXHR, setLogXHR] = useState(() => getLocalStorageBool('console_log_xhr', true));
  const [eagerEval, setEagerEval] = useState(() => getLocalStorageBool('console_eager_eval', true));
  const [autocomplete, setAutocomplete] = useState(() => getLocalStorageBool('console_autocomplete', true));
  const [evaluateAsUser, setEvaluateAsUser] = useState(() => getLocalStorageBool('console_evaluate_as_user', false));

  // 简体中文注释：处理控制台复选框选项切换的函数
  const handleToggleOption = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>, current: boolean) => {
    const next = !current;
    setter(next);
    setLocalStorageBool(key, next);
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
    let result = logs;

    // 简体中文注释：根据网络消息（networkMessages）配置过滤网络日志
    if (!networkMessages) {
      result = result.filter((log) => {
        const isNetworkSource = ['API', 'Billing'].includes(log.source);
        const msg = (log.message || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const isNetworkMsg = msg.includes('fetch') || msg.includes('axios') || msg.includes('http') || msg.includes('/api/') || msg.includes('xmlhttprequest') ||
                             details.includes('fetch') || details.includes('axios') || details.includes('http') || details.includes('/api/') || details.includes('xmlhttprequest');
        return !isNetworkSource && !isNetworkMsg;
      });
    }

    // 简体中文注释：根据CORS错误（corsErrors）配置过滤CORS相关日志
    if (!corsErrors) {
      result = result.filter((log) => {
        const msg = (log.message || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const stack = (log.stack || '').toLowerCase();
        const isCors = msg.includes('cors') || msg.includes('cross-origin') ||
                       details.includes('cors') || details.includes('cross-origin') ||
                       stack.includes('cors') || stack.includes('cross-origin');
        return !isCors;
      });
    }

    // 简体中文注释：根据仅选中上下文（selectedContextOnly）配置进行关联过滤
    if (selectedContextOnly) {
      result = result.filter((log) => {
        if (sourceFilter !== 'ALL') {
          return log.source === sourceFilter;
        }
        // 如果没有单独选中，只显示核心 SYSTEM 和 INTERNAL 来源
        return ['SYSTEM', 'INTERNAL'].includes(log.source.toUpperCase());
      });
    } else {
      // 原有的普通 sourceFilter 过滤
      if (sourceFilter !== 'ALL') {
        result = result.filter((log) => log.source === sourceFilter);
      }
    }

    // 原有的 levelFilter 过滤
    result = result.filter((log) => {
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
    });

    return result.slice().sort((a, b) => b.timestamp - a.timestamp);
  }, [levelFilter, logs, sourceFilter, networkMessages, corsErrors, selectedContextOnly]);

  // 简体中文注释：根据“分组相似消息（groupSimilar）”配置对连续相同的日志进行折叠并计数
  const groupedLogs = useMemo(() => {
    if (!groupSimilar || filteredLogs.length === 0) {
      return filteredLogs.map(log => ({ ...log, count: 1 }));
    }

    const grouped: (SystemLogEntry & { count: number })[] = [];
    for (let i = 0; i < filteredLogs.length; i++) {
      const current = filteredLogs[i];
      if (grouped.length > 0) {
        const lastGroup = grouped[grouped.length - 1];
        if (lastGroup.message === current.message && lastGroup.source === current.source) {
          lastGroup.count += 1;
          continue;
        }
      }
      grouped.push({ ...current, count: 1 });
    }
    return grouped;
  }, [filteredLogs, groupSimilar]);

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
    // 简体中文注释：若开启了“保留日志”，则不清除控制台日志，并给出相应提示
    if (preserveLog) {
      notify.info('Preserve Log Enabled', 'Logs were preserved and not cleared.');
      return;
    }
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
          {/* 上方：紧凑过滤栏 */}
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

          {/* 下方：磨砂高保真控制台配置选项面板 */}
          <div className="settings-console-panel">
            <div className="settings-console-title">Console Configuration Options</div>
            <div className="settings-console-grid">
              {/* 左侧列 */}
              <div className="flex flex-col gap-2">
                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_network_messages', setNetworkMessages, networkMessages)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={networkMessages} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Network messages</span>
                </div>

                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_preserve_log', setPreserveLog, preserveLog)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={preserveLog} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Preserve log</span>
                </div>

                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_selected_context_only', setSelectedContextOnly, selectedContextOnly)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={selectedContextOnly} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Selected context only</span>
                </div>

                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_group_similar', setGroupSimilar, groupSimilar)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={groupSimilar} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Group similar messages</span>
                </div>

                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_cors_errors', setCorsErrors, corsErrors)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={corsErrors} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">CORS errors in console</span>
                </div>
              </div>

              {/* 右侧列 */}
              <div className="flex flex-col gap-2">
                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_log_xhr', setLogXHR, logXHR)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={logXHR} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Log XMLHttpRequests</span>
                </div>

                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_eager_eval', setEagerEval, eagerEval)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={eagerEval} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Eager evaluation</span>
                </div>

                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_autocomplete', setAutocomplete, autocomplete)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={autocomplete} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Autocomplete from history</span>
                </div>

                <div 
                  className="settings-console-item"
                  onClick={() => handleToggleOption('console_evaluate_as_user', setEvaluateAsUser, evaluateAsUser)}
                >
                  <div className="settings-console-checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      checked={evaluateAsUser} 
                      onChange={() => {}}
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">Evaluate code as user action</span>
                </div>
              </div>
            </div>
          </div>

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

            {groupedLogs.length === 0 ? (
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
                {groupedLogs.map((log) => (
                  <div key={log.id} className={getLevelClassName(log.level)}>
                    <div className="settings-log-entry__meta">
                      <StatusBadge status={getLevelStatus(log.level)} label={getLevelLabel(log.level)} />
                      <SettingsBadge tone="neutral">{log.source}</SettingsBadge>
                      {log.count > 1 && (
                        <span className="settings-log-group-badge">{log.count}</span>
                      )}
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
