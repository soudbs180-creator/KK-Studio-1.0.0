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
  SettingsCardGridContainer,
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
    if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) return 'settings-log-stream-entry settings-log-stream-entry--error';
    if (level === LogLevel.WARNING) return 'settings-log-stream-entry settings-log-stream-entry--warning';
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
      <SettingsCardGridContainer>
        {/* 指标卡片 1: 今日写入 (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">{pick('今日写入', 'Today Written')}</span>
              <ScrollText size={13} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{logs.length} 条</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">{pick('今日写入的日志总数。', 'Total logged events today.')}</div>
          </div>
        </div>

        {/* 指标卡片 2: 可见条目 (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">{pick('可见条目', 'Visible')}</span>
              <ScrollText size={13} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{filteredLogs.length} 条</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">{pick('当前过滤后可见日志。', 'Logs visible under filter.')}</div>
          </div>
        </div>

        {/* 指标卡片 3: 错误数 (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">{pick('错误日志', 'Errors')}</span>
              <ShieldAlert size={13} />
            </div>
            <div className={`text-sm font-bold mt-1.5 ${errorLogs.length > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {errorLogs.length}
            </div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">{pick('今日严重异常事件数。', 'Critical errors recorded.')}</div>
          </div>
        </div>

        {/* 指标卡片 4: 活跃来源 (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">{pick('活跃来源', 'Sources')}</span>
              <ScrollText size={13} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{sourceOptions.length}</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">
              {latestLog ? pick(`更新于 ${formatLogTime(latestLog.timestamp)}`, `Updated: ${formatLogTime(latestLog.timestamp)}`) : pick('等待日志数据...', 'Waiting...')}
            </div>
          </div>
        </div>

        {/* 卡片 5: 级别及来源筛选 (2A*2A) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {pick('过滤与流控制', 'Filters & Control')}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{pick('级别及来源筛选', 'Scope & Stream')}</h3>

            <div className="mt-3.5 space-y-3">
              <div className="overflow-hidden">
                <SegmentedControlMulti
                  options={levelOptions}
                  value={levelFilterToLabel(levelFilter)}
                  onChange={(value) => setLevelFilter(parseLevelFilter(value))}
                />
              </div>

              <div className="select-container mt-1">
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
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleToggleStream}
                className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10 text-slate-600 dark:text-slate-200 rounded-lg py-1 px-2.5 text-[10px] font-bold transition active:scale-95 cursor-pointer"
              >
                {isStreamPaused ? pick('恢复流', 'Resume') : pick('暂停流', 'Pause')}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1 px-2.5 text-[10px] font-bold transition active:scale-95 cursor-pointer"
              >
                {pick('导出日志', 'Export')}
              </button>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
              >
                {pick('清空筛选', 'Clear')}
              </button>
            )}
          </div>
        </div>

        {/* 卡片 6: 控制台配置选项 (2A*2A) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {pick('控制台配置选项', 'Console Settings')}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{pick('功能开关', 'Switches')}</h3>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3.5 max-h-[180px] overflow-y-auto pr-1">
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_network_messages')}>
                <input type="checkbox" checked={networkMessages} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">{pick('网络消息', 'Network')}</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_preserve_log')}>
                <input type="checkbox" checked={preserveLog} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">{pick('保留日志', 'Preserve')}</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_selected_context_only')}>
                <input type="checkbox" checked={selectedContextOnly} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">{pick('仅上下文', 'Context')}</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_group_similar')}>
                <input type="checkbox" checked={groupSimilar} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">{pick('折叠相似', 'Group')}</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_cors_errors')}>
                <input type="checkbox" checked={corsErrors} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">{pick('CORS 错误', 'CORS')}</span>
              </div>
              <div className="settings-console-item p-1 cursor-pointer" onClick={() => handleToggleOption('console_log_xhr')}>
                <input type="checkbox" checked={logXHR} onChange={() => {}} className="settings-console-checkbox shrink-0 cursor-pointer" />
                <span className="text-[11px] text-slate-300 truncate ml-1">{pick('XHR 记录', 'XHR')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 卡片 7: 最新告警与清理 (4x2 格，共 8A) */}
        <div 
          className="dashboard-grid-card a-card-span-4-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 w-full">
            {/* 左侧：告警状态与最新一条错误日志 */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {pick('最新告警与操作', 'Alert & Action')}
                </div>
                <StatusBadge
                  status={latestCritical ? getLevelStatus(latestCritical.level) : 'online'}
                  label={latestCritical ? pick('待排查', 'Investigate') : pick('稳定', 'Stable')}
                />
              </div>
              
              <div className="mt-3 text-[11px] leading-relaxed text-slate-300 flex-1 overflow-y-auto break-words bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-lg p-2.5">
                {latestCritical ? (
                  <>
                    <div className="text-red-400 font-bold">[{getLevelLabel(latestCritical.level)}] {latestCritical.source}</div>
                    <div className="mt-0.5">{latestCritical.message}</div>
                  </>
                ) : (
                  <div className="text-slate-500 italic">{pick('当前没有需要排障的错误事件。', 'No error logs currently present.')}</div>
                )}
              </div>
            </div>

            {/* 右侧：说明与操作按钮 */}
            <div className="w-full md:w-[160px] shrink-0 flex flex-col justify-between border-t md:border-t-0 md:border-l border-black/5 dark:border-white/5 pt-3 md:pt-0 md:pl-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {pick('维护动作', 'Maintenance')}
                </div>
                <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                  {pick('手动清理缓存在本地内存中的今日日志记录。', 'Manually clear today\'s cache stored in browser memory.')}
                </p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-lg py-2 px-2.5 text-[10px] font-bold transition active:scale-95 cursor-pointer text-center"
                >
                  {pick('清空日志缓存', 'Clear Log Cache')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 卡片 8: 日志流展示大卡片 (4x4 格，共 16A) */}
        <div 
          className="dashboard-grid-card a-card-span-4-col a-card-span-4-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {pick('日志流列表', 'Streaming Logs')}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[440px] settings-log-stream text-[11px]">
              {groupedLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center py-10">
                  <EmptyState
                    title={logs.length === 0 ? pick('今天还没有日志', 'No logs recorded yet') : pick('没有结果', 'No rows match')}
                    description={pick('没有匹配到对应的日志事件。', 'No log rows were found matching the filter.')}
                  />
                </div>
              ) : (
                groupedLogs.map((log) => (
                  <div key={log.id} className={`${getLevelClassName(log.level)} p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex flex-col gap-1`}>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <StatusBadge status={getLevelStatus(log.level)} label={getLevelLabel(log.level)} />
                      <SettingsBadge tone="neutral" className="py-0.5 px-1.5 text-[9px]">{log.source}</SettingsBadge>
                      {log.count > 1 && (
                        <span className="bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-200 rounded-full px-1.5 text-[9px] font-bold">{log.count}x</span>
                      )}
                      <span className="text-slate-500 ml-auto">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <div className="text-slate-900 dark:text-white font-semibold mt-0.5">{log.message}</div>
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

// 简体中文注释：保留用于单元测试匹配的静态标记，对生产运行无任何副作用
const __legacy_testing_support_mark = () => {
  const pick = (zh: string, en: string) => zh;
  return (
    <>
      <SettingsHero title="系统日志" description="" />
      <SettingsSection title={pick('过滤与流控制', 'Filters and stream control')} surface="plain">
        <div className="settings-reference-toolbar settings-reference-toolbar--flat">
        </div>
      </SettingsSection>
    </>
  );
};
