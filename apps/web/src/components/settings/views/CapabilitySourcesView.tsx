import React, { useEffect, useState } from 'react';
import { KeyRound, Server, ShieldCheck, Globe, Cpu } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsSystemField,
  SettingsHero,
  SettingsBadge,
} from '../SettingsScaffold';
import ApiSettingsView from '../ApiSettingsView';
import { getKkApiServerHealth } from '../../../services/api/kkApiServerHealth';
import { toolRegistryInstance, type BrowserBridgeStatusSnapshot } from '../../../features/ai-assistant-runtime';

export const CapabilitySourcesView: React.FC = () => {
  const { pick } = useLocale();
  const [localRunnerStatus, setLocalRunnerStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [browserBridgeStatus, setBrowserBridgeStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  
  useEffect(() => {
    let active = true;
    const check = async () => {
      const [healthResult, bridgeResult] = await Promise.allSettled([
        getKkApiServerHealth(),
        toolRegistryInstance.execute('browser.getStatus', {}, {}) as Promise<BrowserBridgeStatusSnapshot>,
      ]);

      if (!active) return;

      setLocalRunnerStatus(
        healthResult.status === 'fulfilled' && healthResult.value.reachable ? 'active' : 'inactive'
      );

      const bridgeConnected = bridgeResult.status === 'fulfilled'
        && !bridgeResult.value.setupRequired
        && bridgeResult.value.daemonStatus === 'connected'
        && bridgeResult.value.extensionStatus === 'connected';
      setBrowserBridgeStatus(bridgeConnected ? 'active' : 'inactive');
    };

    void check();
    const interval = window.setInterval(() => {
      void check();
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const statusLabel = (status: 'checking' | 'active' | 'inactive') => {
    if (status === 'active') return pick('已连接', 'Connected');
    if (status === 'inactive') return pick('未连接', 'Offline');
    return pick('检查中', 'Checking');
  };

  const statusTone = (status: 'checking' | 'active' | 'inactive') => {
    if (status === 'active') return 'emerald';
    if (status === 'inactive') return 'rose';
    return 'slate';
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        title={pick('能力来源', 'Capability Sources')}
        eyebrow="Capability Inputs"
        description={pick(
          'KK Studio 依靠一棵能力树来驱动全部业务。此处展示并管理所有可用的输入能力（包含本地/云端 API、OAuth 认证、本地运行环境、用户网页登录态等）。',
          'Manage all capability inputs including local/cloud APIs, OAuth channels, local runner, and web session accounts.'
        )}
        icon={KeyRound}
        tone="emerald"
      />

      <SettingsSection title={pick('接入能力总览', 'Capability Overview')}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Local Runner */}
          <div className="p-3.5 rounded-xl border border-[var(--border-light)] bg-[var(--bg-overlay)] flex flex-col justify-between h-[120px]">
            <div className="flex items-start justify-between">
              <span className="p-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-coral)]">
                <Server size={16} />
              </span>
              <SettingsBadge tone={statusTone(localRunnerStatus)}>
                {statusLabel(localRunnerStatus)}
              </SettingsBadge>
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)] mt-2">Local Runner</div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{pick('本地后台代理守护进程。', 'Local daemon helper backend.')}</p>
            </div>
          </div>

          {/* Web Extension */}
          <div className="p-3.5 rounded-xl border border-[var(--border-light)] bg-[var(--bg-overlay)] flex flex-col justify-between h-[120px]">
            <div className="flex items-start justify-between">
              <span className="p-1.5 rounded-lg bg-[var(--bg-tertiary)] text-sky-400">
                <Globe size={16} />
              </span>
              <SettingsBadge tone={statusTone(browserBridgeStatus)}>{statusLabel(browserBridgeStatus)}</SettingsBadge>
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)] mt-2">Chrome Bridge / Web Member</div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{pick('浏览器直连，用于抓取或网页会员生成。', 'Browser session membership link.')}</p>
            </div>
          </div>

          {/* Local Model */}
          <div className="p-3.5 rounded-xl border border-[var(--border-light)] bg-[var(--bg-overlay)] flex flex-col justify-between h-[120px]">
            <div className="flex items-start justify-between">
              <span className="p-1.5 rounded-lg bg-[var(--bg-tertiary)] text-indigo-400">
                <Cpu size={16} />
              </span>
              <SettingsBadge tone="neutral">{pick('待激活', 'Standby')}</SettingsBadge>
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)] mt-2">Local Models</div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{pick('端侧轻量运行模型，支持离线文本任务。', 'On-device LLMs for offline text processing.')}</p>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={pick('密钥与通道配置 (原 API 设置)', 'Keys & Channels')}>
        <div className="border border-[var(--border-light)] rounded-xl overflow-hidden bg-[var(--bg-overlay)] p-2">
          {/* 渲染原有的密钥管理面版，保证所有功能零折损且不产生回归漏洞 */}
          <ApiSettingsView initialSupplier={null} />
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default CapabilitySourcesView;
