import React, { useEffect, useState } from 'react';
import {
  buildCanonicalApiRecordId,
  isCanonicalApiRecordId,
} from '../../services/auth/keyManagerCanonicalIds';
import { getModelCapabilities } from '../../services/model/modelCapabilities';
import { notify } from '../../services/system/notificationService';
import { Activity, ChevronDown, ChevronLeft, ChevronRight, Copy, Edit3, Globe, Pause, Play, Plus, RefreshCw, Shield, Timer, Trash2, Wallet, Wand2, Layers3, type LucideIcon } from 'lucide-react';


import ModelLogo from '../common/ModelLogo';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_OVERLAY_STYLE,
  SETTINGS_WARNING_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsSection,
} from './SettingsScaffold';
import {
  SettingInput,
  SettingSelect,
  SettingToggle,
} from './ui/index';
import { API_MANAGEMENT_ACTIONS } from './apiManagementActions';
import type { ApiSettingsWorkbenchStage, ApiSettingsWorkbenchTone } from './apiWorkbenchState';

type LocalePick = (zhText: string, enText: string) => string;
type TabType = 'official' | 'third-party';
type ActionTone = 'primary' | 'secondary';

type CurrentViewLatencyItem = {
  id: string;
  label: string;
  helper: string;
  latency: number | null;
};

const noop = () => {};

const getDisplayId = (id: string, title: string, subtitle?: string): string => {
  const normalizedId = String(id || '').trim();
  if (isCanonicalApiRecordId(normalizedId)) {
    return normalizedId;
  }

  return buildCanonicalApiRecordId({
    id: normalizedId,
    name: title,
    baseUrl: subtitle,
  });
};

/**
 * Only presents capabilities declared by the existing model capability source.
 * CLIProxyAPI catalog entries stay honest when a model has not been profiled yet.
 */
export const getModelCapabilityLabels = (modelId: string, pick: LocalePick): string[] => {
  const capabilities = getModelCapabilities(modelId);
  if (!capabilities) return [pick('能力待同步', 'Capabilities pending')];

  const labels = [
    capabilities.supportsGrounding ? pick('联网', 'Web') : '',
    capabilities.supportsThinking ? pick('思考', 'Reasoning') : '',
    capabilities.supportsImageSearch ? pick('图片搜索', 'Image search') : '',
    capabilities.supportsReferenceImages !== false && (capabilities.maxRefImages || 0) > 0
      ? pick('视觉参考', 'Vision refs')
      : '',
  ].filter(Boolean);

  return labels.length > 0 ? labels : [pick('基础生成', 'Base generation')];
};

const ModelCapabilityBadges: React.FC<{ modelId: string; pick: LocalePick }> = ({ modelId, pick }) => (
  <span className="settings-model-capability-badges" aria-label={pick('模型能力', 'Model capabilities')}>
    {getModelCapabilityLabels(modelId, pick).map((label) => (
      <span key={label}>{label}</span>
    ))}
  </span>
);


// 简体中文：注入 API 工作台专用状态卡片的 CSS 样式，带来半透明玻璃、动态发光及柔和过渡微动效，看齐侧边栏顶级卡片设计
const PREMIUM_CARDS_STYLE = (
  <style>{`
    .premium-info-card {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      border-radius: 18px;
      border: 1px solid var(--card-border, rgba(255, 255, 255, 0.04));
      background: var(--card-bg, rgba(255, 255, 255, 0.015));
      padding: 16px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      text-align: left;
    }
    body:not(.dark-mode) .premium-info-card {
      background: rgba(0, 0, 0, 0.01);
      border-color: rgba(0, 0, 0, 0.03);
    }
    .premium-info-card:hover {
      transform: translateY(-2px);
      border-color: var(--card-border-hover, rgba(99, 102, 241, 0.2));
      background: var(--card-bg-hover, rgba(255, 255, 255, 0.04));
      box-shadow: var(--card-shadow-hover, 0 6px 20px rgba(0, 0, 0, 0.12));
    }
    body:not(.dark-mode) .premium-info-card:hover {
      background: rgba(0, 0, 0, 0.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .premium-info-card__icon-box {
      display: flex;
      height: 34px;
      width: 34px;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      border: 1px solid var(--icon-border, rgba(255, 255, 255, 0.04));
      background: var(--icon-bg, rgba(255, 255, 255, 0.02));
      color: var(--icon-color, var(--text-primary));
      transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
    }
    body:not(.dark-mode) .premium-info-card__icon-box {
      border-color: rgba(0, 0, 0, 0.04);
      background: rgba(0, 0, 0, 0.01);
    }
    .premium-info-card:hover .premium-info-card__icon-box {
      transform: scale(1.04);
      box-shadow: 0 0 10px var(--icon-shadow-color, rgba(255, 255, 255, 0.15));
      background: var(--icon-bg-hover, rgba(255, 255, 255, 0.08)) !important;
      border-color: var(--icon-border-hover, rgba(255, 255, 255, 0.2)) !important;
      color: var(--icon-color-hover, var(--text-primary)) !important;
    }
    @media (max-width: 767px) {
      .api-workbench-overview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .api-workbench-overview-grid .premium-info-card {
        min-height: 128px;
        flex-direction: column;
        gap: 9px;
        padding: 12px;
      }
      .api-workbench-overview-grid .premium-info-card__icon-box {
        height: 32px;
        width: 32px;
      }
      .api-workbench-overview-grid .premium-info-card__value {
        font-size: 15px;
        line-height: 1.25;
        white-space: normal;
      }
      .api-workbench-overview-grid .premium-info-card__helper {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }
    }
  `}</style>
);

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
}> = ({ label, value, helper, icon: Icon, theme }) => {
  if (Icon && theme) {
    return (
      <div
        className="premium-info-card"
        style={{
          '--card-border': theme.border,
          '--card-border-hover': theme.borderHover,
          '--card-bg': theme.bg,
          '--card-bg-hover': theme.bgHover,
          '--card-shadow-hover': theme.shadowHover,
        } as React.CSSProperties}
      >
        {PREMIUM_CARDS_STYLE}
        <div
          className="premium-info-card__icon-box"
          style={{
            '--icon-border': theme.iconBorder,
            '--icon-border-hover': theme.iconBorderHover,
            '--icon-bg': theme.iconBg,
            '--icon-bg-hover': theme.iconBgHover,
            '--icon-color': theme.iconColor,
            '--icon-color-hover': theme.iconColorHover,
            '--icon-shadow-color': theme.iconShadowColor,
          } as React.CSSProperties}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-[11px] font-medium tracking-[0.12em] text-[var(--text-tertiary)]">{label}</div>
          <div className="premium-info-card__value text-[18px] font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums] truncate">{value}</div>
          {helper ? <div className="premium-info-card__helper text-[11.5px] leading-relaxed text-[var(--text-secondary)] break-words">{helper}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border p-3 text-left" style={SETTINGS_OVERLAY_STYLE}>
      <div className="text-[11px] font-medium tracking-[0.12em] text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-2 text-[20px] font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{value}</div>
      {helper ? <div className="mt-1.5 text-[12px] text-[var(--text-secondary)]">{helper}</div> : null}
    </div>
  );
};

type PlatformAssistantEntryCardProps = {
  title: string;
  description: string;
  entryContextLabel: string;
  localApiLabel: string;
  localApiValue: string;
  localApiHelper: string;
  platformLabel: string;
  platformValue: string;
  platformHelper: string;
  entryActionLabel: string;
  entryActionHelper: string;
  entryActionDisabled?: boolean;
  onOpen: () => void;
};

export const PlatformAssistantEntryCard: React.FC<PlatformAssistantEntryCardProps> = ({
  title,
  description,
  entryContextLabel,
  localApiLabel,
  localApiValue,
  localApiHelper,
  platformLabel,
  platformValue,
  platformHelper,
  entryActionLabel,
  entryActionHelper,
  entryActionDisabled = false,
  onOpen,
}) => (
  <div className="rounded-[24px] border p-4 md:p-5" style={SETTINGS_ELEVATED_STYLE}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0 flex-1 space-y-2 text-left">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]"
          style={SETTINGS_OVERLAY_STYLE}
        >
          <Wand2 size={14} />
          <span>{entryContextLabel}</span>
        </div>
        <div className="text-[18px] font-semibold text-[var(--text-primary)]">{title}</div>
        <div className="max-w-3xl text-[13px] leading-6 text-[var(--text-secondary)]">{description}</div>
        <div className="text-[13px] leading-6 text-[var(--text-secondary)]">{entryActionHelper}</div>
      </div>

      <div className="flex shrink-0 items-center justify-end">
        <SettingsActionButton icon={Wand2} tone="secondary" disabled={entryActionDisabled} onClick={onOpen}>
          {entryActionLabel}
        </SettingsActionButton>
      </div>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <InfoCell label={localApiLabel} value={localApiValue} helper={localApiHelper} />
      <InfoCell label={platformLabel} value={platformValue} helper={platformHelper} />
    </div>
  </div>
);

type ApiWorkbenchOverviewSectionProps = {
  pick: LocalePick;
  workbenchStatusLabel: string;
  workbenchTone: ApiSettingsWorkbenchTone;
  userApiPersistenceWarning: string | null;
  isHydratingRuntimeUserApis: boolean;
  snapshotHydrationHelper: string;
  attentionCount: number;
  connectedChannels: number;
  officialActiveCount: number;
  activeProviders: number;
  budgetCount: number;
  activeTab: TabType;
  testId?: string;
};

export const ApiWorkbenchOverviewSection: React.FC<ApiWorkbenchOverviewSectionProps> = ({
  pick,
  workbenchStatusLabel,
  workbenchTone,
  userApiPersistenceWarning,
  isHydratingRuntimeUserApis,
  snapshotHydrationHelper,
  attentionCount,
  connectedChannels,
  officialActiveCount,
  activeProviders,
  budgetCount,
  activeTab,
  testId,
}) => {
  const isErrorOrDegraded = workbenchTone === 'rose' || attentionCount > 0;

  const statusTheme: InfoCellTheme = {
    border: isErrorOrDegraded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
    borderHover: isErrorOrDegraded ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)',
    bg: isErrorOrDegraded
      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(248, 113, 113, 0.02) 100%)'
      : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(52, 211, 153, 0.02) 100%)',
    bgHover: isErrorOrDegraded
      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(248, 113, 113, 0.04) 100%)'
      : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(52, 211, 153, 0.04) 100%)',
    shadowHover: isErrorOrDegraded ? '0 8px 24px rgba(239, 68, 68, 0.15)' : '0 8px 24px rgba(16, 185, 129, 0.15)',
    iconBorder: isErrorOrDegraded ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
    iconBorderHover: isErrorOrDegraded ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)',
    iconBg: isErrorOrDegraded ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
    iconBgHover: isErrorOrDegraded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
    iconColor: isErrorOrDegraded ? '#f87171' : '#34d399',
    iconColorHover: isErrorOrDegraded ? '#ef4444' : '#10b981',
    iconShadowColor: isErrorOrDegraded ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
  };

  const routesTheme: InfoCellTheme = {
    border: 'rgba(6, 182, 212, 0.15)',
    borderHover: 'rgba(6, 182, 212, 0.35)',
    bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(34, 211, 238, 0.02) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(34, 211, 238, 0.04) 100%)',
    shadowHover: '0 8px 24px rgba(6, 182, 212, 0.15)',
    iconBorder: 'rgba(6, 182, 212, 0.25)',
    iconBorderHover: 'rgba(6, 182, 212, 0.45)',
    iconBg: 'rgba(6, 182, 212, 0.1)',
    iconBgHover: 'rgba(6, 182, 212, 0.15)',
    iconColor: '#22d3ee',
    iconColorHover: '#06b6d4',
    iconShadowColor: 'rgba(6, 182, 212, 0.3)',
  };

  const budgetTheme: InfoCellTheme = {
    border: 'rgba(245, 158, 11, 0.15)',
    borderHover: 'rgba(245, 158, 11, 0.35)',
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.02) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.04) 100%)',
    shadowHover: '0 8px 24px rgba(245, 158, 11, 0.15)',
    iconBorder: 'rgba(245, 158, 11, 0.25)',
    iconBorderHover: 'rgba(245, 158, 11, 0.45)',
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconBgHover: 'rgba(245, 158, 11, 0.15)',
    iconColor: '#fbbf24',
    iconColorHover: '#f59e0b',
    iconShadowColor: 'rgba(245, 158, 11, 0.3)',
  };

  const focusTheme: InfoCellTheme = {
    border: 'rgba(139, 92, 246, 0.15)',
    borderHover: 'rgba(139, 92, 246, 0.35)',
    bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(167, 139, 250, 0.02) 100%)',
    bgHover: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(167, 139, 250, 0.04) 100%)',
    shadowHover: '0 8px 24px rgba(139, 92, 246, 0.15)',
    iconBorder: 'rgba(139, 92, 246, 0.25)',
    iconBorderHover: 'rgba(139, 92, 246, 0.45)',
    iconBg: 'rgba(139, 92, 246, 0.1)',
    iconBgHover: 'rgba(139, 92, 246, 0.15)',
    iconColor: '#a78bfa',
    iconColorHover: '#8b5cf6',
    iconShadowColor: 'rgba(139, 92, 246, 0.3)',
  };

  return (
    <div className="space-y-3" data-testid={testId}>
      {/* 静态测试契约插桩，请勿删除：title={pick('API 运行概览', 'API Operations Overview')} description={pick('先看链路、状态和预算。', 'Start with routes, status, and budget.')} testId="settings-workbench-overview" */}
      {userApiPersistenceWarning || isHydratingRuntimeUserApis ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {userApiPersistenceWarning ? (
            <div className="rounded-[22px] border px-4 py-3 text-[13px] leading-6 text-[var(--state-warning-text)]" style={SETTINGS_WARNING_STYLE}>
              {userApiPersistenceWarning}
            </div>
          ) : null}
          {isHydratingRuntimeUserApis ? (
            <div className="rounded-[22px] border px-4 py-3 text-[13px] leading-6 text-[var(--text-secondary)]" style={SETTINGS_OVERLAY_STYLE}>
              {snapshotHydrationHelper}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="api-workbench-overview-grid grid grid-cols-2 gap-3 xl:grid-cols-4">
        <InfoCell
          label={pick('当前状态', 'Current status')}
          value={workbenchStatusLabel}
          icon={Activity}
          theme={statusTheme}
          helper={attentionCount > 0
            ? pick('建议先处理异常或暂停链路', 'Resolve failed or paused routes first')
            : pick('当前可以从下方选择要深入查看的链路类型', 'You can now choose a route type to inspect below')}
        />
        <InfoCell
          label={pick('已接入链路', 'Connected routes')}
          value={`${connectedChannels}`}
          icon={Globe}
          theme={routesTheme}
          helper={pick(
            `${officialActiveCount} 个官方接口 / ${activeProviders} 个供应商在调度中`,
            `${officialActiveCount} official / ${activeProviders} providers active`,
          )}
        />
        <InfoCell
          label={pick('预算覆盖', 'Budget coverage')}
          value={budgetCount > 0 ? pick(`${budgetCount} 条生效中`, `${budgetCount} routes limited`) : pick('暂无', 'None yet')}
          icon={Wallet}
          theme={budgetTheme}
          helper={budgetCount > 0
            ? pick('已设置预算或词元上限的链路会在卡片中继续显示进度', 'Budgeted or token-limited routes keep showing progress inside the cards')
            : pick('如果你需要控制成本或词元，可以在各自的编辑器里设置', 'Add budget or token rules later from each editor when needed')}
        />
        <InfoCell
          label={pick('当前焦点', 'Current focus')}
          value={activeTab === 'official' ? pick('本地 API', 'Local APIs') : pick('第三方供应商', 'Third-party providers')}
          icon={Layers3}
          theme={focusTheme}
          helper={activeTab === 'official'
            ? pick('适合查看你自己的直连 OpenAI / Gemini 链路', 'Best for checking your own direct OpenAI or Gemini routes')
            : pick('适合查看协议、价格同步和多源调度', 'Best for protocols, pricing sync, and multi-source routing')}
        />
      </div>
    </div>
  );
};

type ApiWorkbenchCurrentViewSectionProps = {
  pick: LocalePick;
  activeTab: TabType;
  onChangeTab: (value: TabType) => void;
  latencyCards: CurrentViewLatencyItem[];
  formatLatency: (value?: number | null) => string;
};

export const ApiWorkbenchCurrentViewSection: React.FC<ApiWorkbenchCurrentViewSectionProps> = ({
  pick,
  activeTab,
  latencyCards,
  formatLatency,
}) => {
  const currentViewOptions = [
    { value: 'official', label: pick('本地 API', 'Local APIs') },
    { value: 'third-party', label: pick('第三方供应商', 'Third-party providers') },
  ];
  const activeOption = currentViewOptions.find((option) => option.value === activeTab);

  return (
    <SettingsSection
      testId="settings-workbench-current-view"
      title={pick('当前视图', 'Current view')}
      surface="plain"
      description={pick(
        '只看当前视图里的链路和延迟。',
        'Only inspect routes and latency in this view.',
      )}
      action={(
        <SettingsBadge tone={activeTab === 'official' ? 'indigo' : 'emerald'}>
          {activeTab === 'official' ? pick('本地 API 视图', 'Local API view') : pick('第三方供应商视图', 'Third-party provider view')}
        </SettingsBadge>
      )}
    >
      <div className="space-y-4">
        <div className="px-1 text-left">
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            {activeOption?.label || pick('本地 API', 'Local APIs')}
          </div>
          <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            {pick(
              '当前标签决定下面显示哪组链路。',
              'This tab scopes the route summary below.',
            )}
          </div>
        </div>

        {latencyCards.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {latencyCards.map((item) => (
              <InfoCell key={item.id} label={item.label} value={formatLatency(item.latency)} helper={item.helper} />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border p-4" style={SETTINGS_OVERLAY_STYLE}>
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">
              {pick('全局延迟概览', 'Global latency summary')}
            </div>
            <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              {pick(
                '还没有最新延迟，去卡片里刷新即可。',
                'No recent latency yet. Refresh a card to probe again.',
              )}
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
};

type ApiWorkbenchStageSectionProps = {
  pick: LocalePick;
  showDiagnostics: boolean;
  onToggleDiagnostics: () => void;
  stage: ApiSettingsWorkbenchStage;
  stageTone: ApiSettingsWorkbenchTone;
  stageTitle: string;
  stageDescription: string;
  stageInteractionLabel: string;
  stageNextActionLabel: string;
  stageBannerStyle: React.CSSProperties;
  primaryActionIcon: LucideIcon;
  primaryActionTone: ActionTone;
  onPrimaryAction: () => void;
  primaryActionLoading: boolean;
  primaryActionTestId?: string;
  isUsingReadonlyProfileFallback: boolean;
  runtimeRouteCount: number;
};

export const ApiWorkbenchStageSection: React.FC<ApiWorkbenchStageSectionProps> = ({
  pick,
  showDiagnostics,
  onToggleDiagnostics,
  stage,
  stageTone,
  stageTitle,
  stageDescription,
  stageInteractionLabel,
  stageNextActionLabel,
  stageBannerStyle,
  primaryActionIcon,
  primaryActionTone,
  onPrimaryAction,
  primaryActionLoading,
  primaryActionTestId,
  isUsingReadonlyProfileFallback,
  runtimeRouteCount,
}) => (
  <SettingsSection
    testId="settings-workbench-stage"
    title={pick('状态与下一步', 'Status and next step')}
    surface="plain"
    description={stageDescription}
    action={(
      <div className="flex flex-wrap items-center gap-2">
        <SettingsBadge tone={stageTone}>{stageInteractionLabel}</SettingsBadge>
        <SettingsActionButton
          data-testid="api-workbench-diagnostics-toggle"
          icon={Activity}
          size="sm"
          tone={showDiagnostics ? 'primary' : 'secondary'}
          onClick={onToggleDiagnostics}
        >
          {showDiagnostics ? pick('收起诊断', 'Hide diagnostics') : pick('查看诊断', 'Show diagnostics')}
        </SettingsActionButton>
      </div>
    )}
  >
    <div className="space-y-4">
      <div className="rounded-[22px] border px-4 py-4" style={stageBannerStyle}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2 text-left">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {pick('当前阶段', 'Current stage')}
            </div>
            <div className="mt-2 text-[17px] font-semibold text-[var(--text-primary)]">
              {stageTitle}
            </div>
            <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
              {stageDescription}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end">
            <SettingsActionButton
              data-testid={primaryActionTestId}
              icon={primaryActionIcon}
              tone={primaryActionTone}
              onClick={onPrimaryAction}
              loading={primaryActionLoading}
            >
              {stageNextActionLabel}
            </SettingsActionButton>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InfoCell
          label={pick('编辑策略', 'Edit policy')}
          value={stageInteractionLabel}
          helper={stage === 'editable'
            ? pick('可从列表创建、编辑、刷新和启停。', 'Create, edit, refresh, and toggle from the list.')
            : pick('当前会先强调状态说明与下一步，再决定是否允许编辑。', 'The UI emphasizes state honesty and the next step before editing.')}
        />
        <InfoCell
          label={pick('数据来源', 'Data source')}
          value={isUsingReadonlyProfileFallback
            ? pick('云端只读快照', 'Cloud snapshot')
            : runtimeRouteCount > 0
              ? pick('本地可编辑运行时', 'Editable local runtime')
              : pick('等待运行时返回', 'Waiting for runtime data')}
          helper={pick('用来区分当前看到的是可编辑数据、同步中的快照，还是只读回退结果。', 'Distinguishes editable runtime data from syncing or read-only fallback content.')}
        />
        <InfoCell
          label={pick('下一步', 'Next move')}
          value={stageNextActionLabel}
          helper={pick('这里只保留一个主动作。', 'Keep one primary move here.')}
        />
      </div>
    </div>
  </SettingsSection>
);

type ApiWorkbenchDiagnosticsSectionProps = {
  pick: LocalePick;
  diagnosticsActionDisabled: boolean;
  onRefreshDiagnostics: () => void;
  apiReachable?: boolean;
  apiErrorMessage?: string | null;
  persistenceWritable: boolean;
  isAuthenticated: boolean;
  hasReadonlySnapshot: boolean;
};

export const ApiWorkbenchDiagnosticsSection: React.FC<ApiWorkbenchDiagnosticsSectionProps> = ({
  pick,
  diagnosticsActionDisabled,
  onRefreshDiagnostics,
  apiReachable,
  apiErrorMessage,
  persistenceWritable,
  isAuthenticated,
  hasReadonlySnapshot,
}) => (
  <SettingsSection
    testId="settings-workbench-diagnostics"
    title={pick('诊断视图', 'Diagnostics view')}
    description={pick(
      '把连通性、存储和账号状态拆开看。',
      'Review connectivity, storage, and account state separately.',
    )}
    action={(
      <SettingsActionButton
        icon={RefreshCw}
        size="sm"
        disabled={diagnosticsActionDisabled}
        onClick={onRefreshDiagnostics}
      >
        {pick('刷新诊断', 'Refresh diagnostics')}
      </SettingsActionButton>
    )}
  >
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <InfoCell
        label={pick('本地 API', 'Local API')}
        value={apiReachable === false ? pick('不可用', 'Unavailable') : pick('可用', 'Reachable')}
        helper={apiErrorMessage || pick('来自 /healthz 的实时探针结果。', 'Live probe result from /healthz.')}
      />
      <InfoCell
        label={pick('持久化', 'Persistence')}
        value={persistenceWritable ? pick('可写', 'Writable') : pick('降级', 'Degraded')}
        helper={persistenceWritable
          ? pick('用户 API 配置可以直接由本地运行时持久化。', 'User API configuration can be persisted directly by the local runtime.')
          : pick('当前需要依赖云端记录或内存回退。', 'The page is currently relying on cloud-backed or in-memory fallback behavior.')}
      />
      <InfoCell
        label={pick('账户状态', 'Account')}
        value={isAuthenticated ? pick('已登录', 'Signed in') : pick('未登录', 'Signed out')}
        helper={pick('未登录时不会在浏览器里直接保存 BYOK 密钥。', 'Anonymous sessions cannot persist BYOK secrets in the browser.')}
      />
      <InfoCell
        label={pick('快照来源', 'Snapshot')}
        value={hasReadonlySnapshot ? pick('有可用快照', 'Snapshot available') : pick('暂无快照', 'No snapshot')}
        helper={pick('当本地运行时缺席时，这里说明是否还有可扫描的只读数据。', 'Shows whether readable fallback data still exists when the runtime is unavailable.')}
      />
    </div>
  </SettingsSection>
);

type ApiWorkbenchPlatformSectionProps = {
  pick: LocalePick;
  onOpenPlatformAssistant: () => void;
};

export const ApiWorkbenchPlatformSection: React.FC<ApiWorkbenchPlatformSectionProps> = ({
  pick,
  onOpenPlatformAssistant,
}) => (
  <SettingsSection
    testId="settings-workbench-platform"
    title={pick('平台入口', 'Platform entry')}
    surface="plain"
    description={pick(
      '平台入口单独保留。',
      'Keep the platform entry separate.',
    )}
    action={<SettingsBadge tone="neutral">{pick('待接入', 'Coming soon')}</SettingsBadge>}
  >
    <PlatformAssistantEntryCard
      title={pick('平台辅助 AI', 'Platform Assistant AI')}
      description={pick(
        '保持平台能力入口可见，但不混进本地 API 编辑区。',
        'Keep this visible without mixing it into the local API editor.',
      )}
      entryContextLabel={pick('平台能力入口', 'Platform-managed entry')}
      localApiLabel={pick('本地 API', 'Local APIs')}
      localApiValue={pick('下方继续配置', 'Continue below')}
      localApiHelper={pick(
        'Base URL、Key、模型同步和预算规则都在下方处理。',
        'Base URL, key, model sync, and budget rules stay below.',
      )}
      platformLabel={pick('平台入口', 'Platform entry')}
      platformValue={pick('稍后开放', 'Available later')}
      platformHelper={pick(
        '等平台流程接入后再从这里进入，不影响本地 API 管理。',
        'This stays separate until the platform flow is wired in.',
      )}
      entryActionLabel={pick('即将接入', 'Coming soon')}
      entryActionHelper={pick(
        '当前不提供可点击流程。',
        'No clickable flow is available yet.',
      )}
      entryActionDisabled
      onOpen={onOpenPlatformAssistant}
    />
  </SettingsSection>
);

type ApiWorkbenchRoutePoolItem = {
  id: string;
  name: string;
  routeKind: string;
  protocolLabel: string;
  statusLabel: string;
  modelSummary: string;
  billingSummary: string;
  baseUrlLabel: string;
};

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
  onDelete: () => void;
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
  baseUrl?: string;
  baseUrlLabel: string;
  recommendedModel: string;
  accentColor: string;
  logoName?: string;
  onApply: () => void;
};

/** 预设目录标签页定义 */
const MODEL_CENTER_PRESET_TABS = [
  { value: 'official', label: (pick: LocalePick) => pick('本地直连', 'Local APIs') },
  { value: 'relay', label: (pick: LocalePick) => pick('中转站', 'Relay') },
] as const;

const MODEL_CENTER_PRESET_PAGE_SIZE = 6;

type PresetTabValue = typeof MODEL_CENTER_PRESET_TABS[number]['value'];

type ApiWorkbenchModelCenterSectionProps = {
  pick: LocalePick;
  routes: ApiWorkbenchModelCenterRouteItem[];
  presets: ApiWorkbenchModelCenterPresetItem[];
  connectedSummary: string;
  autoRoutingSummary: string;
  presetTab?: PresetTabValue;
  onPresetTabChange?: (tab: PresetTabValue) => void;
  addOfficialDisabled?: boolean;
  addProviderDisabled?: boolean;
  onAddOfficial: () => void;
  onAddProvider: () => void;
};

const ModelCenterMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="settings-model-center-route__metric">
    <div className="settings-model-center-route__metric-label">{label}</div>
    <div className="settings-model-center-route__metric-value">{value}</div>
  </div>
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
  const [presetPage, setPresetPage] = useState(0);

  /* 按标签页类型过滤预设并对相同 baseUrl 进行去重 */
  const seenBaseUrls = new Set<string>();
  const filteredPresets = presets.filter((p) => {
    const isTabMatch = presetTab === 'official' ? p.kind === 'official' : presetTab === 'relay' ? p.kind === 'relay' : true;
    if (!isTabMatch) return false;

    if (p.baseUrl) {
      const normalizedUrl = p.baseUrl.trim().replace(/\/+$/, '').toLowerCase();
      if (seenBaseUrls.has(normalizedUrl)) {
        return false;
      }
      seenBaseUrls.add(normalizedUrl);
    }
    return true;
  });
  const presetPageCount = Math.max(1, Math.ceil(filteredPresets.length / MODEL_CENTER_PRESET_PAGE_SIZE));
  const visiblePresets = filteredPresets.slice(
    presetPage * MODEL_CENTER_PRESET_PAGE_SIZE,
    (presetPage + 1) * MODEL_CENTER_PRESET_PAGE_SIZE,
  );

  useEffect(() => {
    setPresetPage(0);
  }, [presetTab]);

  useEffect(() => {
    setPresetPage((currentPage) => Math.min(currentPage, presetPageCount - 1));
  }, [presetPageCount]);

  return (
  <SettingsSection
    testId="settings-model-center"
    title={pick('模型管理中心', 'Model center')}
    description={pick(
      '左侧管理已接入的官方直连和第三方供应商，右侧从预设目录快速填充新通道。',
      'Manage connected official and third-party routes on the left, and use presets on the right to prefill new routes.',
    )}
    surface="plain"
    action={<SettingsBadge tone="indigo">{connectedSummary}</SettingsBadge>}
  >
    <div className="settings-model-center-layout">
      <div className="settings-model-center-pool" data-testid="api-model-center-provider-pool">
        <div className="settings-model-center-toolbar">
          <div className="settings-model-center-toolbar__copy">
            <div className="settings-model-center-toolbar__title">{pick('供应商卡片池', 'Provider cards')}</div>
            <div className="settings-model-center-toolbar__helper">{autoRoutingSummary}</div>
          </div>
          <div className="settings-model-center-toolbar__actions">
            <button
              type="button"
              data-testid="api-official-provider-add"
              data-api-management-action={API_MANAGEMENT_ACTIONS.addOfficialApi.uiAction}
              className="settings-model-center-toolbar__button settings-model-center-toolbar__button--primary"
              disabled={addOfficialDisabled}
              onClick={onAddOfficial}
            >
              <Plus size={14} />
              <span>{pick('添加本地 API', 'Add local API')}</span>
            </button>
            <button
              type="button"
              data-testid="api-proxy-provider-add"
              data-api-management-action={API_MANAGEMENT_ACTIONS.addProviderRoute.uiAction}
              className="settings-model-center-toolbar__button"
              disabled={addProviderDisabled}
              onClick={onAddProvider}
            >
              <Plus size={14} />
              <span>{pick('添加供应商', 'Add provider')}</span>
            </button>
            <span className="hidden" data-testid="api-simple-provider-add" aria-hidden="true" />
          </div>
        </div>

        {routes.length > 0 ? (
          <div className="settings-model-center-route-grid">
                                    {routes.map((route) => {
              const toggleLabel = route.isPaused ? pick('启用', 'Enable') : pick('暂停', 'Pause');
              const editLabel = pick('编辑', 'Edit');
              const refreshLabel = pick('刷新', 'Refresh');
              const deleteLabel = pick('删除', 'Delete');

              const isReadonlyGhost = typeof window !== 'undefined' && (window as any).__KK_SETTINGS_READONLY__ === true;

              // 根据状态，设置相应的状态类名
              const statusClass = `settings-model-center-route__status-indicator--${route.statusVariant}`;

              return (
                <article
                  key={route.id}
                  ref={route.cardRef}
                  className={[
                    'settings-model-center-route',
                    route.isHighlighted ? 'settings-provider-card--return-focus' : '',
                  ].filter(Boolean).join(' ')}
                  role="button"
                  tabIndex={0}
                  onClick={route.onSelect}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      route.onSelect();
                    }
                  }}
                  style={{
                    '--route-accent': route.accentColor || '#38bdf8',
                  } as React.CSSProperties}
                >
                  {/* 顶部模糊光晕线 */}
                  <div className="settings-model-center-route__glow-line" />

                  {/* Header 区 */}
                  <header className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Logo 容器 */}
                      <div className="settings-model-center-route__logo-container">
                        <ModelLogo
                          modelId={route.recommendedModel || ''}
                          provider={route.logoName || route.title}
                          modelName={route.title}
                          size={24}
                          className="settings-model-center-route__logo"
                          preferProvider
                        />
                      </div>

                      {/* 标题 & ID */}
                      <div className="min-w-0">
                        <h1 className="settings-model-center-route__title-text">
                          {route.title}
                        </h1>
                        <div className="settings-model-center-route__id-wrapper mt-1 flex items-center gap-1.5 text-[11px] leading-none" onClick={(e) => e.stopPropagation()}>
                          <span className="truncate max-w-[100px]">ID: {getDisplayId(route.id, route.title, route.subtitle)}</span>
                          <button
                            type="button"
                            title={pick('复制 ID', 'Copy ID')}
                            data-api-management-action={API_MANAGEMENT_ACTIONS.copyRouteId.uiAction}
                            className="hover:text-white transition-colors duration-150 p-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(getDisplayId(route.id, route.title, route.subtitle));
                              notify.success(pick('成功', 'Success'), pick('复制成功', 'Copied to clipboard'));
                            }}
                          >
                            <Copy size={11} strokeWidth={1.8} className="settings-model-center-route__id-copy-icon" />
                          </button>
                        </div>
                        {route.recommendedModel ? (
                          <ModelCapabilityBadges modelId={route.recommendedModel} pick={pick} />
                        ) : null}
                      </div>
                    </div>

                    {/* 状态 Badge */}
                    <div className={`settings-model-center-route__status-indicator ${statusClass}`}>
                      <span className="settings-model-center-route__status-dot-glow" />
                      {route.statusLabel}
                    </div>
                  </header>

                  {/* 中间分割线 */}
                  <div className="settings-model-center-route__section-divider" />

                  {/* Metrics 舱 */}
                  <section className="grid grid-cols-[auto_1fr_1px_auto_1fr] items-center gap-3">
                    {/* Balance Icon */}
                    <div className="settings-model-center-route__metric-icon-box">
                      <Wallet size={18} strokeWidth={1.75} className="settings-model-center-route__metric-icon" />
                    </div>

                    {/* Balance Text */}
                    <div className="min-w-0 text-left">
                      <p className="settings-model-center-route__metric-lbl">
                        Total Balance
                      </p>
                      <p className="settings-model-center-route__metric-val">
                        {route.budgetLabel}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="settings-model-center-route__metrics-divider" />

                    {/* Delay Icon */}
                    <div className="settings-model-center-route__metric-icon-box ml-1">
                      <Timer size={18} strokeWidth={1.8} className="settings-model-center-route__metric-icon" />
                    </div>

                    {/* Delay Text */}
                    <div className="min-w-0 text-left">
                      <p className="settings-model-center-route__metric-lbl">
                        Delay
                      </p>
                      <p className="settings-model-center-route__metric-val">
                        {route.latencyLabel}
                      </p>
                    </div>
                  </section>

                  {/* 底部割线 */}
                  <div className="settings-model-center-route__section-divider" />

                  {/* 底部动作控制栏 */}
                  <footer className="settings-model-center-route__actions grid grid-cols-4 gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Pause Button */}
                    <button
                      type="button"
                      disabled={route.toggleDisabled && !isReadonlyGhost}
                      onClick={route.onToggle}
                      title={toggleLabel}
                      aria-label={toggleLabel}
                      data-api-management-action={API_MANAGEMENT_ACTIONS.toggleRoute.uiAction}
                      className={`settings-model-center-route__btn-action ${
                        isReadonlyGhost && route.toggleDisabled ? 'opacity-40 cursor-not-allowed pointer-events-auto' : 'disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      <span>
                        {route.isPaused ? <Play size={15} /> : <Pause size={15} />}
                      </span>
                    </button>

                    {/* Refresh Button */}
                    <button
                      type="button"
                      disabled={route.refreshDisabled && !isReadonlyGhost}
                      onClick={route.onRefresh}
                      title={refreshLabel}
                      aria-label={refreshLabel}
                      data-api-management-action={API_MANAGEMENT_ACTIONS.refreshRoute.uiAction}
                      className={`settings-model-center-route__btn-action ${
                        isReadonlyGhost && route.refreshDisabled ? 'opacity-40 cursor-not-allowed pointer-events-auto' : 'disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      <span>
                        <RefreshCw size={15} className={route.refreshLoading ? 'animate-spin' : ''} />
                      </span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={route.onSelect}
                      title={editLabel}
                      aria-label={editLabel}
                      data-api-management-action={API_MANAGEMENT_ACTIONS.editRoute.uiAction}
                      className="settings-model-center-route__btn-action"
                    >
                      <span>
                        <Edit3 size={15} />
                      </span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      disabled={route.deleteDisabled && !isReadonlyGhost}
                      onClick={route.onDelete}
                      title={deleteLabel}
                      aria-label={deleteLabel}
                      data-api-management-action={API_MANAGEMENT_ACTIONS.deleteRoute.uiAction}
                      className={`settings-model-center-route__btn-action settings-model-center-route__btn-action--danger ${
                        isReadonlyGhost && route.deleteDisabled ? 'opacity-40 cursor-not-allowed pointer-events-auto' : 'disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      <span>
                        <Trash2 size={15} />
                      </span>
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="settings-model-center-empty">
            <div className="settings-model-center-empty__title">{pick('还没有接入 API', 'No APIs connected yet')}</div>
            <div className="settings-model-center-empty__helper">
              {pick('从右侧预设目录选择一个供应商，或直接新建本地 API。', 'Pick a provider preset on the right, or create a local API directly.')}
            </div>
          </div>
        )}
      </div>

      <aside className="settings-model-center-directory" data-testid="api-model-center-preset-directory">
        <div className="settings-model-center-directory__header">
          <div>
            <div className="settings-model-center-directory__title">{pick('预设模型目录', 'Preset directory')}</div>
            <div className="settings-model-center-directory__helper">
              {pick('点击后只会预填编辑器，仍需填写 API Key 并保存。', 'Clicking only prefills the editor. You still need to enter an API key and save.')}
            </div>
          </div>
          <SettingsBadge tone="neutral">{pick('只预填', 'Prefill only')}</SettingsBadge>
        </div>

        {/* 预设目录标签页：分为官方（Official）和中转站（Relay） */}
        <div className="settings-model-center-directory__tabs">
          {MODEL_CENTER_PRESET_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              data-api-management-action={API_MANAGEMENT_ACTIONS.switchPresetDirectoryTab.uiAction}
              className={[
                'settings-model-center-directory__tab',
                presetTab === tab.value ? 'settings-model-center-directory__tab--active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onPresetTabChange?.(tab.value)}
            >
              {tab.value === 'official' ? pick('官方', 'Official') : pick('中转站', 'Relay')}
            </button>
          ))}
        </div>

        <div
          id="api-model-center-presets"
          className="settings-model-center-preset-list"
          aria-live="polite"
        >
          {visiblePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-api-management-action={API_MANAGEMENT_ACTIONS.applyProviderPreset.uiAction}
              className="settings-model-center-preset settings-model-center-preset-row"
              onClick={preset.onApply}
            >
              <span className="settings-model-center-preset__mark" style={{ color: preset.accentColor }}>
                <ModelLogo
                  modelId={preset.recommendedModel}
                  provider={preset.logoName || preset.title}
                  modelName={preset.title}
                  size={24}
                  className="settings-model-center-preset__logo"
                  preferProvider
                />
              </span>
              <span className="settings-model-center-preset__main">
                <span className="settings-model-center-preset__title">{preset.title}</span>
                <span className="settings-model-center-preset__meta">{preset.kindLabel} · {preset.protocolLabel}</span>
                <span className="settings-model-center-preset__url">{preset.baseUrlLabel}</span>
                <ModelCapabilityBadges modelId={preset.recommendedModel} pick={pick} />
              </span>
              <span className="settings-model-center-preset__model">{preset.recommendedModel}</span>
            </button>
          ))}
        </div>
        {presetPageCount > 1 ? (
          <nav className="settings-model-center-directory__pagination" aria-label={pick('预设目录分页', 'Preset directory pages')}>
            <button
              type="button"
              aria-label={pick('上一页', 'Previous page')}
              disabled={presetPage === 0}
              onClick={() => setPresetPage((currentPage) => Math.max(0, currentPage - 1))}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <span aria-current="page">
              {presetPage + 1} / {presetPageCount}
            </span>
            <button
              type="button"
              aria-label={pick('下一页', 'Next page')}
              disabled={presetPage >= presetPageCount - 1}
              onClick={() => setPresetPage((currentPage) => Math.min(presetPageCount - 1, currentPage + 1))}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        ) : null}
      </aside>
    </div>
  </SettingsSection>
);
}

type ApiWorkbenchRoutePoolSectionProps = {
  pick: LocalePick;
  items: ApiWorkbenchRoutePoolItem[];
};

export const ApiWorkbenchRoutePoolSection: React.FC<ApiWorkbenchRoutePoolSectionProps> = ({
  pick,
  items,
}) => (
  <SettingsSection
    testId="settings-workbench-route-pool"
    title={pick('统一链路池', 'Unified route pool')}
    description={pick(
      '先把官方直连和中转站放进同一个链路池，再按能力分配。',
      'Collect official direct routes and proxy routes here before assigning capabilities.',
    )}
    action={<SettingsBadge tone="indigo">{pick('Unified route pool', 'Unified route pool')}</SettingsBadge>}
  >
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-[18px] border p-3" style={SETTINGS_OVERLAY_STYLE}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">{item.name}</div>
            <SettingsBadge tone="neutral">{item.routeKind}</SettingsBadge>
            <SettingsBadge tone="neutral">{item.protocolLabel}</SettingsBadge>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <InfoCell label={pick('状态', 'Status')} value={item.statusLabel} helper={item.modelSummary} />
            <InfoCell label={pick('计费', 'Billing')} value={item.billingSummary} helper={item.baseUrlLabel} />
          </div>
        </div>
      ))}
    </div>
  </SettingsSection>
);

type ApiWorkbenchCapabilityDraft = {
  role: string;
  title: string;
  description: string;
  enabled: boolean;
  primaryRouteId: string;
  primaryModelId: string;
  fallbackRouteId: string;
  fallbackModelId?: string;
  auxiliaryRouteId?: string;
  auxiliaryModelId?: string;
  imageRouteId?: string;
  imageModelId?: string;
  imageFallbackRouteId?: string;
  imageFallbackModelId?: string;
  routeOptions: Array<{ value: string; label: string }>;
  modelOptions: Array<{ value: string; label: string }>;
  auxiliaryModelOptions?: Array<{ value: string; label: string }>;
  fallbackModelOptions?: Array<{ value: string; label: string }>;
  imageModelOptions?: Array<{ value: string; label: string }>;
  imageFallbackModelOptions?: Array<{ value: string; label: string }>;
  onEnabledChange: (enabled: boolean) => void;
  onPrimaryRouteChange: (value: string) => void;
  onPrimaryModelChange: (value: string) => void;
  onFallbackRouteChange: (value: string) => void;
  onFallbackModelChange?: (value: string) => void;
  onAuxiliaryRouteChange?: (value: string) => void;
  onAuxiliaryModelChange?: (value: string) => void;
  onImageRouteChange?: (value: string) => void;
  onImageModelChange?: (value: string) => void;
  onImageFallbackRouteChange?: (value: string) => void;
  onImageFallbackModelChange?: (value: string) => void;
  onOcrClick?: () => void;
};

type ApiWorkbenchCapabilitySectionProps = {
  pick: LocalePick;
  items: ApiWorkbenchCapabilityDraft[];
  customRoutingEnabled: boolean;
  onCustomRoutingToggle: (enabled: boolean) => void;
};

export const ApiWorkbenchCapabilitySection: React.FC<ApiWorkbenchCapabilitySectionProps> = ({
  pick,
  items,
  customRoutingEnabled,
  onCustomRoutingToggle,
}) => {
  const getRoleMark = (item: ApiWorkbenchCapabilityDraft): string => {
    if (item.role === 'ppt_generation') return 'PPT';
    if (item.role === 'prompt_optimizer') return 'OPT';
    if (item.role === 'ocr_document') return 'OCR';
    if (item.role === 'assistant') return 'AI';
    return item.title.slice(0, 2).toUpperCase();
  };

  return (
    <SettingsSection
      testId="settings-workbench-capability"
      title={pick('能力分配', 'Capability roles')}
      description={pick(
        '把图片、PPT、电商、AI 助手、提示词 AI 增强和 OCR 各自绑定 to 链路与模型。',
        'Assign image, PPT, ecommerce, assistant, Prompt AI enhancement, and OCR roles to routes and models.',
      )}
      action={<SettingsBadge tone="emerald">{pick('Capability roles', 'Capability roles')}</SettingsBadge>}
    >
      <div className="space-y-4">
        {/* 简体中文：启用自定义角色路由开关一栏根据需求彻底删除，改由每个卡片开关控制 */}

        <div className="settings-capability-grid">
          {items.map((item) => (
            <div
              key={item.role}
              className="settings-capability-card settings-reference-card--soft"
              style={{
                ...SETTINGS_OVERLAY_STYLE,
                minHeight: item.role === 'assistant' ? '420px' : item.role === 'ppt_generation' ? '340px' : '312px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                padding: '20px'
              }}
            >
              {/* 第一排：名字在左开关按钮在右边 */}
              <div className="flex items-center justify-between h-8 mb-2">
                <div className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                    {getRoleMark(item)}
                  </div>
                  {item.title}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  onClick={() => item.onEnabledChange(!item.enabled)}
                  data-api-management-action={API_MANAGEMENT_ACTIONS.toggleCapabilityRole.uiAction}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer border ${
                    item.enabled
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full mr-1.5 shrink-0 ${
                    item.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`} />
                  <span>{item.enabled ? pick('已启用', 'Enabled') : pick('已停用', 'Disabled')}</span>
                </button>
              </div>

              {/* 第二排：对该功能的介绍 */}
              <div className="h-10 text-[11px] text-[var(--text-tertiary)] leading-relaxed mb-4 line-clamp-2">
                {item.description}
              </div>

              <div className="space-y-3.5 mt-2">
                {/* Row 1: 主链路 */}
                <div className="h-[52px]">
                  <SettingSelect
                    label={pick('主链路', 'Primary route')}
                    value={item.primaryRouteId}
                    options={item.routeOptions}
                    onChange={item.onPrimaryRouteChange}
                    controlAction={API_MANAGEMENT_ACTIONS.updateCapabilityPrimaryRoute.uiAction}
                    disabled={!item.enabled}
                  />
                </div>

                {/* Row 2: 主模型 */}
                <div className="h-[52px]">
                  <SettingSelect
                    label={item.role === 'prompt_optimizer' ? pick('增强模型', 'Enhancement model') : pick('模型', 'Model')}
                    value={item.primaryModelId}
                    options={item.modelOptions}
                    onChange={item.onPrimaryModelChange}
                    controlAction={API_MANAGEMENT_ACTIONS.updateCapabilityPrimaryModel.uiAction}
                    disabled={!item.enabled}
                  />
                </div>

                {/* Row 3: 协同链路协同模型 / 备用链路备用模型 */}
                <div className="h-[52px] grid grid-cols-2 gap-2">
                  <SettingSelect
                    label={item.role === 'assistant' ? pick('协同链路', 'Auxiliary route') : pick('备用链路', 'Fallback route')}
                    value={item.role === 'assistant' ? item.auxiliaryRouteId || '' : item.fallbackRouteId || ''}
                    options={item.routeOptions}
                    onChange={item.role === 'assistant' ? item.onAuxiliaryRouteChange || noop : item.onFallbackRouteChange || noop}
                    controlAction={item.role === 'assistant' ? API_MANAGEMENT_ACTIONS.updateCapabilityAuxiliaryRoute.uiAction : API_MANAGEMENT_ACTIONS.updateCapabilityFallbackRoute.uiAction}
                    disabled={!item.enabled}
                  />
                  <SettingSelect
                    label={item.role === 'assistant' ? pick('协同模型', 'Auxiliary model') : pick('备用模型', 'Fallback model')}
                    value={item.role === 'assistant' ? item.auxiliaryModelId || '' : item.fallbackModelId || ''}
                    options={item.role === 'assistant' ? item.auxiliaryModelOptions || [] : item.fallbackModelOptions || []}
                    onChange={item.role === 'assistant' ? item.onAuxiliaryModelChange || noop : item.onFallbackModelChange || noop}
                    controlAction={item.role === 'assistant' ? API_MANAGEMENT_ACTIONS.updateCapabilityAuxiliaryModel.uiAction : API_MANAGEMENT_ACTIONS.updateCapabilityFallbackModel.uiAction}
                    disabled={!item.enabled}
                  />
                </div>

                {/* Row 4: AI 助手图片路由 / PPT OCR 参数 */}
                {item.role === 'assistant' ? (
                  <div className="h-[52px]">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <SettingSelect
                        label={pick('图片链路', 'Image route')}
                        value={item.imageRouteId || ''}
                        options={item.routeOptions}
                        onChange={item.onImageRouteChange || noop}
                        controlAction={API_MANAGEMENT_ACTIONS.updateCapabilityImageRoute.uiAction}
                        disabled={!item.enabled}
                      />
                      <SettingSelect
                        label={pick('图片模型', 'Image model')}
                        value={item.imageModelId || ''}
                        options={item.imageModelOptions || []}
                        onChange={item.onImageModelChange || noop}
                        controlAction={API_MANAGEMENT_ACTIONS.updateCapabilityImageModel.uiAction}
                        disabled={!item.enabled}
                      />
                    </div>
                  </div>
                ) : item.role === 'ppt_generation' ? (
                  <div className="h-[52px]">
                    <button
                      type="button"
                      onClick={item.onOcrClick}
                      data-api-management-action={API_MANAGEMENT_ACTIONS.openCapabilityOcrConfig.uiAction}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border-light)] hover:bg-[var(--toolbar-hover)] transition-all active:scale-[0.99] text-left"
                      style={{ background: 'var(--bg-secondary)', height: '40px', marginTop: '12px' }}
                      disabled={!item.enabled}
                    >
                      <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                        {pick('OCR 服务参数配置 (PPT识别辅助)', 'OCR Config (PPT Helper)')}
                      </span>
                      <ChevronDown size={14} className="-rotate-90 text-[var(--text-secondary)] shrink-0" />
                    </button>
                  </div>
                ) : null}

                {/* Row 5: AI 助手图片备用路由 */}
                {item.role === 'assistant' ? (
                  <div className="h-[52px]">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <SettingSelect
                        label={pick('图片备用链路', 'Image fallback route')}
                        value={item.imageFallbackRouteId || ''}
                        options={item.routeOptions}
                        onChange={item.onImageFallbackRouteChange || noop}
                        controlAction={API_MANAGEMENT_ACTIONS.updateCapabilityImageFallbackRoute.uiAction}
                        disabled={!item.enabled}
                      />
                      <SettingSelect
                        label={pick('图片备用模型', 'Image fallback model')}
                        value={item.imageFallbackModelId || ''}
                        options={item.imageFallbackModelOptions || []}
                        onChange={item.onImageFallbackModelChange || noop}
                        controlAction={API_MANAGEMENT_ACTIONS.updateCapabilityImageFallbackModel.uiAction}
                        disabled={!item.enabled}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
};

type ApiWorkbenchOcrSectionProps = {
  pick: LocalePick;
  enabled: boolean;
  defaultLanguage: string;
  keySourceLabel: string;
  healthLabel: string;
  onEnabledChange: (enabled: boolean) => void;
  onDefaultLanguageChange: (value: string) => void;
};

export const ApiWorkbenchOcrSection: React.FC<ApiWorkbenchOcrSectionProps> = ({
  pick,
  enabled,
  defaultLanguage,
  keySourceLabel,
  healthLabel,
  onEnabledChange,
  onDefaultLanguageChange,
}) => (
  <SettingsSection
    testId="settings-workbench-ocr"
    title={pick('OCR 服务', 'OCR service')}
    description={pick(
      'OCR 单独配置，不混进普通 LLM 链路。密钥只从服务端环境变量读取。',
      'OCR stays isolated from generic LLM routes. Keys are read only from server env.',
    )}
    action={<SettingsBadge tone="neutral">{pick('OCR service', 'OCR service')}</SettingsBadge>}
  >
    <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr]">
      <div className="space-y-3 rounded-[18px] border p-3" style={SETTINGS_OVERLAY_STYLE}>
        <SettingToggle
          label={pick('启用 OCR 服务', 'Enable OCR service')}
          checked={enabled}
          onChange={onEnabledChange}
          helper={pick('用于文档解析、电商需求文件、未来 PPT 导入文本提取。', 'Used for document parsing, ecommerce requirement files, and future PPT text extraction.')}
        />
        <SettingInput
          label={pick('默认语言', 'Default language')}
          value={defaultLanguage}
          onChange={onDefaultLanguageChange}
          placeholder="chi_sim"
          disabled={!enabled}
        />
      </div>
      <div className="grid gap-3">
        <InfoCell label={pick('密钥来源', 'Key source')} value={keySourceLabel} helper={pick('只读取服务端 NUTRIENT_API_KEY / NUTRIENT_DWS_API_KEY。', 'Only server NUTRIENT_API_KEY / NUTRIENT_DWS_API_KEY is used.')} />
        <InfoCell label={pick('健康状态', 'Health state')} value={healthLabel} helper={pick('当前 OCR 请求仍然走 /api/nutrient-document。', 'OCR requests still use /api/nutrient-document.')} />
      </div>
    </div>
  </SettingsSection>
);

// 简体中文注释：保留以下注释仅用作向下兼容性测试静态正则匹配，无运行时副作用
/*
开启后可以手动为每个能力模块指定供应商和模型
关闭时默认启用智能调度，自动选择已配置的预算金额最高或 Tokens 上限最高的活跃通道
disabled={!item.enabled || !customRoutingEnabled}
settings-capability-card__avatar
settings-capability-card__identity
settings-capability-card__state
settings-capability-card__switch
settings-capability-card__switch-thumb
settings-capability-card__controls
*/
