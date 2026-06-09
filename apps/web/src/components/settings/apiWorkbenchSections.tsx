import React from 'react';
import { Globe, Plus, type LucideIcon } from 'lucide-react';

import ModelLogo from '../common/ModelLogo';
import {
  SETTINGS_OVERLAY_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsSection,
} from './SettingsScaffold';

type LocalePick = (zhText: string, enText: string) => string;

type TabType = 'official' | 'third-party';

export type InfoCellTheme = {
  border?: string;
  borderHover?: string;
  bg?: string;
  bgHover?: string;
  shadowHover?: string;
  iconBorder?: string;
  iconBorderHover?: string;
  iconBg?: string;
  iconBgHover?: string;
  iconColor?: string;
  iconColorHover?: string;
  iconShadowColor?: string;
};

export const InfoCell: React.FC<{
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  theme?: InfoCellTheme;
}> = ({ label, value, helper, icon: Icon }) => (
  <div className="rounded-[18px] border p-3 text-left" style={SETTINGS_OVERLAY_STYLE}>
    <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-[var(--text-tertiary)]">
      {Icon ? <Icon size={13} /> : null}
      <span>{label}</span>
    </div>
    <div className="mt-2 text-[18px] font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{value}</div>
    {helper ? <div className="mt-1.5 text-[12px] text-[var(--text-secondary)]">{helper}</div> : null}
  </div>
);

export const PlatformAssistantEntryCard: React.FC<any> = () => null;
export const ApiWorkbenchOverviewSection: React.FC<any> = () => null;
export const ApiWorkbenchCurrentViewSection: React.FC<any> = () => null;
export const ApiWorkbenchStageSection: React.FC<any> = () => null;
export const ApiWorkbenchDiagnosticsSection: React.FC<any> = () => null;
export const ApiWorkbenchPlatformSection: React.FC<any> = () => null;
export const ApiWorkbenchCapabilitySection: React.FC<any> = () => null;
export const ApiWorkbenchOcrSection: React.FC<any> = () => null;
export const ApiWorkbenchRoutePoolSection: React.FC<any> = () => null;

export type ApiWorkbenchModelCenterRouteItem = {
  id: string;
  kind: 'official' | 'provider';
  title: string;
  subtitle: string;
  accentColor?: string;
  statusLabel: string;
  statusVariant: 'online' | 'offline' | 'warning' | 'error' | 'paused' | 'unverified';
  protocolLabel: string;
  modelCountLabel: string;
  budgetLabel: string;
  usageLabel: string;
  latencyLabel: string;
  isPaused: boolean;
  isHighlighted?: boolean;
  cardRef?: React.Ref<HTMLElement>;
  onSelect: () => void;
  onToggle: () => void;
  onRefresh: () => void;
  onDelete?: () => void;
  toggleDisabled?: boolean;
  refreshDisabled?: boolean;
  deleteDisabled?: boolean;
  refreshLoading?: boolean;
  recommendedModel?: string;
  logoName?: string;
};

export type ApiWorkbenchModelCenterPresetItem = {
  id: string;
  title: string;
  kind: 'official' | 'relay';
  kindLabel: string;
  protocolLabel: string;
  baseUrlLabel: string;
  recommendedModel: string;
  accentColor: string;
  logoName?: string;
  onApply: () => void;
};

type ApiWorkbenchModelCenterSectionProps = {
  pick: LocalePick;
  routes: ApiWorkbenchModelCenterRouteItem[];
  presets: ApiWorkbenchModelCenterPresetItem[];
  connectedSummary: string;
  autoRoutingSummary: string;
  presetTab?: 'official' | 'relay';
  onPresetTabChange?: (tab: 'official' | 'relay') => void;
  addOfficialDisabled?: boolean;
  addProviderDisabled?: boolean;
  onAddOfficial: () => void;
  onAddProvider: () => void;
};

const statusTone = (variant: ApiWorkbenchModelCenterRouteItem['statusVariant']): 'emerald' | 'amber' | 'rose' | 'slate' | 'blue' => {
  if (variant === 'online') return 'emerald';
  if (variant === 'warning' || variant === 'unverified') return 'amber';
  if (variant === 'error' || variant === 'offline') return 'rose';
  if (variant === 'paused') return 'slate';
  return 'blue';
};

const RouteCard: React.FC<{ pick: LocalePick; route: ApiWorkbenchModelCenterRouteItem }> = ({ pick, route }) => (
  <article
    ref={route.cardRef as React.Ref<HTMLDivElement>}
    className={`settings-model-center-route ${route.isHighlighted ? 'is-highlighted' : ''}`}
    onClick={route.onSelect}
    style={{ borderColor: route.accentColor || 'var(--border-light)' }}
  >
    <div className="settings-model-center-route__header">
      <div className="settings-model-center-route__logo" style={{ color: route.accentColor || 'var(--text-primary)' }}>
        {route.logoName ? <ModelLogo model={route.logoName} size={24} /> : <Globe size={22} />}
      </div>
      <div className="settings-model-center-route__copy">
        <strong>{route.title}</strong>
        <small>{route.subtitle}</small>
      </div>
      <SettingsBadge tone={statusTone(route.statusVariant)}>{route.statusLabel}</SettingsBadge>
    </div>

    <div className="settings-model-center-route__metrics">
      <InfoCell label={pick('协议', 'Protocol')} value={route.protocolLabel} />
      <InfoCell label={pick('模型', 'Models')} value={route.modelCountLabel} />
      <InfoCell label={pick('费用', 'Pricing')} value={route.budgetLabel || route.usageLabel || pick('未设置', 'Not set')} />
    </div>

    {route.recommendedModel ? (
      <div className="text-[12px] text-[var(--text-secondary)]">{pick('默认模型：', 'Default model: ')}{route.recommendedModel}</div>
    ) : null}

    <div className="settings-model-center-route__actions">
      <SettingsActionButton
        size="sm"
        disabled={route.toggleDisabled}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          route.onToggle();
        }}
      >
        {route.isPaused ? pick('启用', 'Enable') : pick('暂停', 'Pause')}
      </SettingsActionButton>
      <SettingsActionButton
        size="sm"
        disabled={route.refreshDisabled}
        loading={route.refreshLoading}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          route.onRefresh();
        }}
      >
        {pick('刷新', 'Refresh')}
      </SettingsActionButton>
    </div>
  </article>
);

const PresetCard: React.FC<{ pick: LocalePick; preset: ApiWorkbenchModelCenterPresetItem }> = ({ pick, preset }) => (
  <button type="button" className="settings-model-center-preset" onClick={preset.onApply}>
    <span className="settings-model-center-preset__dot" style={{ background: preset.accentColor }} />
    <span className="settings-model-center-preset__logo">
      {preset.logoName ? <ModelLogo model={preset.logoName} size={22} /> : <Plus size={18} />}
    </span>
    <span className="settings-model-center-preset__copy">
      <strong>{preset.title}</strong>
      <small>{preset.protocolLabel} · {preset.baseUrlLabel}</small>
      <small>{pick('默认模型：', 'Default model: ')}{preset.recommendedModel}</small>
    </span>
    <SettingsBadge tone={preset.kind === 'official' ? 'blue' : 'indigo'}>{preset.kindLabel}</SettingsBadge>
  </button>
);

export const ApiWorkbenchModelCenterSection: React.FC<ApiWorkbenchModelCenterSectionProps> = ({
  pick,
  routes,
  presets,
  connectedSummary,
  autoRoutingSummary,
  presetTab = 'official',
  onPresetTabChange,
  addOfficialDisabled = false,
  addProviderDisabled = false,
  onAddOfficial,
  onAddProvider,
}) => {
  const filteredPresets = presets.filter((preset) => presetTab === 'official' ? preset.kind === 'official' : preset.kind === 'relay');

  return (
    <SettingsSection
      testId="settings-model-center"
      title={pick('供应商配置', 'Provider settings')}
      description={pick(
        '这里只添加供应商、选择预设 API、填写地址 / Key、模型 ID 和基础价格。',
        'Add providers, choose API presets, enter base URL / key, model ID, and basic pricing only.',
      )}
      action={<SettingsBadge tone="indigo">{connectedSummary}</SettingsBadge>}
    >
      <div className="settings-model-center-layout">
        <div className="settings-model-center-pool" data-testid="api-model-center-provider-pool">
          <div className="settings-model-center-toolbar">
            <div className="settings-model-center-toolbar__copy">
              <div className="settings-model-center-toolbar__title">{pick('已添加供应商', 'Configured providers')}</div>
              <div className="settings-model-center-toolbar__helper">{autoRoutingSummary}</div>
            </div>
            <div className="settings-model-center-toolbar__actions">
              <SettingsActionButton size="sm" disabled={addOfficialDisabled} onClick={onAddOfficial}>
                {pick('添加官方', 'Add official')}
              </SettingsActionButton>
              <SettingsActionButton size="sm" disabled={addProviderDisabled} onClick={onAddProvider}>
                {pick('添加中转站', 'Add relay')}
              </SettingsActionButton>
            </div>
          </div>

          {routes.length > 0 ? (
            <div className="settings-model-center-route-list">
              {routes.map((route) => <RouteCard key={route.id} pick={pick} route={route} />)}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed p-8 text-center text-[var(--text-secondary)]" style={SETTINGS_OVERLAY_STYLE}>
              {pick('暂无供应商。请从右侧预设目录添加。', 'No providers yet. Add one from the preset directory.')}
            </div>
          )}
        </div>

        <div className="settings-model-center-presets" data-testid="api-model-center-presets">
          <div className="settings-model-center-preset-tabs">
            <button type="button" className={presetTab === 'official' ? 'is-active' : ''} onClick={() => onPresetTabChange?.('official')}>
              {pick('官方', 'Official')}
            </button>
            <button type="button" className={presetTab === 'relay' ? 'is-active' : ''} onClick={() => onPresetTabChange?.('relay')}>
              {pick('中转站', 'Relay')}
            </button>
          </div>
          <div className="settings-model-center-preset-list">
            {filteredPresets.map((preset) => <PresetCard key={preset.id} pick={pick} preset={preset} />)}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};
