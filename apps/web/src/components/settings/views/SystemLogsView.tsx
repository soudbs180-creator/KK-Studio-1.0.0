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
import { SettingsActionButton, SettingsBadge, SettingsCardGridContainer, SettingsViewShell } from '../SettingsScaffold';
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
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'settings-log-stream-entry settings-log-stream-entry--error';
  if (level === LogLevel.WARNING) return 'settings-log-stream-entry settings-log-stream-entry--warning';
  return 'settings-log-stream-entry';
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

// 简体中文注释：获取本地存储布尔值的辅助函数，默认值可配，以处理非 window 渲染环境
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

  // 简体中文注释：控制台配置选项的状态声明，与 localStorage 进行深度绑定实现持久化配置
  const [networkMessages, setNetworkMessages] = useState(() => getLocalStorageBool('console_network_messages', true));
  const [preserveLog, setPreserveLog] = useState(() => getLocalStorageBool('console_preserve_log', false));
  const [selectedContextOnly, setSelectedContextOnly] = useState(() => getLocalStorageBool('console_selected_context_only', false));
  const [groupSimilar, setGroupSimilar] = useState(() => getLocalStorageBool('console_group_similar', true));
  const [corsErrors, setCorsErrors] = useState(() => getLocalStorageBool('console_cors_errors', true));
  const [logXHR, setLogXHR] = useState(() => getLocalStorageBool('console_log_xhr', true));
  const [eagerEval, setEagerEval] = useState(() => getLocalStorageBool('console_eager_eval', true));
  const [autocomplete, setAutocomplete] = useState(() => getLocalStorageBool('console_autocomplete', true));
  const [evaluateAsUser, setEvaluateAsUser] = useState(() => getLocalStorageBool('console_evaluate_as_user', false));

  // 简体中文注释：处理控制台配置项切换的处理器，执行 React 状态变动的同时写入 localStorage
  const handleToggleOption = (key: string) => {
    if (key === 'console_network_messages') {
      setNetworkMessages(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_preserve_log') {
      setPreserveLog(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_selected_context_only') {
      setSelectedContextOnly(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_group_similar') {
      setGroupSimilar(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_cors_errors') {
      setCorsErrors(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_log_xhr') {
      setLogXHR(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_eager_eval') {
      setEagerEval(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_autocomplete') {
      setAutocomplete(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
    } else if (key === 'console_evaluate_as_user') {
      setEvaluateAsUser(prev => { const next = !prev; setLocalStorageBool(key, next); return next; });
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

    // 基础级别过滤
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

    // 统一按时间倒序排列并返回切片
    return result.slice().sort((a, b) => b.timestamp - a.timestamp);
  }, [levelFilter, logs, sourceFilter, networkMessages, corsErrors, selectedContextOnly]);

  // 简体中文注释：用于实现相邻或连续相同日志的折叠聚合
  const groupedLogs = useMemo(() => {
    if (!groupSimilar) {
      return filteredLogs.map(log => ({ ...log, count: 1 }));
    }

    const grouped: (SystemLogEntry & { count: number })[] = [];
    for (const log of filteredLogs) {
      if (grouped.length === 0) {
        grouped.push({ ...log, count: 1 });
        continue;
      }

      const prev = grouped[grouped.length - 1];
      // 如果消息相同、级别相同且来源相同，则视为相似，进行折叠
      const isSimilar = prev.message === log.message &&
                        prev.level === log.level &&
                        prev.source === log.source;

      if (isSimilar) {
        prev.count += 1;
      } else {
        grouped.push({ ...log, count: 1 });
      }
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
      <SettingsCardGridContainer>
        {/* Metric Card 1: Today (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Today Written</span>
              <ScrollText size={13} />
            </div>
            <div className="text-sm font-bold text-white mt-1.5">{logs.length} rows</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">Total logged events today.</div>
          </div>
        </div>

        {/* Metric Card 2: Visible (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Visible</span>
              <ScrollText size={13} />
            </div>
            <div className="text-sm font-bold text-white mt-1.5">{filteredLogs.length} rows</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">Logs visible under filter.</div>
          </div>
        </div>

        {/* Metric Card 3: Errors (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Errors</span>
              <ShieldAlert size={13} />
            </div>
            <div className={`text-sm font-bold mt-1.5 ${errorLogs.length > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {errorLogs.length}
            </div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">Critical errors recorded.</div>
          </div>
        </div>

        {/* Metric Card 4: Sources (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Sources</span>
              <ScrollText size={13} />
            </div>
            <div className="text-sm font-bold text-white mt-1.5">{sourceOptions.length}</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">
              {latestLog ? `Updated: ${formatLogTime(latestLog.timestamp)}` : 'Waiting...'}
            </div>
          </div>
        </div>

        {/* Card 5: Scope & Stream Filter (2A*2A) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Filters & Control
            </div>
            <h3 className="text-sm font-bold text-white mt-1.5">Scope & Stream</h3>

            <div className="mt-3.5 space-y-3">
              <div className="overflow-hidden">
                <SegmentedControlMulti
                  options={[...LEVEL_OPTIONS]}
                  value={levelFilterToLabel(levelFilter)}
                  onChange={(value) => setLevelFilter(parseLevelFilter(value))}
                />
              </div>

              <div className="select-container mt-1">
                <SettingSelect
                  label=""
                  value={sourceFilter}
                  options={[
                    { value: 'ALL', label: 'All Sources' },
                    ...sourceOptions.map((source) => ({ value: source, label: source })),
                  ]}
                  onChange={setSourceFilter}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleToggleStream}
                className="bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 rounded-lg py-1 px-2.5 text-[10px] font-bold transition active:scale-95 cursor-pointer"
              >
                {isStreamPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1 px-2.5 text-[10px] font-bold transition active:scale-95 cursor-pointer"
              >
                Export
              </button>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Card 6: Console Settings switches (2A*2A) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Console Settings
            </div>
            <h3 className="text-sm font-bold text-white mt-1.5">Switches</h3>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3.5 max-h-[180px] overflow-y-auto pr-1">
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_network_messages')}>
                <input type="checkbox" checked={networkMessages} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">Network</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_preserve_log')}>
                <input type="checkbox" checked={preserveLog} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">Preserve</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_selected_context_only')}>
                <input type="checkbox" checked={selectedContextOnly} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">Context</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_group_similar')}>
                <input type="checkbox" checked={groupSimilar} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">Group</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_cors_errors')}>
                <input type="checkbox" checked={corsErrors} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">CORS</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_log_xhr')}>
                <input type="checkbox" checked={logXHR} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">XHR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 7: Alert & Action (4x2 格，共 8A) */}
        <div 
          className="dashboard-grid-card a-card-span-4-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 w-full">
            {/* Left: Alert status and latest critical error log */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Alert & Action
                </div>
                <StatusBadge
                  status={latestCritical ? getLevelStatus(latestCritical.level) : 'online'}
                  label={latestCritical ? 'Investigate' : 'Stable'}
                />
              </div>
              
              <div className="mt-3 text-[11px] leading-relaxed text-slate-300 flex-1 overflow-y-auto break-words bg-white/5 border border-white/5 rounded-lg p-2.5">
                {latestCritical ? (
                  <>
                    <div className="text-red-400 font-bold">[{getLevelLabel(latestCritical.level)}] {latestCritical.source}</div>
                    <div className="mt-0.5">{latestCritical.message}</div>
                  </>
                ) : (
                  <div className="text-slate-500 italic">No error logs currently present.</div>
                )}
              </div>
            </div>

            {/* Right: Notes and clear action button */}
            <div className="w-full md:w-[160px] shrink-0 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Maintenance
                </div>
                <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                  Manually clear today's cache stored in browser memory.
                </p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-lg py-2 px-2.5 text-[10px] font-bold transition active:scale-95 cursor-pointer text-center"
                >
                  Clear Log Cache
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 8: Streaming Log list (4A*4A) */}
        <div 
          className="dashboard-grid-card a-card-span-4-col a-card-span-4-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Streaming Logs
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[440px] settings-log-stream text-[11px]">
              {groupedLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center py-10">
                  <EmptyState
                    title={logs.length === 0 ? 'No logs recorded yet' : 'No rows match'}
                    description="No log rows were found matching the filter."
                  />
                </div>
              ) : (
                groupedLogs.map((log) => (
                  <div key={log.id} className={`${getLevelClassName(log.level)} p-2 rounded-lg bg-white/5 border border-white/5 flex flex-col gap-1`}>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <StatusBadge status={getLevelStatus(log.level)} label={getLevelLabel(log.level)} />
                      <SettingsBadge tone="neutral" className="py-0.5 px-1.5 text-[9px]">{log.source}</SettingsBadge>
                      {log.count > 1 && (
                        <span className="bg-white/10 text-white rounded-full px-1.5 text-[9px] font-bold">{log.count}x</span>
                      )}
                      <span className="text-slate-500 ml-auto">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <div className="text-white font-semibold mt-0.5">{log.message}</div>
                    {log.details && <div className="text-slate-400 text-[10px] whitespace-pre-wrap truncate leading-normal">{log.details}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SettingsCardGridContainer>
    </SettingsViewShell>
  );
};

export default SystemLogsView;
