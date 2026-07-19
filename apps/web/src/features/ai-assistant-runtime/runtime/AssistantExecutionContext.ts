import type { AssistantCollaborationMode, AssistantWorkspaceSurface } from '@kk/shared';
import type { CanvasRuntimeState } from '../../ai-takeover/types.ts';
import type { Canvas } from '../../../types/index.ts';
import type { BrowserBridgeClient, BrowserBridgeStatusSnapshot } from '../browser/browserBridge.ts';
import type { DurableGenerationQueue } from '../queue/DurableGenerationQueue.ts';
import type { AgentRunStore } from './AgentRunStore.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';

export type AssistantExecutionTrigger =
  | 'takeover-auto'
  | 'assist-confirmed'
  | 'takeover-confirmed'
  | 'user-action'
  | 'resume';

export interface AssistantConfirmedStepAuthorization {
  stepId: string;
  toolName: string;
  idempotencyKey: string;
  inputFingerprint: string;
}

export interface AssistantConfirmationGrant {
  runId: string;
  planId: string;
  ownerId: string;
  confirmed: true;
  toolNames: readonly string[];
  authorizedSteps: readonly AssistantConfirmedStepAuthorization[];
  authorizationScope: AssistantAuthorizationScopeSnapshot;
  grantedAt: string;
  source: 'user';
}

export interface AssistantAuthorizationScopeSnapshot {
  ownerId: string;
  workspaceSurface: string;
  projectId: string;
  canvasId: string;
  selectedNodeIds: readonly string[];
  selectedModelId: string;
  mutableConfigurationFingerprint: string;
}

export interface AssistantStepVerificationBaseline {
  canvasRevision?: number;
  recentEventIds: string[];
}

export interface AssistantExecutionNotificationPort {
  success: (...args: any[]) => any;
  info: (...args: any[]) => any;
  warning: (...args: any[]) => any;
  error: (...args: any[]) => any;
}

type AssistantHostCallback = (...args: any[]) => any;

/**
 * Web 运行时唯一的 Agent 执行宿主边界。
 *
 * 共享包只保存可跨端传输的 DTO；React、Canvas 与浏览器宿主能力留在 Web。
 * 工具每次执行前都通过 getter 读取实时状态，避免恢复任务使用陈旧闭包。
 */
export interface AssistantExecutionContext {
  runId?: string;
  planId?: string;
  stepId?: string;
  executionOwnerId?: string;
  currentPage: AssistantWorkspaceSurface;
  collaborationMode: AssistantCollaborationMode;
  trigger: AssistantExecutionTrigger;
  signal?: AbortSignal;
  confirmationGrant?: AssistantConfirmationGrant;
  verificationBaseline?: AssistantStepVerificationBaseline;

  activeCanvas?: Canvas;
  selectedNodeIds: string[];
  canvasRuntimeState?: CanvasRuntimeState;
  canvasRevision?: number;
  canvasId?: string;
  getActiveCanvas: () => Canvas | undefined;
  getSelectedNodeIds: () => string[];
  getCanvasRuntimeState: () => CanvasRuntimeState | undefined;

  generationQueue: DurableGenerationQueue;
  runStore: AgentRunStore;
  notify: AssistantExecutionNotificationPort;

  selectedModel?: { id?: string; [key: string]: unknown };
  config?: any;
  ecommerceState?: any;
  browserBridge?: BrowserBridgeClient;
  browserBridgeSnapshot?: BrowserBridgeStatusSnapshot;
  browserAssistantSnapshot?: unknown;

  addPromptNode?: AssistantHostCallback;
  addPromptNodes?: AssistantHostCallback;
  updatePromptNode?: AssistantHostCallback;
  updateNodes?: AssistantHostCallback;
  addImageNodes?: AssistantHostCallback;
  addNoteNode?: AssistantHostCallback;
  addWorkflowNode?: AssistantHostCallback;
  createCard?: AssistantHostCallback;
  convertDrawingsToNote?: AssistantHostCallback;
  updateWorkflowNode?: AssistantHostCallback;
  rasterizeNote?: AssistantHostCallback;
  executeGeneration?: AssistantHostCallback;
  getNextCardPosition?: () => { x: number; y: number };
  arrangeAllNodes?: AssistantHostCallback;
  addGroup?: AssistantHostCallback;
  updateGroup?: AssistantHostCallback;
  setNodeTags?: AssistantHostCallback;
  selectNodes?: AssistantHostCallback;
  setConfig?: AssistantHostCallback;
  onOpenSettings?: AssistantHostCallback;
  openLibrarySurface?: AssistantHostCallback;
  openFavoritesSurface?: AssistantHostCallback;
  openProfileSurface?: AssistantHostCallback;
  focusWorkspace?: AssistantHostCallback;
  onGenerate?: AssistantHostCallback;
  openToolWindowInstance?: AssistantHostCallback;
  updateToolWindowLayout?: AssistantHostCallback;
  setPptEditorMode?: AssistantHostCallback;
  togglePinTool?: AssistantHostCallback;
  controlAudioPlayback?: AssistantHostCallback;
  executeTool?: (
    toolName: string,
    input: unknown,
    extra?: Partial<AssistantExecutionContext>,
  ) => Promise<unknown>;
}

type AssistantToolCoreContext = Pick<
  AssistantExecutionContext,
  | 'runId'
  | 'planId'
  | 'stepId'
  | 'executionOwnerId'
  | 'currentPage'
  | 'collaborationMode'
  | 'trigger'
  | 'signal'
  | 'confirmationGrant'
  | 'verificationBaseline'
  | 'generationQueue'
  | 'runStore'
>;

/** 渐进迁移适配器：核心执行字段有类型，旧宿主回调在领域工具迁移时逐个收紧。 */
export type AssistantToolExecutionContext = Partial<AssistantToolCoreContext> & Record<string, any>;

/** Planner 提供的键不可信；Agent 副作用必须绑定真实 Run 与唯一 step。 */
export function createRunStepIdempotencyKey(runId: string, stepId: string): string {
  return `${runId}:${stepId}`;
}

const ASSISTANT_CONFIRMATION_MAX_AGE_MS = 15 * 60 * 1000;
const ASSISTANT_CONFIRMATION_FUTURE_TOLERANCE_MS = 30 * 1000;

const stableAuthorizationValue = (value: unknown, seen = new Set<object>()): unknown => {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'undefined') return '[undefined]';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => stableAuthorizationValue(item, seen));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableAuthorizationValue(item, seen)]),
  );
};

const stableAuthorizationHash = (value: string): string => value.split('').reduce(
  (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
  2166136261,
).toString(16).padStart(8, '0');

const fingerprintStableAuthorizationValue = (value: unknown): string => {
  const serialized = JSON.stringify(stableAuthorizationValue(value));
  const reversed = Array.from(serialized).reverse().join('');
  return `${stableAuthorizationHash(serialized)}:${stableAuthorizationHash(reversed)}:${serialized.length}`;
};

const callContextGetter = <Value>(getter: unknown, fallback: Value): Value => {
  if (typeof getter !== 'function') return fallback;
  try {
    return (getter as () => Value)();
  } catch {
    return fallback;
  }
};

export function captureAssistantAuthorizationScope(
  context: Record<string, any>,
): AssistantAuthorizationScopeSnapshot {
  const activeCanvas = callContextGetter(context.getActiveCanvas, context.activeCanvas);
  const runtimeState = callContextGetter(context.getCanvasRuntimeState, context.canvasRuntimeState);
  const selectedNodeIds = callContextGetter(context.getSelectedNodeIds, context.selectedNodeIds || []);
  const normalizedSelection = Array.isArray(selectedNodeIds)
    ? Array.from(new Set(selectedNodeIds.map((id) => String(id).trim()).filter(Boolean))).sort()
    : [];
  return {
    ownerId: String(getRuntimeOwnerId() || 'local_user').trim() || 'local_user',
    workspaceSurface: String(context.currentPage || 'unknown'),
    projectId: String(context.projectId || context.workspaceId || ''),
    canvasId: String(activeCanvas?.id || runtimeState?.canvas?.id || context.canvasId || ''),
    selectedNodeIds: normalizedSelection,
    selectedModelId: String(context.selectedModel?.id || context.modelId || ''),
    mutableConfigurationFingerprint: fingerprintStableAuthorizationValue({
      config: context.config ?? null,
      ecommerceState: context.ecommerceState ?? null,
      browserAssistantSnapshot: context.browserAssistantSnapshot ?? null,
      browserBridgeSnapshot: context.browserBridgeSnapshot ?? null,
    }),
  };
}

export function createAssistantScopedInputFingerprint(
  input: unknown,
  context: Record<string, any>,
  authorizationScope: AssistantAuthorizationScopeSnapshot = captureAssistantAuthorizationScope(context),
): string {
  const serialized = JSON.stringify(stableAuthorizationValue({
    input,
    executionScope: authorizationScope,
  }));
  const reversed = Array.from(serialized).reverse().join('');
  return `${stableAuthorizationHash(serialized)}:${stableAuthorizationHash(reversed)}:${serialized.length}`;
}

export function createAssistantStepAuthorization(args: {
  runId: string;
  stepId: string;
  toolName: string;
  input: unknown;
  context: Record<string, any>;
  authorizationScope?: AssistantAuthorizationScopeSnapshot;
}): AssistantConfirmedStepAuthorization {
  const idempotencyKey = createRunStepIdempotencyKey(args.runId, args.stepId);
  const effectiveInput = args.input && typeof args.input === 'object' && !Array.isArray(args.input)
    ? { ...(args.input as Record<string, unknown>), idempotencyKey }
    : args.input;
  return {
    stepId: args.stepId,
    toolName: args.toolName,
    idempotencyKey,
    inputFingerprint: createAssistantScopedInputFingerprint(effectiveInput, args.context, args.authorizationScope),
  };
}

export function isAssistantConfirmationGrantFresh(
  grant: AssistantConfirmationGrant | undefined,
  now = Date.now(),
): boolean {
  if (!grant?.confirmed || typeof grant.grantedAt !== 'string') return false;
  const grantedAt = Date.parse(grant.grantedAt);
  return Number.isFinite(grantedAt)
    && grantedAt <= now + ASSISTANT_CONFIRMATION_FUTURE_TOLERANCE_MS
    && grantedAt >= now - ASSISTANT_CONFIRMATION_MAX_AGE_MS;
}

export function doesAssistantGrantAuthorizeStep(
  grant: AssistantConfirmationGrant | undefined,
  expected: AssistantConfirmedStepAuthorization,
  now = Date.now(),
): boolean {
  if (!isAssistantConfirmationGrantFresh(grant, now)) return false;
  return Boolean(Array.isArray(grant?.authorizedSteps) && grant.authorizedSteps.some((authorization) => (
    authorization.stepId === expected.stepId
    && authorization.toolName === expected.toolName
    && authorization.idempotencyKey === expected.idempotencyKey
    && authorization.inputFingerprint === expected.inputFingerprint
  )));
}

export function sameAssistantStepAuthorizations(
  actual: readonly AssistantConfirmedStepAuthorization[] | undefined,
  expected: readonly AssistantConfirmedStepAuthorization[],
): boolean {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const serialize = (authorization: AssistantConfirmedStepAuthorization) => [
    authorization.stepId,
    authorization.toolName,
    authorization.idempotencyKey,
    authorization.inputFingerprint,
  ].join('\u0000');
  const actualSet = new Set(actual.map(serialize));
  return actualSet.size === expected.length && expected.every((authorization) => actualSet.has(serialize(authorization)));
}

export function createUserActionConfirmation(
  toolName: string,
  input: unknown,
  executionScope: Partial<AssistantExecutionContext> & Record<string, any> = {},
): AssistantToolExecutionContext {
  const runId = `user_action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const planId = `${runId}:plan`;
  const stepId = `${planId}:step:1`;
  const baseContext = {
    ...executionScope,
    runId,
    planId,
    stepId,
    trigger: 'user-action' as const,
  };
  const authorizationScope = captureAssistantAuthorizationScope(baseContext);
  return {
    ...baseContext,
    confirmationGrant: {
      runId,
      planId,
      ownerId: authorizationScope.ownerId,
      confirmed: true,
      toolNames: [toolName],
      authorizationScope,
      authorizedSteps: [createAssistantStepAuthorization({
        runId,
        stepId,
        toolName,
        input,
        context: baseContext,
        authorizationScope,
      })],
      grantedAt: new Date().toISOString(),
      source: 'user',
    },
  };
}
