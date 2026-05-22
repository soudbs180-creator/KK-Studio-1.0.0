import React from 'react';
import { Activity, RefreshCw, Wand2, type LucideIcon } from 'lucide-react';

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
    <div className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">{value}</div>
    {helper ? <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{helper}</div> : null}
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
  warning?: string;
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
};

export const ApiWorkbenchCapabilitySection: React.FC<ApiWorkbenchCapabilitySectionProps> = ({
  pick,
  items,
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
        '把图片、PPT、电商、AI 助手、全局提示词优化和 OCR 各自绑定到链路与模型。',
        'Assign image, PPT, ecommerce, assistant, Global prompt optimizer, and OCR roles to routes and models.',
      )}
      action={<SettingsBadge tone="emerald">{pick('Capability roles', 'Capability roles')}</SettingsBadge>}
    >
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
                <SettingsBadge tone={item.enabled ? 'emerald' : 'neutral'}>
                  {item.enabled ? pick('已启用', 'Enabled') : pick('已停用', 'Disabled')}
                </SettingsBadge>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  aria-label={`${item.title} ${pick('启用', 'Enabled')}`}
                  className={[
                    'settings-capability-card__switch',
                    item.enabled ? 'settings-capability-card__switch--on' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => item.onEnabledChange(!item.enabled)}
                >
                  <span className="settings-capability-card__switch-thumb" />
                </button>
              </div>
            </div>
            {item.warning && item.enabled && (
              <div className="mx-2 mt-1 rounded-[12px] border px-3 py-2 text-[12px] leading-5 text-[var(--state-warning-text)]" style={SETTINGS_WARNING_STYLE}>
                {item.warning}
              </div>
            )}
            <div className="settings-capability-card__controls">
              <SettingSelect
                label={pick('主链路', 'Primary route')}
                value={item.primaryRouteId}
                options={item.routeOptions}
                onChange={item.onPrimaryRouteChange}
                disabled={!item.enabled}
              />
              <SettingSelect
                label={item.role === 'prompt_optimizer'
                  ? pick('优化模型', 'Optimizer model')
                  : pick('模型', 'Model')}
                value={item.primaryModelId}
                options={item.modelOptions}
                onChange={item.onPrimaryModelChange}
                disabled={!item.enabled}
                helper={item.role === 'prompt_optimizer'
                  ? pick('保留需求语义和专业术语。', 'Keeps requirement terms intact.')
                  : undefined}
              />
              <SettingSelect
                label={pick('备用链路', 'Fallback route')}
                value={item.fallbackRouteId}
                options={item.routeOptions}
                onChange={item.onFallbackRouteChange}
                disabled={!item.enabled}
              />
            </div>
          </div>
        ))}
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
