import React, { useState } from 'react';
import { Gauge, HelpCircle } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsSystemField,
  SettingsHero,
  SettingsBadge,
} from '../SettingsScaffold';
import { SettingSelect } from '../ui/index';

export const CanvasPerformanceView: React.FC = () => {
  const { pick } = useLocale();

  const [perfMode, setPerfMode] = useState<'auto' | 'quality' | 'smooth' | 'ghost'>(() => {
    const val = localStorage.getItem('kk_studio_canvas_perf_mode');
    return (val === 'quality' || val === 'smooth' || val === 'ghost') ? val : 'auto';
  });

  const [viewportCulling, setViewportCulling] = useState(() => {
    return localStorage.getItem('kk_studio_perf_viewport_culling') !== 'false';
  });

  const [dragSuspend, setDragSuspend] = useState(() => {
    return localStorage.getItem('kk_studio_perf_drag_suspend') !== 'false';
  });

  const [zoomReduceMotion, setZoomReduceMotion] = useState(() => {
    return localStorage.getItem('kk_studio_perf_zoom_reduce_motion') !== 'false';
  });

  const [connectorThrottle, setConnectorThrottle] = useState(() => {
    return localStorage.getItem('kk_studio_perf_connector_throttle') !== 'false';
  });

  const [lazyLoad, setLazyLoad] = useState(() => {
    return localStorage.getItem('kk_studio_perf_lazy_load') !== 'false';
  });

  const [delayDecode, setDelayDecode] = useState(() => {
    return localStorage.getItem('kk_studio_perf_delay_decode') !== 'false';
  });

  const handlePerfModeChange = (mode: 'auto' | 'quality' | 'smooth' | 'ghost') => {
    setPerfMode(mode);
    localStorage.setItem('kk_studio_canvas_perf_mode', mode);
  };

  const handleOptionChange = (key: string, val: boolean, setter: (v: boolean) => void) => {
    setter(val);
    localStorage.setItem(key, String(val));
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        title={pick('画布性能', 'Canvas Performance')}
        eyebrow="Canvas Optimization"
        description={pick(
          '控制无限画布的优化渲染策略。在大画布上操作上千张图片或 Prompt 卡片时，通过分级加载与降级动效以保障顺滑流畅度。',
          'Optimize canvas rendering, level of detail, and motion transitions.'
        )}
        icon={Gauge}
        tone="sky"
      />

      <SettingsSection title={pick('性能模式', 'Performance Mode')}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div
            onClick={() => handlePerfModeChange('auto')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              perfMode === 'auto'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-xs">{pick('自动调节', 'Auto')}</div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">{pick('根据节点数量和当前缩放等级动态判断画质。', 'Dynamic adjustment.')}</p>
          </div>

          <div
            onClick={() => handlePerfModeChange('quality')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              perfMode === 'quality'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-xs">{pick('质量优先', 'Quality')}</div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">{pick('强制完整卡片（Full Card），保留动效和完整阴影。', 'Always Full Card.')}</p>
          </div>

          <div
            onClick={() => handlePerfModeChange('smooth')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              perfMode === 'smooth'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-xs">{pick('流畅优先', 'Balanced')}</div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">{pick('适当降低连接线质量，略微简化卡片阴影与文字。', 'Reduce effects slightly.')}</p>
          </div>

          <div
            onClick={() => handlePerfModeChange('ghost')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              perfMode === 'ghost'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-xs">{pick('极限模式', 'Ghost Mode')}</div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">{pick('在大节点堆积时仅以骨架占位色块显示卡片。', 'Skeleton tiles only.')}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={pick('高级优化细节 (手术刀优化项)', 'Fine-grained Performance Policies')}>
        <div className="space-y-4">
          <SettingsSystemField
            label={pick('视口虚拟化 (视口外卡片不渲染)', 'Viewport Culling')}
            description={pick(
              '完全不渲染视野外的卡片 DOM 节点，以支持十万量级节点的内存负载。',
              'Unmount canvas card nodes that are completely outside the visible viewport.'
            )}
          >
            <SettingSelect
              value={viewportCulling ? 'enabled' : 'disabled'}
              onChange={(v) => handleOptionChange('kk_studio_perf_viewport_culling', v === 'enabled', setViewportCulling)}
              options={[
                { label: pick('启用虚拟化', 'Enabled'), value: 'enabled' },
                { label: pick('渲染全部 DOM', 'Disabled'), value: 'disabled' },
              ]}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('拖动中暂停测量', 'Suspend Layout Measurement during Dragging')}
            description={pick(
              '拖拽移动卡片或画布时，暂停全局 ResizeObserver 的自适应大小计算，极度降低重排负荷。',
              'Do not trigger ResizeObserver layout passes during dragging interaction.'
            )}
          >
            <SettingSelect
              value={dragSuspend ? 'enabled' : 'disabled'}
              onChange={(v) => handleOptionChange('kk_studio_perf_drag_suspend', v === 'enabled', setDragSuspend)}
              options={[
                { label: pick('暂停计算', 'Enabled'), value: 'enabled' },
                { label: pick('保持计算 (可能卡顿)', 'Disabled'), value: 'disabled' },
              ]}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('缩放中降低动画与效果', 'Reduce Motion during Zooming')}
            description={pick(
              '在滑轮缩放或手势变焦时，临时剔除毛玻璃、文字软化、以及变焦卡片的 box-shadow 软渲染。',
              'Temporarily lower transitions and box-shadow during scaling operations.'
            )}
          >
            <SettingSelect
              value={zoomReduceMotion ? 'enabled' : 'disabled'}
              onChange={(v) => handleOptionChange('kk_studio_perf_zoom_reduce_motion', v === 'enabled', setZoomReduceMotion)}
              options={[
                { label: pick('降低效果', 'Enabled'), value: 'enabled' },
                { label: pick('全程渲染', 'Disabled'), value: 'disabled' },
              ]}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('连接线逻辑节流', 'Connector Render Throttling')}
            description={pick(
              '对卡片间的引线连接关系计算进行 scheduler 节流限制，避免重绘阻塞。',
              'Throttle soft connector math routing using CanvasConnectorScheduler.'
            )}
          >
            <SettingSelect
              value={connectorThrottle ? 'enabled' : 'disabled'}
              onChange={(v) => handleOptionChange('kk_studio_perf_connector_throttle', v === 'enabled', setConnectorThrottle)}
              options={[
                { label: pick('节流计算', 'Enabled'), value: 'enabled' },
                { label: pick('同步计算', 'Disabled'), value: 'disabled' },
              ]}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('图片预览懒加载', 'Image Preview Lazy Loading')}
            description={pick(
              '只有卡片滚动到视口内时才拉取并显示对应的低清缩略图，省流提速。',
              'Lazy load images to prevent network flooding and DOM decodes.'
            )}
          >
            <SettingSelect
              value={lazyLoad ? 'enabled' : 'disabled'}
              onChange={(v) => handleOptionChange('kk_studio_perf_lazy_load', v === 'enabled', setLazyLoad)}
              options={[
                { label: pick('开启懒加载', 'Enabled'), value: 'enabled' },
                { label: pick('立即加载', 'Disabled'), value: 'disabled' },
              ]}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('大图延迟解码', 'Delayed Large Image Decoding')}
            description={pick(
              '对近距离原图（Original/Preview Quality）启用 decoding="async"，延迟解析直到图片完全滑入核心视点。',
              'Use async decoding policy for high-res original imagery assets.'
            )}
          >
            <SettingSelect
              value={delayDecode ? 'enabled' : 'disabled'}
              onChange={(v) => handleOptionChange('kk_studio_perf_delay_decode', v === 'enabled', setDelayDecode)}
              options={[
                { label: pick('延迟解码', 'Enabled'), value: 'enabled' },
                { label: pick('立即同步解码', 'Disabled'), value: 'disabled' },
              ]}
            />
          </SettingsSystemField>
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default CanvasPerformanceView;
