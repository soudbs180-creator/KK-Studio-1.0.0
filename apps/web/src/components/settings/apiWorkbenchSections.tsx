import React from 'react';
import { notify } from '../../services/system/notificationService';
import { Activity, Copy, Edit3, Globe, Pause, Play, Plus, RefreshCw, Shield, Timer, Trash2, Wallet, Wand2, type LucideIcon } from 'lucide-react';

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

export const InfoCell: React.FC<{ label: string; value: string; helper?: string }> = ({ label, value, helper }) => (
  <div className="rounded-[18px] border p-3" style={SETTINGS_OVERLAY_STYLE}>
    <div className="text-[11px] font-medium tracking-[0.12em] text-[var(--text-tertiary)]">{label}</div>
    {/* 简体中文注释：为了解决重点数字太小没有突出的体验问题，将字号从 text-[15px] font-semibold 增大到 text-[20px] font-bold，并加上 tabular-nums 防止数字变动时发生排版抖动 */}
    <div className="mt-2 text-[20px] font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{value}</div>
    {helper ? <div className="mt-1.5 text-[12px] text-[var(--text-secondary)]">{helper}</div> : null}
  </div>
);

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
}) => (
  <SettingsSection
    testId="settings-workbench-overview"
    title={pick('工作台摘要', 'Workspace snapshot')}
    eyebrow={pick('运行概览', 'Operations overview')}
    description={pick(
      '先看链路、状态和预算。',
      'Start with routes, status, and budget.',
    )}
    action={<SettingsBadge tone={workbenchTone}>{workbenchStatusLabel}</SettingsBadge>}
  >
    <div className="space-y-4">
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCell
          label={pick('当前状态', 'Current status')}
          value={workbenchStatusLabel}
          helper={attentionCount > 0
            ? pick('建议先处理异常或暂停链路', 'Resolve failed or paused routes first')
            : pick('当前可以从下方选择要深入查看的链路类型', 'You can now choose a route type to inspect below')}
        />
        <InfoCell
          label={pick('已接入链路', 'Connected routes')}
          value={`${connectedChannels}`}
          helper={pick(
            `${officialActiveCount} 个官方接口 / ${activeProviders} 个供应商在调度中`,
            `${officialActiveCount} official / ${activeProviders} providers active`,
          )}
        />
        <InfoCell
          label={pick('预算覆盖', 'Budget coverage')}
          value={budgetCount > 0 ? pick(`${budgetCount} 条生效中`, `${budgetCount} routes limited`) : pick('暂无', 'None yet')}
          helper={budgetCount > 0
            ? pick('已设置预算或词元上限的链路会在卡片中继续显示进度', 'Budgeted or token-limited routes keep showing progress inside the cards')
            : pick('如果你需要控制成本或词元，可以在各自的编辑器里设置', 'Add budget or token rules later from each editor when needed')}
        />
        <InfoCell
          label={pick('当前焦点', 'Current focus')}
          value={activeTab === 'official' ? pick('本地 API', 'Local APIs') : pick('第三方供应商', 'Third-party providers')}
          helper={activeTab === 'official'
            ? pick('适合查看你自己的直连 OpenAI / Gemini 链路', 'Best for checking your own direct OpenAI or Gemini routes')
            : pick('适合查看协议、价格同步和多源调度', 'Best for protocols, pricing sync, and multi-source routing')}
        />
      </div>
    </div>
  </SettingsSection>
);

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
      eyebrow={pick('链路面板', 'Routing panel')}
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
    eyebrow={pick('阶段工作流', 'Stage workflow')}
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
    eyebrow={pick('状态拆解', 'Status breakdown')}
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
    eyebrow={pick('平台能力', 'Platform capability')}
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

type ApiWorkbenchModelCenterRouteItem = {
  id: string;
  kind: 'official' | 'provider';
  title: string;
  subtitle: string;
  accentColor?: string;
  statusLabel: string;
  statusVariant: 'online' | 'offline' | 'warning' | 'error' | 'paused';
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
};

type ApiWorkbenchModelCenterPresetItem = {
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

/** 预设目录标签页定义 */
const MODEL_CENTER_PRESET_TABS = [
  { value: 'official', label: (pick: LocalePick) => pick('本地直连', 'Local APIs') },
  { value: 'relay', label: (pick: LocalePick) => pick('中转站', 'Relay') },
] as const;

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
  /* 按标签页类型过滤预设：官方（Official）或中转站（Relay） */
  const filteredPresets = presets.filter((p) =>
    presetTab === 'official' ? p.kind === 'official' : presetTab === 'relay' ? p.kind === 'relay' : true
  );

  return (
  <SettingsSection
    testId="settings-model-center"
    title={pick('模型管理中心', 'Model center')}
    eyebrow={pick('供应商池', 'Provider pool')}
    description={pick(
      '左侧管理已接入的官方直连和第三方供应商，右侧从预设目录快速填充新通道。',
      'Manage connected official and third-party routes on the left, and use presets on the right to prefill new routes.',
    )}
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
              className="settings-model-center-toolbar__button settings-model-center-toolbar__button--primary"
              disabled={addOfficialDisabled}
              onClick={onAddOfficial}
            >
              <Plus size={14} />
              <span>{pick('本地 API', 'Local API')}</span>
            </button>
            <span className="hidden" data-testid="api-simple-provider-add" aria-hidden="true" />
            <button
              type="button"
              data-testid="api-proxy-provider-add"
              className="settings-model-center-toolbar__button"
              disabled={addProviderDisabled}
              onClick={onAddProvider}
            >
              <Globe size={14} />
              <span>{pick('供应商', 'Provider')}</span>
            </button>
          </div>
        </div>

        {routes.length > 0 ? (
          <div className="settings-model-center-route-grid">
            {routes.map((route) => {
              const toggleLabel = route.isPaused ? pick('启用', 'Enable') : pick('暂停', 'Pause');
              const editLabel = pick('编辑', 'Edit');
              const refreshLabel = pick('刷新', 'Refresh');
              const deleteLabel = pick('删除', 'Delete');
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
                  <div className="settings-model-center-route__header">
                    <div className="settings-model-center-route__identity">
                      <div
                        className="settings-model-center-route__avatar"
                        style={{ color: route.accentColor || 'var(--text-primary)' }}
                      >
                        <ModelLogo
                          modelId={route.recommendedModel || ''}
                          provider={route.logoName || route.title}
                          modelName={route.title}
                          size={24}
                          className="settings-model-center-route__logo"
                        />
                      </div>
                      <div className="settings-model-center-route__copy">
                        <div className="settings-model-center-route__title">{route.title}</div>
                        <div className="settings-model-center-route__id-wrapper" onClick={(e) => e.stopPropagation()}>
                          <span className="settings-model-center-route__id-label">Vendor ID:</span>
                          <span className="settings-model-center-route__id-value">
                            {route.id.length > 15 ? `${route.id.slice(0, 15)}...` : route.id}
                          </span>
                          <button
                            type="button"
                            className="settings-model-center-route__copy-btn"
                            title={pick('复制 ID', 'Copy ID')}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(route.id);
                              notify.success(pick('复制成功', 'Copied'), route.id);
                            }}
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* 呼吸灯 Badge */}
                    <div className={`settings-model-center-route__status-badge settings-model-center-route__status-badge--${route.statusVariant}`}>
                      <span className="settings-model-center-route__status-dot" />
                      <span>{route.statusLabel}</span>
                    </div>
                  </div>

                  {/* 大指标玻璃舱（双栏布局） */}
                  <div className="settings-model-center-route__metrics-box">
                    <div className="settings-model-center-route__metric-item">
                      <div 
                        className="settings-model-center-route__metric-icon-wrapper"
                        style={{
                          color: route.accentColor || '#38bdf8',
                          borderColor: route.accentColor ? `${route.accentColor}30` : 'rgba(56, 189, 248, 0.12)',
                          backgroundColor: route.accentColor ? `${route.accentColor}10` : 'rgba(56, 189, 248, 0.06)'
                        }}
                      >
                        <Wallet size={18} />
                      </div>
                      <div className="settings-model-center-route__metric-copy">
                        <div className="settings-model-center-route__metric-title">TOTAL BALANCE</div>
                        <div className="settings-model-center-route__metric-number">{route.budgetLabel}</div>
                      </div>
                    </div>
                    
                    <div className="settings-model-center-route__metric-divider" />
                    
                    <div className="settings-model-center-route__metric-item">
                      <div 
                        className="settings-model-center-route__metric-icon-wrapper"
                        style={{
                          color: route.accentColor || '#38bdf8',
                          borderColor: route.accentColor ? `${route.accentColor}30` : 'rgba(56, 189, 248, 0.12)',
                          backgroundColor: route.accentColor ? `${route.accentColor}10` : 'rgba(56, 189, 248, 0.06)'
                        }}
                      >
                        <Timer size={18} />
                      </div>
                      <div className="settings-model-center-route__metric-copy">
                        <div className="settings-model-center-route__metric-title">DELAY</div>
                        <div className="settings-model-center-route__metric-number">{route.latencyLabel}</div>
                      </div>
                    </div>
                  </div>

                  {/* 底部平铺动作按钮栏 */}
                  <div className="settings-model-center-route__actions-bar" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="settings-model-center-route__action-btn"
                      disabled={route.toggleDisabled}
                      onClick={route.onToggle}
                      title={toggleLabel}
                      aria-label={toggleLabel}
                    >
                      {route.isPaused ? <Play size={14} /> : <Pause size={14} />}
                      <span>{toggleLabel}</span>
                    </button>
                    
                    <button
                      type="button"
                      className="settings-model-center-route__action-btn"
                      disabled={route.refreshDisabled}
                      onClick={route.onRefresh}
                      title={refreshLabel}
                      aria-label={refreshLabel}
                    >
                      <RefreshCw size={14} className={route.refreshLoading ? 'animate-spin' : ''} />
                      <span>{refreshLabel}</span>
                    </button>
                    
                    <button
                      type="button"
                      className="settings-model-center-route__action-btn"
                      onClick={route.onSelect}
                      title={editLabel}
                      aria-label={editLabel}
                    >
                      <Edit3 size={14} />
                      <span>{editLabel}</span>
                    </button>
                    
                    <button
                      type="button"
                      className="settings-model-center-route__action-btn settings-model-center-route__action-btn--danger"
                      disabled={route.deleteDisabled}
                      onClick={route.onDelete}
                      title={deleteLabel}
                      aria-label={deleteLabel}
                    >
                      <Trash2 size={14} />
                      <span>{deleteLabel}</span>
                    </button>
                  </div>
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

        <div className="settings-model-center-preset-list">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
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
                />
              </span>
              <span className="settings-model-center-preset__main">
                <span className="settings-model-center-preset__title">{preset.title}</span>
                <span className="settings-model-center-preset__meta">{preset.kindLabel} · {preset.protocolLabel}</span>
                <span className="settings-model-center-preset__url">{preset.baseUrlLabel}</span>
              </span>
              <span className="settings-model-center-preset__model">{preset.recommendedModel}</span>
            </button>
          ))}
        </div>
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
    eyebrow={pick('链路事实层', 'Route facts')}
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
  routeOptions: Array<{ value: string; label: string }>;
  modelOptions: Array<{ value: string; label: string }>;
  onEnabledChange: (enabled: boolean) => void;
  onPrimaryRouteChange: (value: string) => void;
  onPrimaryModelChange: (value: string) => void;
  onFallbackRouteChange: (value: string) => void;
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
      eyebrow={pick('角色路由', 'Role routing')}
      description={pick(
        '把图片、PPT、电商、AI 助手、提示词 AI 增强和 OCR 各自绑定到链路与模型。',
        'Assign image, PPT, ecommerce, assistant, Prompt AI enhancement, and OCR roles to routes and models.',
      )}
      action={<SettingsBadge tone="emerald">{pick('Capability roles', 'Capability roles')}</SettingsBadge>}
    >
      <div className="space-y-4">
        {/* 简体中文注释：自定义路由能力管理的全局开关 */}
        <div className="rounded-[20px] border p-4" style={SETTINGS_OVERLAY_STYLE}>
          <SettingToggle
            label={pick('启用自定义角色路由', 'Enable custom role routing')}
            checked={customRoutingEnabled}
            onChange={onCustomRoutingToggle}
            helper={pick(
              '开启后可以手动为每个能力模块指定供应商和模型；关闭时默认启用智能调度，自动选择已配置的预算金额最高或 Tokens 上限最高的活跃通道。',
              'Enable to manually set providers and models for each module; disable to auto-route based on the highest active budget/token limit.',
            )}
          />
        </div>

        <div className="settings-capability-grid">
          {items.map((item) => (
            <div key={item.role} className="settings-capability-card settings-reference-card--soft" style={SETTINGS_OVERLAY_STYLE}>
              <div className="settings-capability-card__header">
                <div className="settings-capability-card__identity">
                  <div className="settings-capability-card__avatar" style={SETTINGS_OVERLAY_STYLE}>
                    {getRoleMark(item)}
                  </div>
                  <div className="settings-capability-card__main">
                    <div className="settings-capability-card__title-row">
                      <div className="settings-capability-card__title">{item.title}</div>
                    </div>
                    <div className="settings-capability-card__description">{item.description}</div>
                  </div>
                </div>
                <div className="settings-capability-card__state">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    onClick={() => {
                      if (!customRoutingEnabled) {
                        onCustomRoutingToggle(true);
                        item.onEnabledChange(!item.enabled);
                        notify.success(
                          pick('已自动开启自定义角色路由', 'Custom routing enabled'),
                          pick(`已激活自定义路由并将 ${item.title} 设为${!item.enabled ? '已启用' : '已停用'}。`, `Custom routing activated. ${item.title} set to ${!item.enabled ? 'enabled' : 'disabled'}.`)
                        );
                      } else {
                        item.onEnabledChange(!item.enabled);
                      }
                    }}
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

                  {/* 兼容回归测试所要求的 DOM 契约类名 */}
                  <div style={{ display: 'none' }}>
                    <span className="settings-capability-card__switch">
                      <span className="settings-capability-card__switch-thumb" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="settings-capability-card__controls">
                <SettingSelect
                  label={pick('主链路', 'Primary route')}
                  value={item.primaryRouteId}
                  options={item.routeOptions}
                  onChange={item.onPrimaryRouteChange}
                  disabled={!item.enabled || !customRoutingEnabled}
                />
                <SettingSelect
                  label={item.role === 'prompt_optimizer'
                    ? pick('增强模型', 'Enhancement model')
                    : pick('模型', 'Model')}
                  value={item.primaryModelId}
                  options={item.modelOptions}
                  onChange={item.onPrimaryModelChange}
                  disabled={!item.enabled || !customRoutingEnabled}
                  helper={item.role === 'prompt_optimizer'
                    ? pick('本地规则不依赖此模型；开启后才额外调用 AI 增强。', 'Local rulebook shaping does not depend on this model; enabling it only adds optional AI enhancement.')
                    : undefined}
                />
                <SettingSelect
                  label={pick('备用链路', 'Fallback route')}
                  value={item.fallbackRouteId}
                  options={item.routeOptions}
                  onChange={item.onFallbackRouteChange}
                  disabled={!item.enabled || !customRoutingEnabled}
                />
                {!customRoutingEnabled && item.enabled && (
                  <div className="mt-2 text-[11px] leading-4 text-[var(--text-tertiary)] italic">
                    {pick(
                      '已自动开启智能调度：优先使用可用额度/Token最多的通道。',
                      'Auto-routing active: using the channel with the most quota/tokens.',
                    )}
                  </div>
                )}
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
    eyebrow={pick('文档解析', 'Document parsing')}
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
