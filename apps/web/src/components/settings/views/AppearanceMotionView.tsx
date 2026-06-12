import React, { useMemo } from 'react';
import { Eye, Layers3, Palette, RotateCcw, Sparkles, Zap } from 'lucide-react';

import { useAppearanceMotion } from '../../../context/AppearanceMotionContext';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsSystemCard,
  SettingsSystemField,
  SettingsViewShell,
  SETTINGS_GLASS_SURFACE_CLASSNAME,
  SETTINGS_PAGE_CONTAINER_CLASSNAME,
  SETTINGS_RESPONSIVE_GRID_CLASSNAME,
} from '../SettingsScaffold';
import {
  getSettingsStatusSummaryLabel,
  getSettingsViewMeta,
} from '../settingsRegistry';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const ToggleSwitch: React.FC<{
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}> = ({ checked, label, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className="settings-system-switch"
    data-state={checked ? 'on' : 'off'}
    onClick={() => onChange(!checked)}
  />
);

const AppearanceMotionView: React.FC = () => {
  const { locale, pick } = useLocale();
  const {
    preferences,
    systemReducedMotion,
    setPreferences,
    resetPreferences,
  } = useAppearanceMotion();

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
            <ToggleSwitch
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
          title={pick('系统预览', 'System Preview')}
          description={pick('这里展示同一套 token 在设置页卡片、浮层和字段上的效果。', 'Shows the same tokens across settings cards, overlays, and fields.')}
          icon={Eye}
          tone="indigo"
        >
          <div className="settings-system-preview-stage">
            <div className={`${SETTINGS_GLASS_SURFACE_CLASSNAME} settings-system-preview-card`}>
              <div className="settings-system-preview-title">
                {pick('导航与浮层会使用这套玻璃变量', 'Navigation and overlays use this glass contract')}
              </div>
              <p className="settings-system-preview-copy">
                {pick('新增设置页时优先组合 SettingsSystemCard、SettingsSystemField 和 semantic token。', 'New settings pages should compose SettingsSystemCard, SettingsSystemField, and semantic tokens first.')}
              </p>
            </div>
            <div className="settings-system-preview-card">
              <div className="settings-system-preview-title">
                {pick('正文内容保持更高实体度', 'Reading areas stay more solid')}
              </div>
              <p className="settings-system-preview-copy">
                {pick('动态和透明度只服务层级表达，不能牺牲可读性、触控尺寸和键盘可达性。', 'Motion and transparency serve hierarchy only; readability, touch targets, and keyboard access stay mandatory.')}
              </p>
            </div>
          </div>
        </SettingsSystemCard>

        <SettingsSystemCard
          className="settings-system-card--wide"
          title={pick('新增页面规则', 'Rules for New Pages')}
          description={pick('后续设置页优先复用这里的系统原语，减少硬编码样式造成的视觉和响应式 bug。', 'Future settings pages should reuse these primitives to reduce hard-coded visual and responsive bugs.')}
          icon={Sparkles}
          tone="amber"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <SettingsBadge tone="indigo">{pick('断点统一', 'Unified breakpoints')}</SettingsBadge>
            <SettingsBadge tone="emerald">{pick('44px 触控下限', '44px touch floor')}</SettingsBadge>
            <SettingsBadge tone="amber">{pick('减少动态可用', 'Reduced motion ready')}</SettingsBadge>
          </div>
        </SettingsSystemCard>
      </div>
    </SettingsViewShell>
  );
};

export default AppearanceMotionView;
