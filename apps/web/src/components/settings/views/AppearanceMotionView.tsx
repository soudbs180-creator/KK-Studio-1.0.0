import React, { useMemo, useState } from 'react';
import { CircleGauge, Gauge, Layers3, Palette, RotateCcw, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useAppearanceMotion, type WebPerformanceMode } from '../../../context/AppearanceMotionContext';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsSystemCard,
  SettingsSystemField,
  SettingsViewShell,
  SETTINGS_PAGE_CONTAINER_CLASSNAME,
  SETTINGS_RESPONSIVE_GRID_CLASSNAME,
} from '../SettingsScaffold';
import {
  getSettingsStatusSummaryLabel,
  getSettingsViewMeta,
} from '../settingsRegistry';
import {
  applyPerformancePreset,
  CANVAS_PERFORMANCE_STORAGE_KEY,
  getActivePerformancePreset,
  readCanvasPerformanceMode,
  SETTINGS_QUICK_PREFERENCES_EVENT,
} from '../settingsQuickPreferences';
import { SettingSelect, SettingSwitchControl } from '../ui/index';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const AppearanceMotionView: React.FC = () => {
  const { locale, pick } = useLocale();
  const navigate = useNavigate();
  const {
    preferences,
    systemReducedMotion,
    setPreferences,
    resetPreferences,
  } = useAppearanceMotion();
  const [canvasPerformanceMode, setCanvasPerformanceMode] = useState(readCanvasPerformanceMode);

  const registryLanguage = locale.startsWith('zh') ? 'zh-CN' : 'en-US';
  const viewMeta = useMemo(
    () => getSettingsViewMeta('appearance-motion', registryLanguage),
    [registryLanguage],
  );
  const statusLabel = useMemo(
    () => getSettingsStatusSummaryLabel('appearance-motion', registryLanguage),
    [registryLanguage],
  );

  const motionLabel = systemReducedMotion
    ? pick('系统减少动态中', 'System reduced motion')
    : preferences.motionScale >= 1.1
      ? pick('前沿动态', 'Expressive')
      : preferences.motionScale <= 0.35
        ? pick('低动态', 'Low motion')
        : pick('标准动态', 'Standard motion');
  const performanceModes: Array<{
    id: WebPerformanceMode;
    label: string;
    description: string;
  }> = [
    {
      id: 'fast',
      label: pick('快速', 'Fast'),
      description: pick('减少模糊与转场', 'Less blur and motion'),
    },
    {
      id: 'balanced',
      label: pick('均衡', 'Balanced'),
      description: pick('平衡流畅与质感', 'Balanced experience'),
    },
    {
      id: 'visual',
      label: pick('高质量', 'High quality'),
      description: pick('启用完整特效与画质', 'Full effects and quality'),
    },
  ];
  const activePerformancePreset = getActivePerformancePreset(preferences, readCanvasPerformanceMode());
  const selectPerformanceMode = (mode: WebPerformanceMode) => applyPerformancePreset(mode, setPreferences);
  const selectCanvasPerformanceMode = (mode: string) => {
    window.localStorage.setItem(CANVAS_PERFORMANCE_STORAGE_KEY, mode);
    setCanvasPerformanceMode(mode);
    window.dispatchEvent(new CustomEvent(SETTINGS_QUICK_PREFERENCES_EVENT));
  };
  const canvasPerformanceLabel = {
    auto: pick('自动调节', 'Auto'),
    quality: pick('质量优先', 'Quality'),
    smooth: pick('流畅优先', 'Smooth'),
    ghost: pick('极限模式', 'Ghost'),
  }[canvasPerformanceMode] || pick('手动', 'Manual');

  return (
    <SettingsViewShell className={SETTINGS_PAGE_CONTAINER_CLASSNAME}>
      <SettingsHero
        eyebrow={viewMeta.eyebrow}
        title={viewMeta.title}
        icon={Palette}
        tone="indigo"
        badge={<SettingsBadge tone={systemReducedMotion ? 'amber' : 'indigo'}>{statusLabel}</SettingsBadge>}
        description={viewMeta.description}
        actions={(
          <SettingsActionButton icon={RotateCcw} onClick={resetPreferences}>
            {pick('恢复系统默认', 'Reset defaults')}
          </SettingsActionButton>
        )}
      />

      <div className={SETTINGS_RESPONSIVE_GRID_CLASSNAME}>
        <SettingsSystemCard
          className="settings-system-card--wide"
          title={pick('网页性能', 'Web Performance')}
          description={pick('统一调整页面动效、玻璃模糊与转场开销。', 'Tune motion, glass blur, and transition cost together.')}
          icon={CircleGauge}
          tone="emerald"
          action={(
            <SettingsBadge tone="emerald">
              {systemReducedMotion
                ? pick('跟随系统减少动态', 'System reduced motion')
                : activePerformancePreset === 'manual'
                  ? pick('手动', 'Manual')
                  : performanceModes.find((mode) => mode.id === activePerformancePreset)?.label}
            </SettingsBadge>
          )}
        >
          <div
            className="settings-performance-mode-control"
            role="radiogroup"
            aria-label={pick('网页性能模式', 'Web performance mode')}
          >
            {performanceModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={activePerformancePreset === mode.id}
                data-state={activePerformancePreset === mode.id ? 'selected' : 'idle'}
                className="settings-performance-mode-option"
                onClick={() => selectPerformanceMode(mode.id)}
              >
                <strong>{mode.label}</strong>
                <span>{mode.description}</span>
              </button>
            ))}
          </div>
        </SettingsSystemCard>

        <SettingsSystemCard
          title={pick('毛玻璃层级', 'Glass Layers')}
          description={pick('控制导航、工具栏和浮层的透明与模糊，不影响正文阅读区域。', 'Controls glass on navigation, toolbars, and floating layers without weakening reading areas.')}
          icon={Layers3}
          tone="sky"
        >
          <SettingsSystemField
            htmlFor="appearance-glass-opacity"
            label={pick('透明度', 'Opacity')}
            value={formatPercent(preferences.glassOpacity)}
            description={pick('越高越实，越低越轻。移动端会保持可读性下限。', 'Higher is more solid; lower is lighter. Mobile keeps a readability floor.')}
          >
            <input
              id="appearance-glass-opacity"
              type="range"
              min="0.58"
              max="0.94"
              step="0.02"
              value={preferences.glassOpacity}
              className="settings-system-slider"
              onChange={(event) => setPreferences({ glassOpacity: Number(event.target.value) })}
            />
          </SettingsSystemField>

          <SettingsSystemField
            htmlFor="appearance-glass-blur"
            label={pick('模糊强度', 'Blur')}
            value={`${preferences.glassBlur}px`}
            description={pick('用于浮层景深和前后层分离，低性能设备可适当降低。', 'Creates depth for overlays and layer separation; lower it on weaker devices.')}
          >
            <input
              id="appearance-glass-blur"
              type="range"
              min="0"
              max="32"
              step="2"
              value={preferences.glassBlur}
              className="settings-system-slider"
              onChange={(event) => setPreferences({ glassBlur: Number(event.target.value) })}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('实体回退', 'Solid fallback')}
            value={preferences.solidFallback ? pick('开启', 'On') : pick('关闭', 'Off')}
            description={pick('在投屏、低透明度偏好或复杂背景下使用实体表面。', 'Uses solid surfaces for projection, low-transparency preference, or busy backgrounds.')}
          >
            <SettingSwitchControl
              checked={preferences.solidFallback}
              label={pick('切换实体回退', 'Toggle solid fallback')}
              onChange={(checked) => setPreferences({ solidFallback: checked })}
            />
          </SettingsSystemField>
        </SettingsSystemCard>

        <SettingsSystemCard
          title={pick('动态节奏', 'Motion Rhythm')}
          description={pick('统一控制 hover、切换和面板转场的动态强度。', 'Controls hover, toggles, and panel transition intensity globally.')}
          icon={Zap}
          tone="emerald"
        >
          <SettingsSystemField
            htmlFor="appearance-motion-scale"
            label={pick('动态强度', 'Motion intensity')}
            value={motionLabel}
            description={pick('系统减少动态开启时会自动降级，不覆盖用户系统偏好。', 'Automatically lowers when system reduced motion is enabled.')}
          >
            <input
              id="appearance-motion-scale"
              type="range"
              min="0.2"
              max="1.2"
              step="0.05"
              value={preferences.motionScale}
              className="settings-system-slider"
              onChange={(event) => setPreferences({ motionScale: Number(event.target.value) })}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('系统动态偏好', 'System motion')}
            value={systemReducedMotion ? pick('已减少', 'Reduced') : pick('标准', 'Standard')}
            description={pick('遵循操作系统辅助功能设置，避免强行动画。', 'Follows OS accessibility settings and avoids forced animation.')}
          >
            <SettingsBadge tone={systemReducedMotion ? 'amber' : 'emerald'}>
              {systemReducedMotion ? pick('跟随系统', 'Following system') : pick('可用', 'Available')}
            </SettingsBadge>
          </SettingsSystemField>
        </SettingsSystemCard>

        <SettingsSystemCard
          className="settings-system-card--wide"
          title={pick('画布性能', 'Canvas Performance')}
          description={pick('把无限画布的渲染策略纳入同一体验档位；单独修改后总览会显示手动。', 'Keep canvas rendering in the same experience preset; custom changes appear as Manual on overview.')}
          icon={Gauge}
          tone="sky"
          action={<SettingsBadge tone={activePerformancePreset === 'manual' ? 'amber' : 'emerald'}>{canvasPerformanceLabel}</SettingsBadge>}
        >
          <SettingsSystemField
            label={pick('画布渲染策略', 'Canvas rendering')}
            value={canvasPerformanceLabel}
            description={pick('自动、质量、流畅和极限模式会影响大画布卡片、连接线与缩略图渲染。', 'Controls cards, connectors, and thumbnail rendering on large canvases.')}
          >
            <SettingSelect
              value={canvasPerformanceMode}
              onChange={selectCanvasPerformanceMode}
              options={[
                { label: pick('自动调节', 'Auto'), value: 'auto' },
                { label: pick('质量优先', 'Quality'), value: 'quality' },
                { label: pick('流畅优先', 'Smooth'), value: 'smooth' },
                { label: pick('极限模式', 'Ghost'), value: 'ghost' },
              ]}
            />
          </SettingsSystemField>
                    <div className="settings-system-card-footer-actions">
            <SettingsActionButton icon={Gauge} tone="secondary" onClick={() => navigate('/settings/canvas-performance')}>
              {pick('高级画布细节', 'Advanced canvas details')}
            </SettingsActionButton>
          </div>
        </SettingsSystemCard>

      </div>
    </SettingsViewShell>
  );
};

export default AppearanceMotionView;
