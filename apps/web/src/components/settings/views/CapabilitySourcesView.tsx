import React, { useEffect, useState } from 'react';
import { KeyRound, Server, Globe, Cpu, Waypoints } from 'lucide-react';
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
import {
  getCliProxyModelCatalog,
  type CliProxyCatalogSnapshot,
} from '../../../services/runtime/cliProxyModelCatalog';
import { getRuntimeHealthSnapshot } from '../../../services/runtime/runtimeHealthSnapshot';
import { toolRegistryInstance, type BrowserBridgeStatusSnapshot } from '../../../features/ai-assistant-runtime';
import { isApiManagementEditorRoute } from '../apiManagementRouteState';

export const CapabilitySourcesView: React.FC = () => {
  const { pick } = useLocale();
  const location = useLocation();
  const isEditorRoute = isApiManagementEditorRoute(location.pathname);
  const [localRunnerStatus, setLocalRunnerStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [cliProxyStatus, setCliProxyStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [cliProxyCatalog, setCliProxyCatalog] = useState<CliProxyCatalogSnapshot | null>(null);
  const [browserBridgeStatus, setBrowserBridgeStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  
  useEffect(() => {
    if (isEditorRoute) {
      return;
    }

    let active = true;
    const check = async () => {
      const [healthResult, runtimeResult, catalogResult, bridgeResult] = await Promise.allSettled([
        getKkApiServerHealth(),
        getRuntimeHealthSnapshot(),
        getCliProxyModelCatalog(),
        toolRegistryInstance.execute('browser.getStatus', {}, {}) as Promise<BrowserBridgeStatusSnapshot>,
      ]);

      if (!active) return;

      setLocalRunnerStatus(
        healthResult.status === 'fulfilled' && healthResult.value.reachable ? 'active' : 'inactive'
      );
      const cliProxyService = runtimeResult.status === 'fulfilled'
        ? runtimeResult.value.services.find((service) => service.serviceId === 'cliproxyapi')
        : undefined;
      setCliProxyStatus(cliProxyService?.status === 'ready' ? 'active' : 'inactive');
      setCliProxyCatalog(catalogResult.status === 'fulfilled' ? catalogResult.value : null);

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
            <span className="settings-capability-source-card__icon settings-capability-source-card__icon--runner">
              <Waypoints size={16} />
            </span>
            <div className="settings-capability-source-card__copy">
              <div className="settings-capability-source-card__title">CLIProxyAPI</div>
              {cliProxyCatalog ? (
                <p className="settings-capability-source-card__detail">
                  {pick(
                    `${cliProxyCatalog.models.length} 个模型 · ${cliProxyCatalog.webModelCount} 个联网 · ${cliProxyCatalog.reasoningModelCount} 个思考`,
                    `${cliProxyCatalog.models.length} models · ${cliProxyCatalog.webModelCount} web · ${cliProxyCatalog.reasoningModelCount} reasoning`,
                  )}
                </p>
              ) : null}
              <p className="settings-capability-source-card__description">
                {pick('本机回环 API、账号 OAuth 与模型目录的统一管理桥。', 'Loopback bridge for APIs, account OAuth, and the model catalog.')}
              </p>
            </div>
            <SettingsBadge className="settings-capability-source-card__badge" tone={statusTone(cliProxyStatus)}>
              {statusLabel(cliProxyStatus)}
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

      <div className="settings-capability-api-embed settings-capability-api-embed--model-center">
        <ApiSettingsView initialSupplier={null} />
      </div>
    </SettingsViewShell>
  );
};

export default CapabilitySourcesView;
