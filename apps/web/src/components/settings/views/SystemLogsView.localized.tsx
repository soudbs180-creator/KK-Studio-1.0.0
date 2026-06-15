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
import {
  SettingsBadge,
  SettingsCardGridContainer,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';
import { EmptyState, SegmentedControlMulti, SettingSelect, StatusBadge } from '../ui/index';

type LevelFilter = 'all' | 'error' | 'warning' | 'info';

const getLocalStorageBool = (key: string, defaultValue: boolean): boolean => {
  if (typeof window === 'undefined') return defaultValue;
  const value = localStorage.getItem(key);
  return value !== null ? value === 'true' : defaultValue;
};

const setLocalStorageBool = (key: string, value: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, String(value));
  }
};

const getLogTimeValue = (timestamp?: number | string) => {
  if (!timestamp) return 0;
  return typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
};

export const SystemLogsView: React.FC = () => {
  const { locale, pick } = useLocale();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [isStreamPaused, setIsStreamPaused] = useState(false);

  const [networkMessages, setNetworkMessages] = useState(() => getLocalStorageBool('console_network_messages', true));
  const [preserveLog, setPreserveLog] = useState(() => getLocalStorageBool('console_preserve_log', false));
  const [selectedContextOnly, setSelectedContextOnly] = useState(() => getLocalStorageBool('console_selected_context_only', false));
  const [groupSimilar, setGroupSimilar] = useState(() => getLocalStorageBool('console_group_similar', true));
  const [corsErrors, setCorsErrors] = useState(() => getLocalStorageBool('console_cors_errors', true));
  const [logXHR, setLogXHR] = useState(() => getLocalStorageBool('console_log_xhr', true));

  const levelOptions = useMemo(
    () => [
      pick('全部级别', 'All Levels'),
      pick('仅错误', 'Errors Only'),
      pick('仅警告', 'Warnings Only'),
      pick('仅信息', 'Info Only'),
    ],
    [pick],
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

  const getLevelData = (level: LogLevel) => {
    if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'error';
    if (level === LogLevel.WARNING) return 'warning';
    return 'info';
  };

  const getLevelClassName = (level: LogLevel) => {
    if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) {
      return 'settings-log-stream-entry settings-log-stream-entry--error';
    }
    if (level === LogLevel.WARNING) {
      return 'settings-log-stream-entry settings-log-stream-entry--warning';
    }
    return 'settings-log-stream-entry';
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
        ].filter(Boolean).join('\n'),
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

  const handleToggleOption = (key: string) => {
    if (key === 'console_network_messages') {
      setNetworkMessages((current) => {
        const next = !current;
        setLocalStorageBool(key, next);
        return next;
      });
    } else if (key === 'console_preserve_log') {
      setPreserveLog((current) => {
        const next = !current;
        setLocalStorageBool(key, next);
        return next;
      });
    } else if (key === 'console_selected_context_only') {
      setSelectedContextOnly((current) => {
        const next = !current;
        setLocalStorageBool(key, next);
        return next;
      });
    } else if (key === 'console_group_similar') {
      setGroupSimilar((current) => {
        const next = !current;
        setLocalStorageBool(key, next);
        return next;
      });
    } else if (key === 'console_cors_errors') {
      setCorsErrors((current) => {
        const next = !current;
        setLocalStorageBool(key, next);
        return next;
      });
    } else if (key === 'console_log_xhr') {
      setLogXHR((current) => {
        const next = !current;
        setLocalStorageBool(key, next);
        return next;
      });
    }
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
    [logs],
  );

  useEffect(() => {
    if (sourceFilter !== 'ALL' && !sourceOptions.includes(sourceFilter)) {
      setSourceFilter('ALL');
    }
  }, [sourceFilter, sourceOptions]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (!networkMessages) {
      result = result.filter((log) => {
        const source = log.source.toLowerCase();
        const message = (log.message || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const isNetworkSource = ['api', 'billing'].includes(source);
        const isNetworkMessage = /fetch|axios|http|\/api\/|xmlhttprequest/.test(`${message} ${details}`);
        return !isNetworkSource && !isNetworkMessage;
      });
    }

    if (!corsErrors) {
      result = result.filter((log) => {
        const text = `${log.message || ''} ${log.details || ''} ${log.stack || ''}`.toLowerCase();
        return !text.includes('cors') && !text.includes('cross-origin');
      });
    }

    if (selectedContextOnly) {
      result = result.filter((log) => {
        if (sourceFilter !== 'ALL') return log.source === sourceFilter;
        return ['SYSTEM', 'INTERNAL'].includes(log.source.toUpperCase());
      });
    } else if (sourceFilter !== 'ALL') {
      result = result.filter((log) => log.source === sourceFilter);
    }

    result = result.filter((log) => {
      if (levelFilter === 'error') {
        return log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL;
      }
      if (levelFilter === 'warning') return log.level === LogLevel.WARNING;
      if (levelFilter === 'info') return log.level === LogLevel.INFO;
      return true;
    });

    return result.slice().sort((a, b) => getLogTimeValue(b.timestamp) - getLogTimeValue(a.timestamp));
  }, [corsErrors, levelFilter, logs, networkMessages, selectedContextOnly, sourceFilter]);

  const groupedLogs = useMemo(() => {
    if (!groupSimilar) {
      return filteredLogs.map((log) => ({ ...log, count: 1 }));
    }

    const grouped: (SystemLogEntry & { count: number })[] = [];
    for (const log of filteredLogs) {
      const previous = grouped[grouped.length - 1];
      if (previous && previous.message === log.message && previous.level === log.level && previous.source === log.source) {
        previous.count += 1;
      } else {
        grouped.push({ ...log, count: 1 });
      }
    }
    return grouped;
  }, [filteredLogs, groupSimilar]);

  const errorLogs = useMemo(
    () => logs.filter((item) => item.level === LogLevel.ERROR || item.level === LogLevel.CRITICAL),
    [logs],
  );

  const latestLog = filteredLogs[0] || null;
  const latestCritical = errorLogs[0] || null;
  const hasFilters = levelFilter !== 'all' || sourceFilter !== 'ALL';
  const consoleOptions = [
    { key: 'console_network_messages', label: pick('网络消息', 'Network'), enabled: networkMessages },
    { key: 'console_preserve_log', label: pick('保留日志', 'Preserve'), enabled: preserveLog },
    { key: 'console_selected_context_only', label: pick('仅上下文', 'Context'), enabled: selectedContextOnly },
    { key: 'console_group_similar', label: pick('折叠相似', 'Group'), enabled: groupSimilar },
    { key: 'console_cors_errors', label: pick('CORS 错误', 'CORS'), enabled: corsErrors },
    { key: 'console_log_xhr', label: pick('XHR 记录', 'XHR'), enabled: logXHR },
  ] as const;

  const handleDownload = () => {
    downloadText(
      `kk-studio-logs-${new Date().toISOString().slice(0, 10)}.txt`,
      formatLogsForDownload(filteredLogs),
    );
    notify.success(
      pick('导出已开始', 'Export started'),
      pick('当前筛选结果会被导出为文本文件。', 'The current filtered results will be exported as a text file.'),
    );
  };

  const handleClearFilters = () => {
    setLevelFilter('all');
    setSourceFilter('ALL');
  };

  const handleClearLogs = () => {
    if (preserveLog) {
      notify.info(
        pick('保留日志已开启', 'Preserve log enabled'),
        pick('日志已被保留，未从控制台清除。', 'Logs were preserved and not cleared from console.'),
      );
      return;
    }

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          pick('确认清空今日日志缓存吗？此操作不可撤销。', "Clear today's log cache? This action cannot be undone."),
        );
    if (!confirmed) return;

    clearLogs();
    setLogs([]);
    notify.success(
      pick('已清空', 'Cleared'),
      pick('今日日志缓存已经清空。', "Today's cached logs were cleared."),
    );
  };

  return (
    <SettingsViewShell className="settings-system-logs-view">
      <SettingsHero
        eyebrow={pick('系统维护', 'System maintenance')}
        title={pick('系统日志', 'System Logs')}
        description={pick(
          '统一查看今日运行日志、筛选来源与级别，并管理控制台保留策略。',
          "Review today's runtime logs, filter by source and level, and manage console retention controls.",
        )}
        icon={ScrollText}
        tone={latestCritical ? 'rose' : 'emerald'}
        badge={
          <SettingsBadge tone={latestCritical ? 'rose' : 'emerald'}>
            {latestCritical ? pick('需要排查', 'Needs review') : pick('运行稳定', 'Stable')}
          </SettingsBadge>
        }
      />

      <SettingsCardGridContainer>
        <div className="settings-log-metrics-grid">
          <div className="settings-log-metric" data-tone="neutral">
            <SettingsMetricCard
              label={pick('今日写入', 'Today Written')}
              value={`${logs.length} ${pick('条', 'rows')}`}
              helper={pick('今日写入的日志总数。', 'Total logged events today.')}
              icon={ScrollText}
              tone="neutral"
            />
          </div>
          <div className="settings-log-metric" data-tone="neutral">
            <SettingsMetricCard
              label={pick('可见条目', 'Visible')}
              value={`${filteredLogs.length} ${pick('条', 'rows')}`}
              helper={pick('当前过滤后可见日志。', 'Logs visible under filter.')}
              icon={ScrollText}
              tone="sky"
            />
          </div>
          <div className="settings-log-metric" data-tone={errorLogs.length > 0 ? 'danger' : 'success'}>
            <SettingsMetricCard
              label={pick('错误日志', 'Errors')}
              value={errorLogs.length}
              helper={pick('今日严重异常事件数。', 'Critical errors recorded.')}
              icon={ShieldAlert}
              tone={errorLogs.length > 0 ? 'rose' : 'emerald'}
            />
          </div>
          <div className="settings-log-metric" data-tone="neutral">
            <SettingsMetricCard
              label={pick('活跃来源', 'Sources')}
              value={sourceOptions.length}
              helper={latestLog ? pick(`更新于 ${formatLogTime(latestLog.timestamp)}`, `Updated: ${formatLogTime(latestLog.timestamp)}`) : pick('等待日志数据...', 'Waiting...')}
              icon={ScrollText}
              tone="neutral"
            />
          </div>
        </div>

        <SettingsSection
          title={pick('过滤与流控制', 'Filters and stream control')}
          description={pick('调整可见日志范围，并暂停或导出当前日志流。', 'Adjust visible log scope and pause or export the current stream.')}
          eyebrow={pick('过滤器', 'Filters')}
          surface="plain"
          action={
            <StatusBadge
              status={isStreamPaused ? 'warning' : 'online'}
              label={isStreamPaused ? pick('已暂停', 'Paused') : pick('实时', 'Live')}
            />
          }
        >
          <div className="settings-reference-toolbar settings-reference-toolbar--flat">
            <div className="settings-log-toolbar">
              <div className="settings-log-toolbar__controls">
                <SegmentedControlMulti
                  options={levelOptions}
                  value={levelFilterToLabel(levelFilter)}
                  onChange={(value) => setLevelFilter(parseLevelFilter(value))}
                />
                <SettingSelect
                  label=""
                  value={sourceFilter}
                  options={[
                    { value: 'ALL', label: pick('全部来源', 'All Sources') },
                    ...sourceOptions.map((source) => ({ value: source, label: source })),
                  ]}
                  onChange={setSourceFilter}
                />
              </div>
              <div className="settings-log-toolbar__actions">
                <button
                  type="button"
                  onClick={() => setIsStreamPaused((current) => !current)}
                  className="settings-log-action"
                  data-variant={isStreamPaused ? 'primary' : 'neutral'}
                >
                  {isStreamPaused ? <Play size={13} /> : <Pause size={13} />}
                  <span>{isStreamPaused ? pick('恢复流', 'Resume') : pick('暂停流', 'Pause')}</span>
                </button>
                <button type="button" onClick={handleDownload} className="settings-log-action" data-variant="primary">
                  <Download size={13} />
                  <span>{pick('导出日志', 'Export')}</span>
                </button>
                {hasFilters ? (
                  <button type="button" onClick={handleClearFilters} className="settings-log-action" data-variant="ghost">
                    {pick('清空筛选', 'Clear')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title={pick('控制台配置', 'Console settings')}
          description={pick('统一管理浏览器控制台采集、折叠和上下文范围。', 'Manage browser console capture, grouping, and scope controls.')}
          eyebrow={pick('开关', 'Switches')}
        >
          <div className="settings-log-switch-grid">
            {consoleOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className="settings-log-switch-option"
                data-state={option.enabled ? 'on' : 'off'}
                aria-pressed={option.enabled}
                onClick={() => handleToggleOption(option.key)}
              >
                <input
                  type="checkbox"
                  checked={option.enabled}
                  readOnly
                  tabIndex={-1}
                  className="settings-console-checkbox settings-log-switch-option__input"
                />
                <span className="settings-log-switch-option__label">{option.label}</span>
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title={pick('最新告警与操作', 'Alert and action')}
          description={pick('聚焦最新严重日志，并提供明确的维护动作。', 'Focus the latest severe event and expose a clear maintenance action.')}
          eyebrow={pick('维护', 'Maintenance')}
          action={
            <StatusBadge
              status={latestCritical ? getLevelStatus(latestCritical.level) : 'online'}
              label={latestCritical ? pick('待排查', 'Investigate') : pick('稳定', 'Stable')}
            />
          }
        >
          <div className="settings-log-alert-card" data-state={latestCritical ? 'alert' : 'stable'}>
            <div className="settings-log-alert-card__message">
              {latestCritical ? (
                <>
                  <div className="settings-log-alert-card__level" data-level={getLevelData(latestCritical.level)}>
                    [{getLevelLabel(latestCritical.level)}] {latestCritical.source}
                  </div>
                  <div className="settings-log-alert-card__copy">{latestCritical.message}</div>
                </>
              ) : (
                <div className="settings-log-alert-card__empty">
                  {pick('当前没有需要排障的错误事件。', 'No error logs currently present.')}
                </div>
              )}
            </div>
            <div className="settings-log-alert-card__maintenance">
              <div>
                <div className="settings-log-alert-card__eyebrow">{pick('维护动作', 'Maintenance')}</div>
                <p className="settings-log-alert-card__description">
                  {pick('手动清理缓存在本地内存中的今日日志记录。', "Manually clear today's cache stored in browser memory.")}
                </p>
              </div>
              <button type="button" onClick={handleClearLogs} className="settings-log-action" data-variant="danger">
                <Trash2 size={13} />
                <span>{pick('清空日志缓存', 'Clear Log Cache')}</span>
              </button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title={pick('日志流列表', 'Streaming Logs')}
          description={pick('按时间倒序展示当前筛选后的日志流。', 'Shows filtered log rows in reverse chronological order.')}
          eyebrow={pick('流', 'Stream')}
          action={<SettingsBadge tone="neutral">{`${groupedLogs.length} ${pick('条', 'rows')}`}</SettingsBadge>}
        >
          <div className="settings-log-stream-card">
            <div className="settings-log-stream">
              {groupedLogs.length === 0 ? (
                <div className="settings-log-stream__empty">
                  <EmptyState
                    title={logs.length === 0 ? pick('今天还没有日志', 'No logs recorded yet') : pick('没有结果', 'No rows match')}
                    description={pick('没有匹配到对应的日志事件。', 'No log rows were found matching the filter.')}
                  />
                </div>
              ) : (
                groupedLogs.map((log) => (
                  <div key={log.id} className={getLevelClassName(log.level)} data-level={getLevelData(log.level)}>
                    <div className="settings-log-stream-entry__header">
                      <StatusBadge status={getLevelStatus(log.level)} label={getLevelLabel(log.level)} />
                      <SettingsBadge tone="neutral" className="settings-log-stream-entry__source">{log.source}</SettingsBadge>
                      {log.count > 1 ? <span className="settings-log-count-pill">{log.count}x</span> : null}
                      <span className="settings-log-stream-entry__time">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <div className="settings-log-stream-entry__message">{log.message}</div>
                    {log.details ? <div className="settings-log-stream-entry__details">{log.details}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </SettingsSection>
      </SettingsCardGridContainer>
    </SettingsViewShell>
  );
};

export default SystemLogsView;
