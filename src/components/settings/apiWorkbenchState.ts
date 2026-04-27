import type { UserApiWorkbenchStage } from '../../services/api/userApiViewState';

type LocalePick = (zhText: string, enText: string) => string;

export type ApiSettingsWorkbenchStage = UserApiWorkbenchStage;
export type ApiSettingsWorkbenchTone = 'neutral' | 'sky' | 'amber' | 'rose' | 'emerald';
export type ApiSettingsWorkbenchBannerTone = 'elevated' | 'info' | 'warning';
export type ApiSettingsWorkbenchPrimaryActionKind =
  | 'create-official'
  | 'create-provider'
  | 'refresh-readonly-snapshot'
  | 'refresh-runtime-health'
  | 'review-sign-in-requirements';

export interface ApiWorkbenchStageMeta {
  stage: ApiSettingsWorkbenchStage;
  tone: ApiSettingsWorkbenchTone;
  title: string;
  description: string;
  interactionLabel: string;
  nextActionLabel: string;
  bannerTone: ApiSettingsWorkbenchBannerTone;
  primaryActionKind: ApiSettingsWorkbenchPrimaryActionKind;
}

export interface ResolveApiWorkbenchStageMetaInput {
  activeTab: 'official' | 'third-party';
  pick: LocalePick;
  showDiagnostics: boolean;
  stage: UserApiWorkbenchStage;
  snapshotHydrationHelper: string;
  userApiPersistenceWarning: string | null;
  userApiPersistenceHelper: string | null;
  backendUnavailableHelper: string | null;
  userApiActionHelper: string | null;
}

export interface ResolveApiWorkbenchDiagnosticsAvailabilityInput {
  hasWorkbenchAccess: boolean;
  isApiReachable?: boolean;
}

export interface ApiWorkbenchDiagnosticsAvailability {
  refreshDisabled: boolean;
  routeActionsDisabled: boolean;
}

export function resolveApiWorkbenchDiagnosticsAvailability(
  input: ResolveApiWorkbenchDiagnosticsAvailabilityInput,
): ApiWorkbenchDiagnosticsAvailability {
  return {
    refreshDisabled: !input.hasWorkbenchAccess,
    routeActionsDisabled: !input.hasWorkbenchAccess || input.isApiReachable === false,
  };
}

export function resolveApiWorkbenchStageMeta(
  input: ResolveApiWorkbenchStageMetaInput,
): ApiWorkbenchStageMeta {
  const stage: ApiSettingsWorkbenchStage = input.stage;

  switch (stage) {
    case 'editable':
      return {
        stage,
        tone: 'emerald',
        title: input.pick('当前可以直接编辑', 'Editing is available'),
        description: input.pick(
          '当前列表、创建、编辑和启停动作都可以继续使用。优先从下面的主操作进入下一步。',
          'List, create, edit, and routing actions are available. Use the primary action below for the next step.',
        ),
        interactionLabel: input.pick('可编辑', 'Editable'),
        nextActionLabel:
          input.activeTab === 'official'
            ? input.pick('新增本地 API', 'Add local API')
            : input.pick('新增供应商', 'Create a provider'),
        bannerTone: 'elevated',
        primaryActionKind:
          input.activeTab === 'official' ? 'create-official' : 'create-provider',
      };
    case 'syncing':
      return {
        stage,
        tone: 'sky',
        title: input.pick('正在同步最新配置', 'Syncing the latest configuration'),
        description: input.snapshotHydrationHelper,
        interactionLabel: input.pick('同步中', 'Syncing'),
        nextActionLabel: input.pick('刷新只读快照', 'Refresh the read-only snapshot'),
        bannerTone: 'info',
        primaryActionKind: 'refresh-readonly-snapshot',
      };
    case 'readonly-fallback':
      return {
        stage,
        tone: 'amber',
        title: input.pick('当前处于只读回退模式', 'Read-only fallback is active'),
        description:
          input.userApiPersistenceWarning
          || input.userApiPersistenceHelper
          || input.pick(
            '当前展示的是可扫描的只读快照。你可以先查看配置，再等待本地运行时恢复。',
            'The page is showing a scan-friendly read-only snapshot while the local runtime recovers.',
          ),
        interactionLabel: input.pick('只读回退', 'Read-only fallback'),
        nextActionLabel: input.pick('重试本地 API 健康检查', 'Retry the local API health check'),
        bannerTone: 'warning',
        primaryActionKind: 'refresh-runtime-health',
      };
    case 'local-api-unavailable':
      return {
        stage,
        tone: 'rose',
        title: input.pick('本地 API 当前不可用', 'The local API is unavailable'),
        description:
          input.backendUnavailableHelper
          || input.pick(
            '当前没有可编辑运行时，也没有可用的只读快照。先检查本地 API，再回到这里继续。',
            'There is no editable runtime and no available read-only snapshot. Check the local API first, then return here.',
          ),
        interactionLabel: input.pick('运行时不可用', 'Runtime unavailable'),
        nextActionLabel: input.pick('重新检查本地 API', 'Check the local API again'),
        bannerTone: 'warning',
        primaryActionKind: 'refresh-runtime-health',
      };
    default:
      return {
        stage,
        tone: 'neutral',
        title: input.pick('需要先登录后再编辑', 'Sign in before editing'),
        description:
          input.userApiActionHelper
          || input.pick(
            '未登录时不会在前端直接保存或编辑 BYOK 密钥。先完成登录，再回来继续配置。',
            'Anonymous sessions cannot save or edit BYOK secrets in the browser. Sign in first, then continue here.',
          ),
        interactionLabel: input.pick('已锁定', 'Locked'),
        nextActionLabel: input.pick('查看登录要求', 'Review sign-in requirements'),
        bannerTone: 'warning',
        primaryActionKind: 'review-sign-in-requirements',
      };
  }
}
