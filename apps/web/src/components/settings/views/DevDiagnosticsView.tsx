import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import type { RuntimeHealthSnapshotDto } from '@kk/shared';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsHero,
  SettingsActionButton,
} from '../SettingsScaffold';
import { getRuntimeHealthSnapshot } from '../../../services/runtime/runtimeHealthSnapshot';
import RuntimeHealthOverview from '../RuntimeHealthOverview';

interface LogEntry {
  timestamp: string;
  module: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const DevDiagnosticsView: React.FC = () => {
  const { pick } = useLocale();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<RuntimeHealthSnapshotDto | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    const newLogs: LogEntry[] = [];
    const pushLog = (module: string, level: LogEntry['level'], message: string) => {
      newLogs.push({
        timestamp: new Date().toLocaleTimeString(),
        module,
        level,
        message,
      });
    };

    try {
      pushLog('System', 'info', 'Initializing DevDiagnostics check...');
      
      // 1. Check Local Runner / OpenCLI
      const snapshot = await getRuntimeHealthSnapshot();
      setRuntimeSnapshot(snapshot);
      snapshot.services.forEach((service) => {
        pushLog(
          service.label,
          service.status === 'ready' ? 'info' : service.status === 'offline' ? 'error' : 'warn',
          `${service.status}; latency=${service.latencyMs ?? 'n/a'}ms; version=${service.version || 'unknown'}`,
        );
      });

      const isReadonly = typeof window !== 'undefined' && (window as Window & { __KK_SETTINGS_READONLY__?: boolean }).__KK_SETTINGS_READONLY__ === true;
      pushLog('Settings', 'info', `Current settings access: ${isReadonly ? 'read-only snapshot' : 'editable runtime'}.`);
      pushLog('RouteEngine', 'info', 'Health probes do not create synthetic route decisions. Runtime traces appear only after a real request.');

      setLogs(newLogs);
    } catch (err: unknown) {
      pushLog('System', 'error', `Diagnostic interrupted: ${err instanceof Error ? err.message : String(err)}`);
      setLogs(newLogs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runDiagnostic();
  }, []);

  return (
    <SettingsViewShell>
      <SettingsHero
        title={pick('开发者诊断', 'Developer Diagnostics')}
        eyebrow="Developer Tools"
        description={pick(
          '实时诊断界面。查看 Provider 路由分配结果、BrowserActionRouter 执行过程、本地服务连通性以及安全沙箱状态。',
          'Real-time diagnostics suite. Trace provider engines, scrapers, and local runner states.'
        )}
        icon={Cpu}
        tone="rose"
        actions={
          <SettingsActionButton icon={RefreshCw} loading={loading} onClick={runDiagnostic}>
            {pick('运行诊断', 'Run Diagnostics')}
          </SettingsActionButton>
        }
      />

      <RuntimeHealthOverview
        services={runtimeSnapshot?.services || []}
        onRetry={() => void runDiagnostic()}
      />

      {/* Logs and Traces */}
      <SettingsSection title={pick('Provider 路由与执行链决策日志', 'Decision Traces & Exec Logs')}>
        <div className="bg-black/20 p-3 rounded-lg border border-[var(--border-light)] font-mono text-[10px] text-slate-300 max-h-[300px] overflow-y-auto space-y-1">
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5 border-b border-white/5 last:border-0">
              <span className="text-slate-500 shrink-0 select-none">[{l.timestamp}]</span>
              <span className={`font-semibold shrink-0 select-none ${
                l.level === 'error' ? 'text-rose-400' : l.level === 'warn' ? 'text-amber-400' : 'text-sky-400'
              }`}>
                [{l.module}]
              </span>
              <span className="break-all">{l.message}</span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default DevDiagnosticsView;
