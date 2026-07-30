import React, { useEffect, useState } from 'react';
import { KeyRound, Server, ShieldCheck, Globe, Cpu } from 'lucide-react';
import { useLocation } from 'react-router';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsSystemField,
  SettingsHero,
  SettingsBadge,
} from '../SettingsScaffold';
import ApiSettingsView from '../ApiSettingsView';
import ProviderConnectionsPanel from '../ProviderConnectionsPanel';
import { getKkApiServerHealth } from '../../../services/api/kkApiServerHealth';
import { toolRegistryInstance, type BrowserBridgeStatusSnapshot } from '../../../features/ai-assistant-runtime';
import { isApiManagementEditorRoute } from '../apiManagementRouteState';

export const CapabilitySourcesView: React.FC = () => {
  const { pick } = useLocale();
  const location = useLocation();
  const isEditorRoute = isApiManagementEditorRoute(location.pathname);
  const [localRunnerStatus, setLocalRunnerStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [browserBridgeStatus, setBrowserBridgeStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  
  useEffect(() => {
    if (isEditorRoute) {
      return;
    }

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
  }, [isEditorRoute]);

  if (isEditorRoute) {
    return <ApiSettingsView initialSupplier={null} />;
  }

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
        <div className="settings-capability-source-grid">
          <article className="settings-capability-source-card">
            <span className="settings-capability-source-card__icon settings-capability-source-card__icon--runner">
              <Server size={16} />
            </span>
            <div className="settings-capability-source-card__copy">
              <div className="settings-capability-source-card__title">Local Runner</div>
              <p className="settings-capability-source-card__description">
                {pick('本地后台代理守护进程。', 'Local daemon helper backend.')}
              </p>
            </div>
            <SettingsBadge className="settings-capability-source-card__badge" tone={statusTone(localRunnerStatus)}>
              {statusLabel(localRunnerStatus)}
            </SettingsBadge>
          </article>

          <article className="settings-capability-source-card">
            <span className="settings-capability-source-card__icon settings-capability-source-card__icon--browser">
              <Globe size={16} />
            </span>
            <div className="settings-capability-source-card__copy">
              <div className="settings-capability-source-card__title">Chrome Bridge / Web Member</div>
              <p className="settings-capability-source-card__description">
                {pick('浏览器直连，用于抓取或网页会员生成。', 'Browser session membership link.')}
              </p>
            </div>
            <SettingsBadge className="settings-capability-source-card__badge" tone={statusTone(browserBridgeStatus)}>
              {statusLabel(browserBridgeStatus)}
            </SettingsBadge>
          </article>

          <article className="settings-capability-source-card">
            <span className="settings-capability-source-card__icon settings-capability-source-card__icon--local-model">
              <Cpu size={16} />
            </span>
            <div className="settings-capability-source-card__copy">
              <div className="settings-capability-source-card__title">Local Models</div>
              <p className="settings-capability-source-card__description">
                {pick('端侧轻量运行模型，支持离线文本任务。', 'On-device LLMs for offline text processing.')}
              </p>
            </div>
            <SettingsBadge className="settings-capability-source-card__badge" tone="neutral">
              {pick('待激活', 'Standby')}
            </SettingsBadge>
          </article>
        </div>
      </SettingsSection>

      <ProviderConnectionsPanel />

      <SettingsSection title={pick('密钥与通道配置 (原 API 设置)', 'Keys & Channels')}>
        <div className="settings-capability-api-embed">
          <ApiSettingsView initialSupplier={null} />
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default CapabilitySourcesView;
