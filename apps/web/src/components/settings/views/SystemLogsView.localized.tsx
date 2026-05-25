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
  SettingsActionButton,
  SettingsBadge,
  SettingsDangerZone,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';
import { EmptyState, SegmentedControlMulti, SettingSelect, StatusBadge } from '../ui/index';

type LevelFilter = 'all' | 'error' | 'warning' | 'info';

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
  const { locale, pick } = useLocale();
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
    // 简体中文注释：若开启了“保留日志”，则不清除控制台日志，并给出相应提示
    if (preserveLog) {
      notify.info(
        pick('保留日志已开启', 'Preserve log enabled'),
        pick('日志已被保留，未从控制台清除。', 'Logs were preserved and not cleared from console.')
      );
      return;
    }

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          pick(
            '确认清空今日日志缓存吗？此操作不可撤销。',
            'Clear today’s log cache? This action cannot be undone.',
          ),
        );
    if (!confirmed) return;

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
        <SettingsHero
          eyebrow={pick('高级设置', 'Advanced settings')}
          title={pick('日志', 'Logs')}
          description={pick(
            '查看实时日志、过滤和告警。',
            'Inspect live logs, filters, and alerts.'
          )}
          badge={(
            <SettingsBadge tone={isStreamPaused ? 'neutral' : errorLogs.length > 0 ? 'amber' : 'emerald'}>
              {isStreamPaused ? pick('流已暂停', 'Stream Paused') : pick('实时流', 'Live Stream')}
            </SettingsBadge>
          )}
          actions={(
            <>
              <SettingsActionButton icon={isStreamPaused ? Play : Pause} onClick={handleToggleStream}>
                {isStreamPaused ? pick('恢复流', 'Resume Stream') : pick('暂停流', 'Pause Stream')}
              </SettingsActionButton>
              <SettingsActionButton icon={Download} tone="primary" onClick={handleDownload}>
                {pick('导出日志', 'Export Logs')}
              </SettingsActionButton>
            </>
          )}
          metrics={(
            <>
              <SettingsMetricCard
                label={pick('今日', 'Today')}
                value={pick(`${logs.length} 条`, `${logs.length} rows`)}
                helper={pick('当前本地日期内写入的全部日志。', 'All log entries recorded during the current local day.')}
                tone="indigo"
              />
              <SettingsMetricCard
                label={pick('可见', 'Visible')}
                value={pick(`${filteredLogs.length} 条`, `${filteredLogs.length} rows`)}
                helper={hasFilters ? pick('当前筛选条件正在限制结果范围。', 'Current filters are limiting the live stream.') : pick('当前展示了全部可用日志。', 'The stream is showing every available log row.')}
                tone={hasFilters ? 'amber' : 'neutral'}
              />
              <SettingsMetricCard
                label={pick('错误', 'Errors')}
                value={`${errorLogs.length}`}
                helper={errorLogs.length > 0 ? pick('建议优先排查严重和错误级别日志。', 'Critical or error entries should be triaged first.') : pick('当前没有严重或错误日志。', 'No critical or error entries are present right now.')}
                tone={errorLogs.length > 0 ? 'rose' : 'emerald'}
              />
              <SettingsMetricCard
                label={pick('来源', 'Sources')}
                value={`${sourceOptions.length}`}
                helper={latestLog ? pick(`最近更新于 ${formatLogTime(latestLog.timestamp)}`, `Latest update ${formatLogTime(latestLog.timestamp)}`) : pick('还没有收到新的实时更新。', 'No live updates have arrived yet.')}
                tone="neutral"
              />
            </>
          )}
        />

        <SettingsSection
          title={pick('过滤与流控制', 'Filters and stream control')}
          eyebrow={pick('查看范围', 'View scope')}
          description={pick(
            '配置控制台参数并统一控制级别 and 来源。',
            'Configure console parameters and control severity and source.'
          )}
          surface="plain"
        >
          <div className="settings-reference-toolbar settings-reference-toolbar--flat">
            {/* 简体中文注释：上方：紧凑的过滤与级别控制栏 */}
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

          {/* 简体中文注释：下方：Chrome DevTools 对齐的控制台配置复选框面板 */}
          <div className="settings-console-panel">
            <div className="settings-console-title">{pick('控制台配置选项', 'Console configuration options')}</div>
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
                      onChange={() => {}} // 采用 div 的 onClick 处理，避免 React 关于只读 checked 的 warning
                    />
                    <div className="settings-console-checkbox-custom" />
                  </div>
                  <span className="settings-console-label">{pick('网络消息', 'Network messages')}</span>
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
                  <span className="settings-console-label">{pick('保留日志', 'Preserve log')}</span>
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
                  <span className="settings-console-label">{pick('仅选中上下文', 'Selected context only')}</span>
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
                  <span className="settings-console-label">{pick('分组相似消息', 'Group similar messages')}</span>
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
                  <span className="settings-console-label">{pick('控制台中的CORS错误', 'CORS errors in console')}</span>
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
                  <span className="settings-console-label">{pick('记录XMLHttpRequests日志', 'Log XMLHttpRequests')}</span>
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
                  <span className="settings-console-label">{pick('立即求值', 'Eager evaluation')}</span>
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
                  <span className="settings-console-label">{pick('从历史记录中自动补全', 'Autocomplete from history')}</span>
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
                  <span className="settings-console-label">{pick('将代码评估视为用户操作', 'Evaluate code as user action')}</span>
                </div>
              </div>
            </div>
          </div>
        </SettingsSection>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <SettingsSection
            title={pick('日志流列表', 'Streaming log rows')}
            eyebrow={pick('实时流', 'Live feed')}
            description={pick(
              '保留时间、来源、级别和详情。',
              'Keep timestamp, source, level, and details visible.'
            )}
          >
            <div className="settings-reference-card__header">
              <div />
              <ScrollText size={18} className="text-[var(--text-primary)]" />
            </div>

            {groupedLogs.length === 0 ? (
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
          </SettingsSection>

          <div className="settings-reference-stack">
            <SettingsSection
              title={pick('当前信号', 'Current signal')}
              eyebrow={pick('告警摘要', 'Alert summary')}
              description={pick(
                '快速查看告警数量和主要来源。',
                'Quickly review alert count and priority source.'
              )}
            >
              <div className="settings-reference-card__header">
                <div />
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
            </SettingsSection>

            <SettingsSection
              title={pick('最新告警', 'Latest alert')}
              eyebrow={pick('最新告警', 'Latest alert')}
              description={
                latestCritical
                  ? `${formatLogTime(latestCritical.timestamp)} · ${latestCritical.source}`
                  : pick('当前实时流中没有严重或错误日志。', 'The live stream has no critical or error rows right now.')
              }
              action={(
                <StatusBadge
                  status={latestCritical ? getLevelStatus(latestCritical.level) : 'online'}
                  label={latestCritical ? pick('待排查', 'Investigate') : pick('稳定', 'Stable')}
                />
              )}
            >
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__title">
                    {latestCritical ? getLevelLabel(latestCritical.level) : pick('没有严重事件', 'No critical event')}
                  </div>
                </div>
                <div />
              </div>
              <div className="mt-4 text-[14px] leading-6 text-[var(--text-secondary)]">
                {latestCritical?.message || pick('普通警告和信息日志可以在左侧日志流中继续查看。', 'Warnings and informational rows can be reviewed from the stream without urgent intervention.')}
              </div>
            </SettingsSection>

            {logs.length > 0 ? (
              <SettingsDangerZone
                title={pick('清空今日日志缓存', 'Clear today’s log cache')}
                description={pick(
                  '会清空今天的全部缓存日志，不只是当前筛选结果。',
                  'This clears every cached log row for today, not only the filtered view.'
                )}
                action={(
                  <SettingsActionButton icon={Trash2} tone="danger" onClick={handleClearLogs}>
                    {pick('清空日志缓存', 'Clear Log Cache')}
                  </SettingsActionButton>
                )}
              />
            ) : null}
          </div>
        </div>
      </div>
    </SettingsViewShell>
  );
};

export default SystemLogsView;
