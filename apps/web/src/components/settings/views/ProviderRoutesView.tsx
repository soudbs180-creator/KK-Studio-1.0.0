import React, { useState, useEffect } from 'react';
import { Split, RefreshCw } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsSystemField,
  SettingsHero,
  SettingsBadge,
  SettingsActionButton,
} from '../SettingsScaffold';
import { providerRouteEngine } from '../../../core/routing/ProviderRouteEngine';
import keyManager from '../../../services/auth/keyManager';
import {
  GENERATION_ROUTE_STORAGE_KEY,
  SETTINGS_QUICK_PREFERENCES_EVENT,
  type QuickGenerationRoute,
} from '../settingsQuickPreferences';
import { SettingSelect, SettingSwitchControl } from '../ui/index';

interface RouteRow {
  taskName: string;
  taskType: 'image' | 'text' | 'video' | 'batch' | 'audio';
  modelId: string;
  defaultRoute: string;
  actualMode: string;
  reason: string;
  candidateCount: number;
}

const CLOUD_FALLBACK_STORAGE_KEY = 'kk_studio_fallback_to_cloud';

const readRoutePreference = (): QuickGenerationRoute => {
  const stored = localStorage.getItem(GENERATION_ROUTE_STORAGE_KEY);
  return stored === 'local' || stored === 'cloud' || stored === 'platform' ? stored : 'auto';
};

export const ProviderRoutesView: React.FC = () => {
  const { pick } = useLocale();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [routePreference, setRoutePreference] = useState<QuickGenerationRoute>(readRoutePreference);
  const [allowCloudFallback, setAllowCloudFallback] = useState(
    () => localStorage.getItem(CLOUD_FALLBACK_STORAGE_KEY) !== 'false',
  );
  const [channels, setChannels] = useState(
    () => keyManager.getChannelConfigs({ includeDisabled: false, includeProviders: true }),
  );

  const updateRoutePreference = (value: string) => {
    const next = value as QuickGenerationRoute;
    setRoutePreference(next);
    localStorage.setItem(GENERATION_ROUTE_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(SETTINGS_QUICK_PREFERENCES_EVENT));
  };

  const updateCloudFallback = (checked: boolean) => {
    setAllowCloudFallback(checked);
    localStorage.setItem(CLOUD_FALLBACK_STORAGE_KEY, String(checked));
  };

  const loadDecisions = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const currentChannels = keyManager.getChannelConfigs({ includeDisabled: false, includeProviders: true });
      setChannels(currentChannels);
      const taskList: Array<{ name: string; type: RouteRow['taskType']; model: string; defaultPref: string }> = [
        { name: pick('图片生成', 'Image Generation'), type: 'image', model: 'flux-schnell', defaultPref: pick('自动 / 本地 / 云端 / 平台', 'Auto / Local / Cloud / Platform') },
        { name: pick('视频生成', 'Video Generation'), type: 'video', model: 'luma-dream-machine', defaultPref: pick('自动 / 云端 / 平台', 'Auto / Cloud / Platform') },
        { name: pick('文本生成 (对话)', 'Text Chat'), type: 'text', model: 'gpt-4o', defaultPref: pick('自动 / 本地 / 云端 / 平台', 'Auto / Local / Cloud / Platform') },
        { name: pick('PPT 页面生成', 'PPT Page Builder'), type: 'text', model: 'gpt-4o-mini', defaultPref: pick('自动 / 平台 / 用户 Key', 'Auto / Platform / User Key') },
        { name: pick('电商图生成 (批处理)', 'Ecommerce batch'), type: 'image', model: 'flux-dev', defaultPref: pick('自动 / 本地 / 平台', 'Auto / Local / Platform') },
        { name: pick('音频生成', 'Audio Generation'), type: 'audio', model: 'suno-v3', defaultPref: pick('自动 / 平台', 'Auto / Platform') },
      ];

      const resolved = await Promise.all(
        taskList.map(async (task) => {
          const decision = await providerRouteEngine.decideRoute({
            modelId: task.model,
            taskType: task.type,
          });
          const candidateCount = currentChannels.filter((channel) => {
            const supportsTask = task.type === 'image'
              ? channel.capabilities.image
              : task.type === 'video'
                ? channel.capabilities.video
                : task.type === 'audio'
                  ? channel.capabilities.audio
                  : channel.capabilities.chat;
            const supportsModel = channel.supportedModels.length === 0
              || channel.supportedModels.includes('*')
              || channel.supportedModels.some((model) => model.split(':')[0] === task.model);
            return supportsTask && supportsModel;
          }).length;
          return {
            taskName: task.name,
            taskType: task.type,
            modelId: task.model,
            defaultRoute: task.defaultPref,
            actualMode: decision.mode,
            reason: decision.reason || pick('策略默认匹配', 'Matched default policy'),
            candidateCount,
          };
        })
      );
      setRoutes(resolved);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : pick('无法计算路由决策。', 'Unable to resolve routes.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDecisions();
  }, []);

  useEffect(() => keyManager.subscribe(() => void loadDecisions()), []);

  const getModeTone = (mode: string) => {
    if (mode.includes('local')) return 'indigo';
    if (mode.includes('cloud')) return 'emerald';
    if (mode.includes('platform')) return 'sky';
    return 'neutral';
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        title={pick('Provider 路由策略', 'Provider Routes')}
        eyebrow="Task Dispatch"
        description={pick(
          '高级分发矩阵。展示不同任务类型的路由流向和当前 ProviderRouteEngine 的即时分发决策。',
          'Matrix of dispatch policies per media task. View real-time routing decisions.'
        )}
        icon={Split}
        tone="sky"
        actions={
          <SettingsActionButton icon={RefreshCw} loading={loading} onClick={loadDecisions}>
            {pick('刷新决策', 'Refresh Decisions')}
          </SettingsActionButton>
        }
      />

      <SettingsSection
        title={pick('调度策略', 'Dispatch Policy')}
        description={pick(
          '这里直接修改 ProviderRouteEngine 使用的运行偏好。CLIProxyAPI 负责本机账号和模型目录，RouteEngine 负责按任务、健康和预算做最终选择。',
          'These controls feed ProviderRouteEngine directly. CLIProxyAPI owns local accounts and model catalog data; RouteEngine makes the final task, health, and budget decision.',
        )}
      >
        <div className="settings-route-policy-grid">
          <SettingsSystemField
            label={pick('默认执行位置', 'Preferred execution')}
            value={routePreference}
            description={pick('自动模式：桌面本地优先，手机云端优先；手机本地表示已配对电脑。', 'Auto prefers local on desktop and cloud on mobile; mobile local means a paired desktop.')}
          >
            <SettingSelect
              value={routePreference}
              onChange={updateRoutePreference}
              options={[
                { value: 'auto', label: pick('自动', 'Auto') },
                { value: 'local', label: pick('本地 / 配对电脑', 'Local / paired desktop') },
                { value: 'cloud', label: pick('云端', 'Cloud') },
                { value: 'platform', label: pick('平台积分', 'Platform credits') },
              ]}
            />
          </SettingsSystemField>
          <SettingsSystemField
            label={pick('允许云端回退', 'Allow cloud fallback')}
            value={allowCloudFallback ? pick('开启', 'On') : pick('关闭', 'Off')}
            description={pick('只在新 Quote 中选择下一条健康连接；已签发 Quote 不会静默换供应商。', 'Only a new Quote may choose the next healthy connection; an issued Quote never switches silently.')}
          >
            <SettingSwitchControl
              checked={allowCloudFallback}
              onChange={updateCloudFallback}
              label={pick('切换云端回退', 'Toggle cloud fallback')}
            />
          </SettingsSystemField>
        </div>
        <div className="settings-route-summary-grid">
          <span><strong>{channels.length}</strong>{pick('可用通道', 'Available channels')}</span>
          <span><strong>{channels.filter((channel) => channel.capabilities.modelDiscovery).length}</strong>{pick('模型目录', 'Model catalogs')}</span>
          <span><strong>{channels.filter((channel) => channel.capabilities.image).length}</strong>{pick('图片能力', 'Image capable')}</span>
          <span><strong>{channels.filter((channel) => channel.capabilities.video).length}</strong>{pick('视频能力', 'Video capable')}</span>
        </div>
      </SettingsSection>

      <SettingsSection title={pick('路由决策矩阵', 'Routing Matrix')}>
        {loadError ? <div className="settings-route-matrix__error" role="alert">{loadError}</div> : null}
        {routes.length > 0 ? (
          <div className="settings-route-matrix">
            <table className="settings-route-matrix__table">
              <thead>
                <tr>
                  <th>{pick('任务类型', 'Task Type')}</th>
                  <th>{pick('模拟测试模型', 'Sample Model')}</th>
                  <th>{pick('默认可选路由', 'Supported Routes')}</th>
                  <th>{pick('当前实际流向', 'Resolved Route')}</th>
                  <th>{pick('候选通道', 'Candidates')}</th>
                  <th>{pick('路由决策原因', 'Routing Reason')}</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <tr key={`${route.taskType}-${route.modelId}`}>
                    <td
                      className="settings-route-matrix__task"
                      data-label={pick('任务类型', 'Task Type')}
                    >
                      {route.taskName}
                    </td>
                    <td
                      className="settings-route-matrix__model"
                      data-label={pick('模拟测试模型', 'Sample Model')}
                    >
                      {route.modelId}
                    </td>
                    <td
                      className="settings-route-matrix__supported"
                      data-label={pick('默认可选路由', 'Supported Routes')}
                    >
                      {route.defaultRoute}
                    </td>
                    <td
                      className="settings-route-matrix__resolved"
                      data-label={pick('当前实际流向', 'Resolved Route')}
                    >
                      <SettingsBadge tone={getModeTone(route.actualMode)}>
                        {route.actualMode}
                      </SettingsBadge>
                    </td>
                    <td data-label={pick('候选通道', 'Candidates')}>
                      {route.candidateCount}
                    </td>
                    <td
                      className="settings-route-matrix__reason"
                      data-label={pick('路由决策原因', 'Routing Reason')}
                      title={route.reason}
                    >
                      {route.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="settings-route-matrix__empty" role="status">
            {loading
              ? pick('正在计算当前路由决策…', 'Resolving current routes…')
              : pick('暂时没有可展示的路由决策。', 'No routing decisions are available yet.')}
          </div>
        )}
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default ProviderRoutesView;
