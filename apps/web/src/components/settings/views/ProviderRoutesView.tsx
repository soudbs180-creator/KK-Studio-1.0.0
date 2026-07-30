import React, { useState, useEffect } from 'react';
import { Split, RefreshCw } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsHero,
  SettingsBadge,
  SettingsActionButton,
} from '../SettingsScaffold';
import { providerRouteEngine } from '../../../core/routing/ProviderRouteEngine';

interface RouteRow {
  taskName: string;
  taskType: 'image' | 'text' | 'video' | 'batch' | 'audio';
  modelId: string;
  defaultRoute: string;
  actualMode: string;
  reason: string;
}

export const ProviderRoutesView: React.FC = () => {
  const { pick } = useLocale();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDecisions = async () => {
    setLoading(true);
    try {
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
          return {
            taskName: task.name,
            taskType: task.type,
            modelId: task.model,
            defaultRoute: task.defaultPref,
            actualMode: decision.mode,
            reason: decision.reason || pick('策略默认匹配', 'Matched default policy'),
          };
        })
      );
      setRoutes(resolved);
    } catch (err) {
      console.error('Failed to load routing decisions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecisions();
  }, []);

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

      <SettingsSection title={pick('路由决策矩阵', 'Routing Matrix')}>
        {routes.length > 0 ? (
          <div className="settings-route-matrix">
            <table className="settings-route-matrix__table">
              <thead>
                <tr>
                  <th>{pick('任务类型', 'Task Type')}</th>
                  <th>{pick('模拟测试模型', 'Sample Model')}</th>
                  <th>{pick('默认可选路由', 'Supported Routes')}</th>
                  <th>{pick('当前实际流向', 'Resolved Route')}</th>
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
