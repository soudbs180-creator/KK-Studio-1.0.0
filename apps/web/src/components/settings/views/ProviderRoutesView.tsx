import React, { useState, useEffect } from 'react';
import { Split, RefreshCw, Layers3, Activity } from 'lucide-react';
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-light)] text-[var(--text-tertiary)] font-bold">
                <th className="py-2.5 px-3">{pick('任务类型', 'Task Type')}</th>
                <th className="py-2.5 px-3">{pick('模拟测试模型', 'Sample Model')}</th>
                <th className="py-2.5 px-3">{pick('默认可选路由', 'Supported Routes')}</th>
                <th className="py-2.5 px-3">{pick('当前实际流向', 'Resolved Route')}</th>
                <th className="py-2.5 px-3">{pick('路由决策原因', 'Routing Reason')}</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, i) => (
                <tr key={i} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-overlay)] transition-colors">
                  <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{r.taskName}</td>
                  <td className="py-3 px-3 font-mono text-[var(--text-secondary)]">{r.modelId}</td>
                  <td className="py-3 px-3 text-[var(--text-tertiary)]">{r.defaultRoute}</td>
                  <td className="py-3 px-3">
                    <SettingsBadge tone={getModeTone(r.actualMode)}>
                      {r.actualMode}
                    </SettingsBadge>
                  </td>
                  <td className="py-3 px-3 text-[var(--text-secondary)] max-w-xs truncate" title={r.reason}>
                    {r.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default ProviderRoutesView;
