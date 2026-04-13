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
import { SegmentedControl } from './ui/index';
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
  onOpen,
}) => (
  <div className="rounded-[24px] border p-4 md:p-5" style={SETTINGS_ELEVATED_STYLE}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0 space-y-2">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]"
          style={SETTINGS_OVERLAY_STYLE}
        >
          <Wand2 size={14} />
          <span>{entryContextLabel}</span>
        </div>
        <div className="text-[18px] font-semibold text-[var(--text-primary)]">{title}</div>
        <div className="max-w-3xl text-[13px] leading-6 text-[var(--text-secondary)]">{description}</div>
      </div>

      <div className="w-full max-w-[320px] rounded-[20px] border p-4" style={SETTINGS_OVERLAY_STYLE}>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          {entryContextLabel}
        </div>
        <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{entryActionHelper}</div>
        <div className="mt-3">
          <SettingsActionButton icon={Wand2} tone="primary" onClick={onOpen}>
            {entryActionLabel}
          </SettingsActionButton>
        </div>
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
    title={pick('工作台摘要', 'Workspace snapshot')}
    eyebrow={pick('运行概览', 'Operations overview')}
    description={pick(
      '在进入任意卡片前，先在这里查看当前服务健康、持久化状态和预算压力。',
      'Review current service health, persistence, and budget pressure before jumping into individual cards.',
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
            <div className="rounded-[22px] border px-4 py-3 text-[13px] leading-6 text-[var(--text-secondary)]" style={SETTINGS_ELEVATED_STYLE}>
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
          value={activeTab === 'official' ? pick('官方接口', 'Official endpoints') : pick('第三方供应商', 'Third-party providers')}
          helper={activeTab === 'official'
            ? pick('适合查看直连 OpenAI / Gemini 的稳定链路', 'Best for checking direct OpenAI or Gemini routes')
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
  onChangeTab,
  latencyCards,
  formatLatency,
}) => (
  <SettingsSection
    title={pick('当前视图', 'Current view')}
    eyebrow={pick('链路面板', 'Routing panel')}
    description={pick(
      '先决定你当前要看的是官方接口还是第三方供应商，再进入对应的卡片和编辑器。',
      'Choose whether you want to inspect official endpoints or third-party providers, then move into the matching cards and editor.',
    )}
    action={(
      <SettingsBadge tone={activeTab === 'official' ? 'indigo' : 'emerald'}>
        {activeTab === 'official' ? pick('官方接口视图', 'Official endpoint view') : pick('第三方供应商视图', 'Third-party provider view')}
      </SettingsBadge>
    )}
  >
    <div className="space-y-4">
      <SegmentedControl
        options={[
          { value: 'official', label: pick('官方接口', 'Official endpoints') },
          { value: 'third-party', label: pick('第三方供应商', 'Third-party providers') },
        ]}
        value={activeTab}
        onChange={(value) => onChangeTab(value as TabType)}
      />

      {latencyCards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {latencyCards.map((item) => (
            <InfoCell key={item.id} label={item.label} value={formatLatency(item.latency)} helper={item.helper} />
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            {pick('全局延迟概览', 'Global latency summary')}
          </div>
          <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            {pick(
              '暂无最近一次的延迟检测结果。你可以点击任意卡片上的“刷新”来重新检测连通状态、模型列表和延迟。',
              'No recent latency checks are available yet. Use Refresh on any card to re-check connectivity, models, and latency.',
            )}
          </div>
        </div>
      )}
    </div>
  </SettingsSection>
);

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
  isUsingReadonlyProfileFallback,
  runtimeRouteCount,
}) => (
  <SettingsSection
    title={pick('状态与下一步', 'Status and next step')}
    eyebrow={pick('阶段工作流', 'Stage workflow')}
    description={stageDescription}
    action={(
      <div className="flex flex-wrap items-center gap-2">
        <SettingsBadge tone={stageTone}>{stageInteractionLabel}</SettingsBadge>
        <SettingsActionButton
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {pick('当前阶段', 'Current stage')}
            </div>
            <div className="mt-2 text-[17px] font-semibold text-[var(--text-primary)]">
              {stageTitle}
            </div>
          </div>
          <SettingsActionButton
            icon={primaryActionIcon}
            tone={primaryActionTone}
            onClick={onPrimaryAction}
            loading={primaryActionLoading}
          >
            {stageNextActionLabel}
          </SettingsActionButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCell
          label={pick('当前阶段', 'Stage')}
          value={stageTitle}
          helper={stageDescription}
        />
        <InfoCell
          label={pick('编辑策略', 'Edit policy')}
          value={stageInteractionLabel}
          helper={stage === 'editable'
            ? pick('允许从列表进入创建、编辑、刷新与启停操作。', 'Create, edit, refresh, and toggle actions are available from the list.')
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
          helper={pick('保持一个最重要动作，其它操作继续留在对应卡片或工具位。', 'Keep one primary move here while secondary actions stay inside cards and utilities.')}
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
    title={pick('诊断视图', 'Diagnostics view')}
    eyebrow={pick('状态拆解', 'Status breakdown')}
    description={pick(
      '把连通性、持久化和账户状态拆开看，避免把诊断信息堆进每一张卡片。',
      'Break connectivity, persistence, and account state apart instead of stuffing diagnostics into every card.',
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
    title={pick('平台能力入口', 'Platform capabilities')}
    eyebrow={pick('独立入口', 'Separate entry')}
    description={pick(
      '将平台侧辅助能力和你的本地 BYOK 链路分开展示，避免和供应商卡片混在一起。',
      'Keep platform-managed assistant capabilities separate from your local BYOK routes so they do not blend into provider management cards.',
    )}
    action={<SettingsBadge tone="neutral">{pick('不和供应商卡片混排', 'Separate from provider cards')}</SettingsBadge>}
  >
    <PlatformAssistantEntryCard
      title={pick('平台辅助 AI', 'Platform Assistant AI')}
      description={pick(
        '平台侧的辅助 AI 会从独立入口接入，和你的第三方供应商管理分开，便于你一眼区分哪些能力来自本地 BYOK，哪些来自平台侧。',
        'Platform assistant AI is surfaced as a dedicated entry so you can immediately separate local BYOK provider management from platform-side capabilities.',
      )}
      entryContextLabel={pick('平台能力入口', 'Platform-managed entry')}
      localApiLabel={pick('用户本地 API', 'User-managed local APIs')}
      localApiValue={pick('继续使用你的 BYOK', 'Keep your BYOK routes')}
      localApiHelper={pick(
        '你的 Base URL、API Key、模型同步、预算规则和路由状态仍然在下面按本地优先方式维护。',
        'Your base URL, API key, model sync, budget rules, and routing state stay managed below in the local-first BYOK flow.',
      )}
      platformLabel={pick('平台能力', 'Platform capability')}
      platformValue={pick('单独的平台入口', 'Separate platform entry')}
      platformHelper={pick(
        '平台侧的辅助 AI 会从这里进入，不和本地 API Key、模型路由或预算规则混在一起。',
        'Platform assistant capabilities enter here without mixing with local API keys, routing, or budget rules.',
      )}
      entryActionLabel={pick('打开平台辅助 AI 入口', 'Open platform assistant entry')}
      entryActionHelper={pick(
        '当前先保留入口与说明，后续再接完整的平台辅助流程。',
        'This keeps the entry and explanation visible now without wiring the full platform assistant flow yet.',
      )}
      onOpen={onOpenPlatformAssistant}
    />
  </SettingsSection>
);
