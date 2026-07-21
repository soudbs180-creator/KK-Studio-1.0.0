// 简体中文：工具注册表与安全等级 (Tool Registry)
// 职责：管理所有 Agent 工具的注册、获取、安全审计与执行日志

import type {
  AgentFailureClass,
  AgentToolCallLog,
  AgentToolCallStatus,
  ToolPermission,
} from '../../ai-takeover/types.ts';
import {
  createAssistantScopedInputFingerprint,
  createAssistantStepAuthorization,
  createRunStepIdempotencyKey,
  doesAssistantGrantAuthorizeStep,
  type AssistantExecutionContext,
  type AssistantToolExecutionContext,
} from '../runtime/AssistantExecutionContext.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';

const MAX_TOOL_LOGS = 200;
const MAX_IDEMPOTENCY_RECORDS_PER_OWNER = 200;
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;
const IDEMPOTENCY_RECORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IDEMPOTENCY_STORAGE_PREFIX = 'kk_agent_tool_idempotency_v2';

interface VerifiedToolExecutionRecord {
  ownerId: string;
  toolName: string;
  idempotencyKey: string;
  inputFingerprint: string;
  output: unknown;
  status: 'success' | 'partial_success';
  verifiedAt: string;
  expiresAt: number;
}

interface InFlightToolExecution {
  inputFingerprint: string;
  promise: Promise<any>;
}

let standaloneInvocationSequence = 0;

const createStandaloneRunId = (toolName: string): string => {
  standaloneInvocationSequence += 1;
  return `standalone_${toolName}_${Date.now()}_${standaloneInvocationSequence}_${Math.random().toString(36).slice(2, 9)}`;
};

interface IdempotencyKeyResolution {
  key: string;
  error?: string;
}

const normalizeIdempotencyKey = (rawValue: unknown, fallback: string): IdempotencyKeyResolution => {
  const safeFallback = String(fallback || 'invalid-idempotency-key').trim().slice(0, MAX_IDEMPOTENCY_KEY_LENGTH)
    || 'invalid-idempotency-key';
  if (rawValue === undefined) return { key: safeFallback };
  if (typeof rawValue !== 'string') {
    return { key: safeFallback, error: 'Idempotency key must be a string.' };
  }
  const key = rawValue.trim();
  if (!key) return { key: safeFallback, error: 'Idempotency key cannot be empty.' };
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return {
      key: safeFallback,
      error: `Idempotency key cannot exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
    };
  }
  return { key };
};

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
};

const stableHash = (value: string): string => value.split('').reduce(
  (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
  2166136261,
).toString(16).padStart(8, '0');

const isPlainJsonValue = (value: unknown, seen = new Set<object>()): boolean => {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((item) => isPlainJsonValue(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value as Record<string, unknown>).every((item) => isPlainJsonValue(item, seen));
};

export type AgentToolEffect = 'read' | 'navigation' | 'mutation';
export type AgentToolImpactScope = 'none' | 'selection' | 'canvas' | 'workspace' | 'external' | 'account';
export type AgentToolCostKind = 'none' | 'credits' | 'provider' | 'variable' | 'unknown';

export interface AgentToolControlMetadata {
  effect: AgentToolEffect;
  impact: {
    scope: AgentToolImpactScope;
    summary: string;
    cardinality?: 'single' | 'multiple' | 'unknown';
  };
  cost: {
    kind: AgentToolCostKind;
    summary: string;
  };
  recovery: {
    cancellable: boolean;
    reversible: boolean;
    retryable: boolean;
    cancelToolName?: string;
  };
  idempotency: {
    required: boolean;
    keyField: 'idempotencyKey';
  };
  failure: {
    categories: AgentFailureClass[];
    defaultRetryable: boolean;
  };
}

export type AgentToolControlOverrides = {
  effect?: AgentToolEffect;
  impact?: Partial<AgentToolControlMetadata['impact']>;
  cost?: Partial<AgentToolControlMetadata['cost']>;
  recovery?: Partial<AgentToolControlMetadata['recovery']>;
  idempotency?: Partial<AgentToolControlMetadata['idempotency']>;
  failure?: Partial<AgentToolControlMetadata['failure']>;
};

const READ_ONLY_TOOLS = new Set([
  'assets.resolveOriginals',
  'capabilities.listAvailable',
  'browser.checkLocalLlm',
  'browser.extractProduct',
  'browser.getStatus',
  'browser.inspectPage',
  'canvas.getSelectedNodes',
  'canvas.getState',
  'generation.getJobStatus',
  'getModelCapabilities',
  'knowledge.searchProject',
  'optimizePromptLocally',
  'provider.getModelCapabilities',
]);

const NAVIGATION_TOOLS = new Set([
  'browser.openAssistant',
  'browser.openDesktopProject',
  'highlightElement',
  'locateApiCard',
  'locateCard',
  'navigateToSurface',
  'openSettings',
  'ui.highlightElement',
  'ui.locateApiCard',
  'ui.navigateToSurface',
  'ui.openSettings',
]);

const CONFIRM_TOOLS = new Set([
  'assets.zipOriginals',
  'cancelBatchGeneration',
  'ecommerce.createBatchTransformJob',
  'generation.createAudioJob',
  'generation.createAudioTask',
  'generation.createBatchJob',
  'generation.cancelJob',
  'generation.createVideoJob',
  'generation.retryJob',
  'generation.resumeJob',
  'generation.start',
  'generation.submitComposer',
  'knowledge.recordChange',
  'skills.upsertSkill',
  'startBatchGeneration',
  'startGeneration',
  'submitPromptComposer',
  'workflow.controlPanel',
  'ui.recordLayoutChange',
  'zipOutputs',
]);

const DANGEROUS_TOOLS = new Set([
  'browser.publishDraft',
  'browser.writeBackDom',
]);

const COST_TOOLS = new Set([
  'browser.generateExternal',
  'ecommerce.createBatchTransformJob',
  'generation.createAudioJob',
  'generation.createAudioTask',
  'generation.createBatchJob',
  'generation.createVideoJob',
  'generation.retryJob',
  'generation.resumeJob',
  'generation.start',
  'generation.submitComposer',
  'startBatchGeneration',
  'startGeneration',
  'submitPromptComposer',
]);

const REVERSIBLE_LOCAL_TOOLS = new Set([
  'audio.playbackControl',
  'canvas.arrangeNodes',
  'canvas.convertDrawingsToNote',
  'canvas.createAudioCard',
  'canvas.createCard',
  'canvas.createPromptCards',
  'canvas.rasterizeNote',
  'changeMode',
  'fillInputPrompt',
  'fillPrompt',
  'generation.pauseJob',
  'generation.resumeJob',
  'prompt.fillPrompt',
  'prompt.optimizeInput',
  'ui.openToolWindow',
  'ui.pinTool',
  'ui.switchPptEditorMode',
  'ui.updateWindowLayout',
  'workflow.createPanel',
]);

const RECOVERABLE_JOB_CREATION_TOOLS = new Set([
  'ecommerce.createBatchTransformJob',
  'generation.createAudioJob',
  'generation.createAudioTask',
  'generation.createBatchJob',
  'generation.createVideoJob',
  'startBatchGeneration',
  'startGeneration',
]);

const resolveToolEffect = (name: string): AgentToolEffect => {
  if (READ_ONLY_TOOLS.has(name)) return 'read';
  if (NAVIGATION_TOOLS.has(name)) return 'navigation';
  return 'mutation';
};

const resolveToolPermission = (
  name: string,
  permission: ToolPermission,
  control: AgentToolControlMetadata,
): ToolPermission => {
  if (name === 'fillApiKey') return 'forbidden';
  if (DANGEROUS_TOOLS.has(name)) return 'dangerous';
  if (CONFIRM_TOOLS.has(name)) return 'confirm';
  if (permission === 'safe' && control.effect === 'mutation' && !control.recovery.reversible) return 'confirm';
  return permission;
};

const inferControlMetadata = (name: string, overrides?: AgentToolControlOverrides): AgentToolControlMetadata => {
  const effect = overrides?.effect || resolveToolEffect(name);
  const hasCost = COST_TOOLS.has(name);
  const isExternal = name.startsWith('browser.');
  const reversible = effect === 'mutation' && REVERSIBLE_LOCAL_TOOLS.has(name);
  const cancellable = effect === 'mutation' && RECOVERABLE_JOB_CREATION_TOOLS.has(name);
  const impactScope: AgentToolImpactScope = effect === 'read'
    ? 'none'
    : isExternal
      ? 'external'
      : name.startsWith('canvas.') || name === 'fillPrompt' || name === 'locateCard'
        ? 'canvas'
        : 'workspace';

  const base: AgentToolControlMetadata = {
    effect,
    impact: {
      scope: impactScope,
      summary: effect === 'read'
        ? '读取当前工作区状态，不修改用户数据。'
        : effect === 'navigation'
          ? '切换或聚焦工作区界面，不执行生成或账户操作。'
          : `修改 ${impactScope === 'external' ? '外部页面' : impactScope === 'canvas' ? '当前画布' : '当前工作区'} 状态。`,
      cardinality: effect === 'mutation' ? 'unknown' : 'single',
    },
    cost: {
      kind: hasCost ? 'variable' : 'none',
      summary: hasCost ? '可能消耗积分或上游 Provider 配额，执行前必须展示估算。' : '不产生模型或积分费用。',
    },
    recovery: {
      cancellable,
      reversible,
      retryable: hasCost || name.startsWith('generation.'),
      cancelToolName: cancellable ? 'generation.cancelJob' : undefined,
    },
    idempotency: {
      required: effect === 'mutation',
      keyField: 'idempotencyKey',
    },
    failure: {
      categories: ['validation', 'permission', 'setup', 'network', 'provider', 'verification', 'cancelled', 'unknown'],
      defaultRetryable: hasCost || name.startsWith('generation.'),
    },
  };

  const merged = {
    ...base,
    ...overrides,
    impact: { ...base.impact, ...overrides?.impact },
    cost: { ...base.cost, ...overrides?.cost },
    recovery: { ...base.recovery, ...overrides?.recovery },
    idempotency: { ...base.idempotency, ...overrides?.idempotency },
    failure: { ...base.failure, ...overrides?.failure },
  };
  return {
    ...merged,
    idempotency: {
      ...merged.idempotency,
      required: merged.effect === 'mutation' ? true : merged.idempotency.required,
      keyField: 'idempotencyKey',
    },
  };
};

const resolveFreshToolContext = (ctx: AssistantToolExecutionContext): AssistantToolExecutionContext => {
  const activeCanvas = typeof ctx?.getActiveCanvas === 'function'
    ? ctx.getActiveCanvas()
    : ctx?.activeCanvas;
  const selectedNodeIds = typeof ctx?.getSelectedNodeIds === 'function'
    ? ctx.getSelectedNodeIds()
    : ctx?.selectedNodeIds;
  const canvasRuntimeState = typeof ctx?.getCanvasRuntimeState === 'function'
    ? ctx.getCanvasRuntimeState()
    : ctx?.canvasRuntimeState;

  return {
    ...ctx,
    activeCanvas,
    selectedNodeIds,
    canvasRuntimeState,
    canvasRevision: activeCanvas?.lastModified || ctx?.canvasRevision || 0,
  };
};

export interface AgentToolDefinition<Input = any, Output = any> {
  name: string;
  description: string;
  permission: ToolPermission;
  inputSchema: any;
  outputSchema?: any;
  control?: AgentToolControlOverrides;
  inputValidator?: { parse: (input: unknown) => Input };
  verify?: (
    output: Output,
    input: Input,
    ctx: AssistantToolExecutionContext
  ) => Promise<boolean | { success: boolean; message?: string }> | boolean | { success: boolean; message?: string };
  handler: (input: Input, ctx: AssistantToolExecutionContext) => Promise<Output>;
}

export interface ResolvedAgentToolDefinition<Input = any, Output = any>
  extends Omit<AgentToolDefinition<Input, Output>, 'control' | 'inputValidator' | 'verify' | 'permission'> {
  permission: ToolPermission;
  control: AgentToolControlMetadata;
  inputValidator: { parse: (input: unknown) => Input };
  verify: NonNullable<AgentToolDefinition<Input, Output>['verify']>;
}

const createSchemaInputValidator = (schema: any) => ({
  parse(input: unknown): any {
    const normalizedInput = input === undefined ? {} : input;
    if (normalizedInput === null || typeof normalizedInput !== 'object' || Array.isArray(normalizedInput)) {
      throw new TypeError('Tool input must be a JSON object.');
    }
    const record = normalizedInput as Record<string, unknown>;
    for (const field of Array.isArray(schema?.required) ? schema.required : []) {
      if (record[field] === undefined || record[field] === null || record[field] === '') {
        throw new TypeError(`Missing required tool input field: ${field}`);
      }
    }
    for (const [field, definition] of Object.entries(schema?.properties || {})) {
      const value = record[field];
      if (value === undefined) continue;
      const expectedType = String((definition as { type?: unknown }).type || '');
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (expectedType && expectedType !== actualType) {
        throw new TypeError(`Tool input field ${field} must be ${expectedType}.`);
      }
      const allowedValues = (definition as { enum?: unknown }).enum;
      if (Array.isArray(allowedValues) && !allowedValues.includes(value)) {
        throw new TypeError(`Tool input field ${field} is not an allowed value.`);
      }
    }
    return normalizedInput;
  },
});

const defaultOutcomeVerifier = (output: unknown): boolean | { success: boolean; message?: string } => {
  if (!output || typeof output !== 'object') return true;
  const result = output as Record<string, unknown>;
  const executionOutcome = String(result.executionOutcome || '').toLowerCase();
  if (
    result.success === false
    || executionOutcome === 'failed'
    || executionOutcome === 'cancelled'
    || executionOutcome === 'rolled_back'
    || executionOutcome === 'rolled_back_failure'
  ) {
    return {
      success: false,
      message: typeof result.message === 'string' ? result.message : `Tool reported ${executionOutcome || 'failure'}.`,
    };
  }
  return true;
};

const defaultMutationOutcomeVerifier = (output: unknown): boolean | { success: boolean; message?: string } => {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { success: false, message: 'Mutation completed without structured outcome evidence.' };
  }
  const result = output as Record<string, unknown>;
  if (result.success === false || result.ok === false) {
    return {
      success: false,
      message: typeof result.message === 'string' ? result.message : 'Mutation reported failure.',
    };
  }
  const executionOutcome = String(result.executionOutcome || '').toLowerCase();
  if (result.success === true || result.ok === true || executionOutcome === 'success' || executionOutcome === 'partial_success') {
    return true;
  }
  const hasScalarEvidence = [
    'id', 'jobId', 'nodeId', 'updatedAt',
  ].some((key) => typeof result[key] === 'string' && String(result[key]).trim().length > 0);
  const hasCollectionEvidence = ['nodeIds', 'items', 'results'].some((key) => (
    Array.isArray(result[key]) && (result[key] as unknown[]).length > 0
  ));
  const hasCountEvidence = ['count', 'successCount', 'selectedCount', 'affectedCount', 'createdCount', 'updatedCount']
    .some((key) => Number(result[key]) > 0);
  if (hasScalarEvidence || hasCollectionEvidence || hasCountEvidence) {
    return true;
  }
  return { success: false, message: 'Mutation completed without structured outcome evidence.' };
};

const normalizeToolDefinition = <Input, Output>(
  tool: AgentToolDefinition<Input, Output>,
): ResolvedAgentToolDefinition<Input, Output> => {
  const control = inferControlMetadata(tool.name, tool.control);
  return {
    ...tool,
    permission: resolveToolPermission(tool.name, tool.permission, control),
    control,
    inputValidator: tool.inputValidator || createSchemaInputValidator(tool.inputSchema),
    verify: tool.verify || (control.effect === 'mutation' ? defaultMutationOutcomeVerifier : defaultOutcomeVerifier),
  };
};

const classifyFailure = (error: unknown): AgentFailureClass => {
  const code = String((error as { code?: unknown })?.code || '').toUpperCase();
  const message = String((error as { message?: unknown })?.message || error || '').toLowerCase();
  if (code === 'ABORT_ERR' || code === 'CANCELLED' || message.includes('abort') || message.includes('cancel')) return 'cancelled';
  if (code === 'SETUP_REQUIRED' || code === 'CAPABILITY_UNAVAILABLE') return 'setup';
  if (code === 'VERIFICATION_FAILED') return 'verification';
  if (message.includes('confirm') || message.includes('forbidden') || message.includes('permission')) return 'permission';
  if (error instanceof TypeError || message.includes('validat') || message.includes('input')) return 'validation';
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) return 'network';
  if (message.includes('provider') || message.includes('quota') || message.includes('rate limit')) return 'provider';
  return 'unknown';
};

const outputStatus = (output: unknown): AgentToolCallStatus | undefined => {
  if (!output || typeof output !== 'object') return undefined;
  const result = output as Record<string, unknown>;
  const executionOutcome = String(result.executionOutcome || '').toLowerCase();
  if (executionOutcome === 'completed_with_errors' || executionOutcome === 'partial_success') return 'partial_success';
  if (executionOutcome === 'rolled_back' || executionOutcome === 'rolled_back_failure') return 'rolled_back';
  if (executionOutcome === 'cancelled') return 'cancelled';
  if (executionOutcome === 'retryable_failure' || ((result.success === false || result.ok === false) && result.retryable === true)) return 'retryable_failure';
  if (executionOutcome === 'failed' || result.success === false || result.ok === false) return 'failed';
  return undefined;
};

const SENSITIVE_AUDIT_FIELD_NAMES = new Set([
  'authorization',
  'proxyauthorization',
  'apikey',
  'xapikey',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'sessiontoken',
  'csrftoken',
  'secret',
  'clientsecret',
  'webhooksecret',
  'privatekey',
  'signingkey',
  'encryptionkey',
  'password',
  'passwd',
  'cookie',
  'setcookie',
  'sessioncookie',
  'credential',
  'credentials',
  'databaseurl',
  'connectionstring',
  'dsn',
]);

const isSensitiveAuditField = (fieldName: string): boolean => {
  const normalized = fieldName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return SENSITIVE_AUDIT_FIELD_NAMES.has(normalized)
    || normalized.endsWith('authorization')
    || normalized.endsWith('apikey')
    || normalized.endsWith('accesstoken')
    || normalized.endsWith('refreshtoken')
    || normalized.endsWith('sessiontoken')
    || normalized.endsWith('secret')
    || normalized.endsWith('password')
    || normalized.endsWith('privatekey')
    || normalized.endsWith('credential')
    || normalized.endsWith('cookie');
};

const redactSensitiveAuditText = (value: string): string => value
  .replace(
    /\b(authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n]+/gi,
    '$1: ***',
  )
  .replace(
    /([?&](?:access[_-]?token|api[_-]?key|password|passwd|secret|token|cookie|authorization)=)[^&#\s"']*/gi,
    '$1***',
  )
  .replace(
    /\b(access[_-]?token|api[_-]?key|password|passwd|secret|token|cookie|authorization)\s*([=:])\s*(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi,
    (_match, key: string, separator: string) => `${key}${separator}${separator === ':' ? ' ' : ''}***`,
  )
  .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer ***')
  .replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, 'Basic ***')
  .replace(/\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^@\s/]+@/gi, '$1://***@')
  .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, 'jwt.***')
  .replace(/sk-[a-zA-Z0-9_\-]{8,}/gi, 'sk-***')
  .replace(/AIza[a-zA-Z0-9_\-]{20,}/g, 'AIza***')
  .replace(/[A-Za-z0-9_\-]{48,}/g, '***')
  .slice(0, 500);

const sanitizeToolAuditValue = (
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown => {
  if (depth > 12) return '[max-depth]';
  if (typeof value === 'string') {
    return redactSensitiveAuditText(value);
  }
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeToolAuditValue(item, seen, depth + 1));
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = isSensitiveAuditField(key)
      ? '***'
      : sanitizeToolAuditValue(nestedValue, seen, depth + 1);
  }
  return sanitized;
};

export const redactToolSummary = (value: unknown): string => {
  try {
    return redactSensitiveAuditText(JSON.stringify(sanitizeToolAuditValue(value)));
  } catch {
    return '[unserializable]';
  }
};

export const redactToolText = (value: unknown): string => {
  if (typeof value === 'string') return redactSensitiveAuditText(value);
  if (value === undefined || value === null) return '';
  return redactToolSummary(value);
};

const PERSISTABLE_TOOL_RECEIPT_FIELDS = new Set([
  'success',
  'ok',
  'executionOutcome',
  'id',
  'jobId',
  'nodeId',
  'nodeIds',
  'canvasId',
  'groupId',
  'status',
  'revision',
  'count',
  'successCount',
  'failedCount',
  'promptCount',
  'selectedCount',
  'affectedCount',
  'createdCount',
  'updatedCount',
  'retryingCount',
  'completedCount',
  'runningCount',
  'queuedCount',
  'alreadyActive',
  'updatedAt',
]);

const isPersistableToolReceiptValue = (value: unknown): boolean => {
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    return value.length <= 300 && redactToolText(value) === value;
  }
  if (Array.isArray(value)) {
    return value.length <= 200 && value.every((item) => (
      typeof item === 'string' && item.length <= 300 && redactToolText(item) === item
    ));
  }
  return false;
};

const isPersistableToolReceipt = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length > 0 && entries.every(([key, nestedValue]) => (
    PERSISTABLE_TOOL_RECEIPT_FIELDS.has(key) && isPersistableToolReceiptValue(nestedValue)
  ));
};

export class AgentToolRegistry {
  private tools = new Map<string, ResolvedAgentToolDefinition>();
  private readonly logsByOwner = new Map<string, AgentToolCallLog[]>();
  private readonly inFlightExecutions = new Map<string, InFlightToolExecution>();
  private readonly verifiedExecutions = new Map<string, VerifiedToolExecutionRecord>();

  private appendLog(log: AgentToolCallLog, ownerId = this.resolveIdempotencyOwnerId()): void {
    const normalizedOwnerId = String(ownerId || '').trim().slice(0, 200) || 'local_user';
    const logs = this.logsByOwner.get(normalizedOwnerId) || [];
    logs.push({
      ...log,
      inputSummary: redactToolText(log.inputSummary),
      outputSummary: log.outputSummary ? redactToolText(log.outputSummary) : undefined,
      error: log.error ? redactToolText(log.error) : undefined,
      errorCode: log.errorCode ? redactToolText(log.errorCode) : undefined,
    });
    if (logs.length > MAX_TOOL_LOGS) {
      logs.splice(0, logs.length - MAX_TOOL_LOGS);
    }
    this.logsByOwner.set(normalizedOwnerId, logs);
  }

  private resolveIdempotencyOwnerId(): string {
    return String(getRuntimeOwnerId() || 'local_user').trim().slice(0, 200) || 'local_user';
  }

  private idempotencyMemoryKey(ownerId: string, toolName: string, idempotencyKey: string): string {
    return `${ownerId}\u0000${toolName}\u0000${idempotencyKey}`;
  }

  private idempotencyStorageOwnerPrefix(ownerId: string): string {
    return `${IDEMPOTENCY_STORAGE_PREFIX}:owner:${encodeURIComponent(ownerId)}:entry:`;
  }

  private idempotencyStorageKey(ownerId: string, toolName: string, idempotencyKey: string): string {
    return `${this.idempotencyStorageOwnerPrefix(ownerId)}${stableHash(`${toolName}\u0000${idempotencyKey}`)}`;
  }

  private deleteVerifiedExecution(ownerId: string, toolName: string, idempotencyKey: string): void {
    this.verifiedExecutions.delete(this.idempotencyMemoryKey(ownerId, toolName, idempotencyKey));
    try {
      getBrowserStorage()?.removeItem(this.idempotencyStorageKey(ownerId, toolName, idempotencyKey));
    } catch {
      // 持久缓存清理失败不会阻断真实工具执行。
    }
  }

  private pruneVerifiedExecutionMemory(ownerId: string, now = Date.now()): void {
    for (const [key, record] of this.verifiedExecutions) {
      if (!Number.isFinite(record.expiresAt) || record.expiresAt <= now) {
        this.verifiedExecutions.delete(key);
      }
    }
    const ownerRecords = [...this.verifiedExecutions.entries()]
      .filter(([, record]) => record.ownerId === ownerId);
    ownerRecords
      .slice(0, Math.max(0, ownerRecords.length - MAX_IDEMPOTENCY_RECORDS_PER_OWNER))
      .forEach(([key]) => this.verifiedExecutions.delete(key));
  }

  private readVerifiedExecution(
    ownerId: string,
    toolName: string,
    idempotencyKey: string,
  ): VerifiedToolExecutionRecord | undefined {
    const memoryKey = this.idempotencyMemoryKey(ownerId, toolName, idempotencyKey);
    const inMemory = this.verifiedExecutions.get(memoryKey);
    if (inMemory) {
      if (inMemory.expiresAt > Date.now()) return inMemory;
      this.deleteVerifiedExecution(ownerId, toolName, idempotencyKey);
    }
    try {
      const raw = getBrowserStorage()?.getItem(this.idempotencyStorageKey(ownerId, toolName, idempotencyKey));
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as VerifiedToolExecutionRecord;
      if (
        parsed.ownerId !== ownerId
        || parsed.toolName !== toolName
        || parsed.idempotencyKey !== idempotencyKey
        || typeof parsed.inputFingerprint !== 'string'
        || parsed.inputFingerprint.length === 0
        || !['success', 'partial_success'].includes(parsed.status)
        || !Number.isFinite(parsed.expiresAt)
        || parsed.expiresAt <= Date.now()
      ) {
        this.deleteVerifiedExecution(ownerId, toolName, idempotencyKey);
        return undefined;
      }
      this.verifiedExecutions.set(memoryKey, parsed);
      this.pruneVerifiedExecutionMemory(ownerId);
      return parsed;
    } catch {
      this.deleteVerifiedExecution(ownerId, toolName, idempotencyKey);
      return undefined;
    }
  }

  private writeVerifiedExecution(record: VerifiedToolExecutionRecord): void {
    this.verifiedExecutions.set(
      this.idempotencyMemoryKey(record.ownerId, record.toolName, record.idempotencyKey),
      record,
    );
    this.pruneVerifiedExecutionMemory(record.ownerId);
    if (!isPlainJsonValue(record.output) || !isPersistableToolReceipt(record.output)) return;
    try {
      const storage = getBrowserStorage();
      if (!storage) return;
      const serialized = JSON.stringify(record);
      if (serialized.length > 100_000) return;
      storage.setItem(
        this.idempotencyStorageKey(record.ownerId, record.toolName, record.idempotencyKey),
        serialized,
      );
      const prefix = this.idempotencyStorageOwnerPrefix(record.ownerId);
      const records: Array<{ key: string; verifiedAt: string; expiresAt: number; insertionIndex: number }> = [];
      const ownerStorageKeys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) ownerStorageKeys.push(key);
      }
      for (const [insertionIndex, key] of ownerStorageKeys.entries()) {
        try {
          const parsed = JSON.parse(storage.getItem(key) || '{}') as Partial<VerifiedToolExecutionRecord>;
          if (!Number.isFinite(parsed.expiresAt) || Number(parsed.expiresAt) <= Date.now()) {
            storage.removeItem(key);
          } else {
            records.push({
              key,
              verifiedAt: String(parsed.verifiedAt || ''),
              expiresAt: Number(parsed.expiresAt),
              insertionIndex,
            });
          }
        } catch {
          storage.removeItem(key);
        }
      }
      records
        .slice(0, Math.max(0, records.length - MAX_IDEMPOTENCY_RECORDS_PER_OWNER))
        .forEach(({ key }) => storage.removeItem(key));
    } catch {
      // localStorage 只是 owner-scoped 幂等投影；领域幂等键仍会传给底层工具。
    }
  }

  private hasExecutionPermission(
    tool: ResolvedAgentToolDefinition,
    runId: string,
    runtimeContext: AssistantToolExecutionContext,
    input: unknown,
  ): boolean {
    if (tool.permission === 'forbidden') return false;
    if (tool.permission !== 'confirm' && tool.permission !== 'dangerous') return true;
    const grant = runtimeContext.confirmationGrant;
    const currentOwnerId = this.resolveIdempotencyOwnerId();
    const sourceAllowed = grant?.source === 'user';
    const planId = String(runtimeContext.planId || grant?.planId || '');
    const stepId = String(runtimeContext.stepId || '');
    if (
      !sourceAllowed
      || grant?.ownerId !== currentOwnerId
      || runtimeContext.executionOwnerId !== currentOwnerId
      || grant?.runId !== runId
      || grant?.planId !== planId
      || !stepId
    ) return false;
    return doesAssistantGrantAuthorizeStep(grant, createAssistantStepAuthorization({
      runId,
      stepId,
      toolName: tool.name,
      input,
      context: runtimeContext,
    }));
  }

  private appendIdempotencyReuseLog(
    name: string,
    runId: string,
    runtimeContext: AssistantToolExecutionContext,
    input: unknown,
    record: VerifiedToolExecutionRecord,
  ): void {
    this.appendLog({
      id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      runId,
      stepId: runtimeContext.stepId,
      toolName: name,
      inputSummary: redactToolSummary(input),
      outputSummary: redactToolSummary(record.output),
      status: record.status,
      outcome: record.status,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      idempotencyKey: record.idempotencyKey,
    }, record.ownerId);
  }

  private createIdempotencyConflict(
    name: string,
    runId: string,
    runtimeContext: AssistantToolExecutionContext,
    input: unknown,
    idempotencyKey: string,
  ): Error & { code: string } {
    const error = new Error(`Idempotency key was already used with different input for tool: ${name}`) as Error & { code: string };
    error.code = 'IDEMPOTENCY_CONFLICT';
    this.appendLog({
      id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      runId,
      stepId: runtimeContext.stepId,
      toolName: name,
      inputSummary: redactToolSummary(input),
      status: 'failed',
      failureClass: 'validation',
      retryable: false,
      errorCode: error.code,
      error: error.message,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      idempotencyKey,
    }, runtimeContext.executionOwnerId || this.resolveIdempotencyOwnerId());
    return error;
  }

  register<Input, Output>(tool: AgentToolDefinition<Input, Output>) {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具已注册: ${tool.name}`);
    }
    this.tools.set(tool.name, normalizeToolDefinition(tool) as ResolvedAgentToolDefinition);
  }

  getTool(name: string): ResolvedAgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ResolvedAgentToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getLogs(ownerId = this.resolveIdempotencyOwnerId()): AgentToolCallLog[] {
    const normalizedOwnerId = String(ownerId || '').trim().slice(0, 200) || 'local_user';
    return [...(this.logsByOwner.get(normalizedOwnerId) || [])];
  }

  clearLogs(): void {
    this.logsByOwner.clear();
  }

  async execute(name: string, input: unknown, ctx: AssistantToolExecutionContext): Promise<any> {
    const tool = this.getTool(name);
    const runtimeContext = resolveFreshToolContext(ctx);
    const executionOwnerId = String(runtimeContext.executionOwnerId || this.resolveIdempotencyOwnerId());
    const runId = runtimeContext.runId
      || runtimeContext.confirmationGrant?.runId
      || createStandaloneRunId(name);
    const executionContext = {
      ...runtimeContext,
      runId,
      executionOwnerId,
    };
    if (
      !tool
      || !tool.control.idempotency.required
      || !this.hasExecutionPermission(tool, runId, executionContext, input)
      || executionContext.signal?.aborted
    ) {
      return this.executeOnce(name, input, executionContext);
    }

    const normalizedInput = input === undefined ? {} : input;
    if (!normalizedInput || typeof normalizedInput !== 'object' || Array.isArray(normalizedInput)) {
      return this.executeOnce(name, input, executionContext);
    }
    const idempotencyResolution = normalizeIdempotencyKey(
      runtimeContext.runId && runtimeContext.stepId
        ? createRunStepIdempotencyKey(runtimeContext.runId, runtimeContext.stepId)
        : (normalizedInput as Record<string, unknown>).idempotencyKey,
      `${runId}:${runtimeContext.stepId || name}`,
    );
    if (idempotencyResolution.error) {
      return this.executeOnce(name, input, executionContext);
    }
    const idempotencyKey = idempotencyResolution.key;
    const inputWithIdempotency = {
      ...(normalizedInput as Record<string, unknown>),
      idempotencyKey,
    };
    let validatedInput: unknown;
    try {
      validatedInput = tool.inputValidator.parse(inputWithIdempotency);
    } catch {
      return this.executeOnce(name, inputWithIdempotency, executionContext);
    }
    const inputFingerprint = createAssistantScopedInputFingerprint(validatedInput, executionContext);
    const ownerId = this.resolveIdempotencyOwnerId();
    const executionKey = this.idempotencyMemoryKey(ownerId, name, idempotencyKey);
    const cached = this.readVerifiedExecution(ownerId, name, idempotencyKey);
    if (cached) {
      if (cached.inputFingerprint !== inputFingerprint) {
        throw this.createIdempotencyConflict(name, runId, executionContext, inputWithIdempotency, idempotencyKey);
      }
      try {
        const verification = await tool.verify(
          cached.output,
          validatedInput,
          resolveFreshToolContext(executionContext),
        );
        const verified = typeof verification === 'boolean' ? verification : verification.success;
        if (
          verified
          && !executionContext.signal?.aborted
          && this.resolveIdempotencyOwnerId() === executionOwnerId
        ) {
          this.appendIdempotencyReuseLog(name, runId, executionContext, inputWithIdempotency, cached);
          return cached.output;
        }
      } catch {
        // 失效的持久结果会被删除，并重新进入真实工具执行。
      }
      this.deleteVerifiedExecution(ownerId, name, idempotencyKey);
    }

    const existingExecution = this.inFlightExecutions.get(executionKey);
    if (existingExecution) {
      if (existingExecution.inputFingerprint !== inputFingerprint) {
        throw this.createIdempotencyConflict(name, runId, executionContext, inputWithIdempotency, idempotencyKey);
      }
      const output = await existingExecution.promise;
      if (this.resolveIdempotencyOwnerId() !== executionOwnerId) {
        throw new Error('Tool execution owner changed while waiting for an in-flight operation.');
      }
      const status = outputStatus(output);
      if (!status || status === 'success' || status === 'partial_success') {
        const record = this.readVerifiedExecution(ownerId, name, idempotencyKey) || {
          ownerId,
          toolName: name,
          idempotencyKey,
          inputFingerprint,
          output,
          status: status === 'partial_success' ? 'partial_success' as const : 'success' as const,
          verifiedAt: new Date().toISOString(),
          expiresAt: Date.now() + IDEMPOTENCY_RECORD_TTL_MS,
        };
        this.appendIdempotencyReuseLog(name, runId, executionContext, inputWithIdempotency, record);
      }
      return output;
    }

    const execution = this.executeOnce(name, inputWithIdempotency, executionContext);
    const inFlight = { inputFingerprint, promise: execution };
    this.inFlightExecutions.set(executionKey, inFlight);
    try {
      const output = await execution;
      const status = outputStatus(output);
      if (!status || status === 'success' || status === 'partial_success') {
        this.writeVerifiedExecution({
          ownerId,
          toolName: name,
          idempotencyKey,
          inputFingerprint,
          output,
          status: status === 'partial_success' ? 'partial_success' : 'success',
          verifiedAt: new Date().toISOString(),
          expiresAt: Date.now() + IDEMPOTENCY_RECORD_TTL_MS,
        });
      }
      return output;
    } finally {
      if (this.inFlightExecutions.get(executionKey) === inFlight) {
        this.inFlightExecutions.delete(executionKey);
      }
    }
  }

  private async executeOnce(name: string, input: unknown, ctx: AssistantToolExecutionContext): Promise<any> {
    const tool = this.getTool(name);
    const runtimeContext = resolveFreshToolContext(ctx);
    const executionOwnerId = String(runtimeContext.executionOwnerId || this.resolveIdempotencyOwnerId());
    const runId = runtimeContext.runId || runtimeContext.confirmationGrant?.runId || createStandaloneRunId(name);
    const runBoundIdempotencyKey = runtimeContext.runId && runtimeContext.stepId
      ? createRunStepIdempotencyKey(runtimeContext.runId, runtimeContext.stepId)
      : undefined;
    const normalizedMutationInput = tool?.control.idempotency.required && input === undefined ? {} : input;
    const idempotencyResolution = tool?.control.idempotency.required
      && normalizedMutationInput
      && typeof normalizedMutationInput === 'object'
      && !Array.isArray(normalizedMutationInput)
      ? normalizeIdempotencyKey(
          runBoundIdempotencyKey || (normalizedMutationInput as Record<string, unknown>).idempotencyKey,
          `${runId}:${runtimeContext.stepId || name}`,
        )
      : undefined;
    const inputWithIdempotency = tool?.control.idempotency.required
      && normalizedMutationInput
      && typeof normalizedMutationInput === 'object'
      && !Array.isArray(normalizedMutationInput)
      ? {
          ...(normalizedMutationInput as Record<string, unknown>),
          idempotencyKey: idempotencyResolution?.key,
        }
      : normalizedMutationInput;
    const log: AgentToolCallLog = {
      id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      runId,
      stepId: runtimeContext.stepId,
      toolName: name,
      inputSummary: redactToolSummary(inputWithIdempotency),
      status: 'success',
      startedAt: new Date().toISOString(),
      idempotencyKey: inputWithIdempotency && typeof inputWithIdempotency === 'object'
        ? String((inputWithIdempotency as Record<string, unknown>).idempotencyKey || '') || undefined
        : undefined,
    };

    if (!tool) {
      const errorLog: AgentToolCallLog = {
        ...log,
        status: 'failed',
        failureClass: 'validation',
        error: `未找到工具: ${name}`,
        completedAt: new Date().toISOString()
      };
      this.appendLog(errorLog, executionOwnerId);
      throw new Error(`未找到工具: ${name}`);
    }

    if (idempotencyResolution?.error) {
      const errorLog: AgentToolCallLog = {
        ...log,
        status: 'failed',
        failureClass: 'validation',
        retryable: false,
        error: idempotencyResolution.error,
        completedAt: new Date().toISOString(),
      };
      this.appendLog(errorLog, executionOwnerId);
      throw new TypeError(idempotencyResolution.error);
    }

    // 安全隔离校验
    if (tool.permission === 'forbidden') {
      runtimeContext.notify?.error?.('操作被拦截', `出于绝对安全隔离原则，禁止 AI 助手执行该工具: ${name}`);
      const blockedLog: AgentToolCallLog = {
        ...log,
        status: 'blocked',
        failureClass: 'permission',
        error: `Execution forbidden for tool: ${name}`,
        completedAt: new Date().toISOString()
      };
      this.appendLog(blockedLog, executionOwnerId);
      throw new Error(`Execution forbidden for tool: ${name}`);
    }

    if (tool.permission === 'confirm' || tool.permission === 'dangerous') {
      const authorized = this.hasExecutionPermission(tool, runId, runtimeContext, inputWithIdempotency);
      if (!authorized) {
        const blockedLog: AgentToolCallLog = {
          ...log,
          status: 'blocked',
          failureClass: 'permission',
          error: `Confirmation grant required for tool: ${name}`,
          completedAt: new Date().toISOString()
        };
        this.appendLog(blockedLog, executionOwnerId);
        throw new Error(`Confirmation grant required for tool: ${name}`);
      }
    }

    try {
      if (this.resolveIdempotencyOwnerId() !== executionOwnerId) {
        throw new Error('Tool execution owner changed before the operation started.');
      }
      if (runtimeContext.signal?.aborted) {
        const abortError = new Error('Tool execution was cancelled before it started.') as Error & { code?: string };
        abortError.code = 'ABORT_ERR';
        throw abortError;
      }
      const validatedInput = tool.inputValidator.parse(inputWithIdempotency);
      const output = await tool.handler(validatedInput, runtimeContext);
      if (this.resolveIdempotencyOwnerId() !== executionOwnerId) {
        throw new Error('Tool execution owner changed while the operation was running.');
      }
      if (runtimeContext.signal?.aborted) {
        const abortError = new Error('Tool execution was cancelled.') as Error & { code?: string };
        abortError.code = 'ABORT_ERR';
        throw abortError;
      }
      
      // 审计工具执行的输出：如果返回 success === false
      const declaredStatus = outputStatus(output);
      if (declaredStatus && !['success', 'partial_success'].includes(declaredStatus)) {
        const outObj = output as any;
        const isSetupRequired = outObj.code === 'SETUP_REQUIRED' || outObj.code === 'CAPABILITY_UNAVAILABLE';
        const status: AgentToolCallStatus = isSetupRequired ? 'setup_required' : declaredStatus;
        const safeMessage = redactToolText(outObj.message || 'Execution failed');
        const failedLog: AgentToolCallLog = {
          ...log,
          status,
          outcome: status === 'cancelled'
            ? 'cancelled'
            : status === 'rolled_back'
              ? 'rolled_back_failure'
              : status === 'retryable_failure'
                ? 'retryable_failure'
                : undefined,
          failureClass: status === 'cancelled'
            ? 'cancelled'
            : isSetupRequired
              ? 'setup'
              : status === 'retryable_failure' || status === 'rolled_back'
                ? 'provider'
                : 'unknown',
          retryable: status === 'retryable_failure',
          error: safeMessage,
          completedAt: new Date().toISOString()
        };
        this.appendLog(failedLog, executionOwnerId);
        return output && typeof output === 'object' && !Array.isArray(output)
          ? {
              ...outObj,
              ...(typeof outObj.message === 'string' ? { message: safeMessage } : {}),
              ...(typeof outObj.error === 'string' ? { error: redactToolText(outObj.error) } : {}),
            }
          : output;
      }

      {
        const verification = await tool.verify(output, validatedInput, resolveFreshToolContext(runtimeContext));
        if (runtimeContext.signal?.aborted) {
          const abortError = new Error('Tool execution was cancelled during verification.') as Error & { code?: string };
          abortError.code = 'ABORT_ERR';
          throw abortError;
        }
        const verified = typeof verification === 'boolean' ? verification : verification.success;
        if (this.resolveIdempotencyOwnerId() !== executionOwnerId) {
          throw new Error('Tool execution owner changed during verification.');
        }
        if (!verified) {
          const verificationMessage = typeof verification === 'boolean'
            ? `Verification failed for tool: ${name}`
            : verification.message || `Verification failed for tool: ${name}`;
          const safeVerificationMessage = redactToolText(verificationMessage);
          const failedLog: AgentToolCallLog = {
            ...log,
            status: 'verification_failed',
            outcome: 'retryable_failure',
            failureClass: 'verification',
            outputSummary: redactToolSummary(output),
            error: safeVerificationMessage,
            completedAt: new Date().toISOString()
          };
          this.appendLog(failedLog, executionOwnerId);
          const verificationError = new Error(safeVerificationMessage) as Error & { code?: string };
          verificationError.code = 'VERIFICATION_FAILED';
          throw verificationError;
        }
      }

      const successLog: AgentToolCallLog = {
        ...log,
        status: declaredStatus === 'partial_success' ? 'partial_success' : 'success',
        outcome: declaredStatus === 'partial_success' ? 'partial_success' : 'success',
        outputSummary: redactToolSummary(output),
        completedAt: new Date().toISOString()
      };
      this.appendLog(successLog, executionOwnerId);
      return output;
    } catch (e: any) {
      if (e?.code === 'VERIFICATION_FAILED') {
        throw e;
      }
      const safeError = redactToolText(e?.message || String(e));
      const failureClass = runtimeContext.signal?.aborted ? 'cancelled' : classifyFailure(e);
      const isSetupRequired = failureClass === 'setup';
      const isCancelled = failureClass === 'cancelled';
      if (!isCancelled) {
        console.error(`[ToolRegistry] 工具执行异常: ${name}`, safeError);
      }
      const status: AgentToolCallStatus = isSetupRequired ? 'setup_required' : isCancelled ? 'cancelled' : 'failed';
      
      const failedLog: AgentToolCallLog = {
        ...log,
        status,
        outcome: isCancelled ? 'cancelled' : undefined,
        failureClass,
        retryable: tool.control.failure.defaultRetryable && !['permission', 'validation', 'cancelled'].includes(failureClass),
        errorCode: typeof e?.code === 'string' ? e.code : undefined,
        error: safeError,
        completedAt: new Date().toISOString()
      };
      this.appendLog(failedLog, executionOwnerId);
      const redactedError = (e instanceof TypeError ? new TypeError(safeError) : new Error(safeError)) as Error & { code?: string };
      redactedError.name = typeof e?.name === 'string' ? e.name : redactedError.name;
      redactedError.code = typeof e?.code === 'string' ? e.code : undefined;
      throw redactedError;
    }
  }

  registerAlias(name: string, targetName: string, description?: string) {
    if (this.getTool(name)) {
      return;
    }

    const target = this.getTool(targetName);
    if (!target) {
      throw new Error(`无法注册工具别名 ${name}: 目标工具不存在 ${targetName}`);
    }

    this.register({
      ...target,
      name,
      description: description || target.description
    });
  }
}

export const toolRegistryInstance = new AgentToolRegistry();

// 导入具体的子工具数组
import { canvasTools } from './canvasTools.ts';
import { assetTools } from './assetTools.ts';
import { generationTools } from './generationTools.ts';
import { knowledgeTools } from './knowledgeTools.ts';
import { uiTools } from './uiTools.ts';
import { skillTools } from './skillTools.ts';
import { browserTools } from './browserTools.ts';
import { siteCapabilityTools } from './siteCapabilityTools.ts';
import { capabilityTools } from './capabilityTools.ts';
// 注册所有导入的工具
[
  ...canvasTools,
  ...assetTools,
  ...generationTools,
  ...knowledgeTools,
  ...uiTools,
  ...skillTools,
  ...browserTools,
  ...siteCapabilityTools,
  ...capabilityTools
].forEach(tool => {
  toolRegistryInstance.register(tool);
});

// 注册特殊机制工具
toolRegistryInstance.register({
  name: 'fillApiKey',
  description: '出于绝对安全隔离原则，禁止 AI 自动填写密钥',
  permission: 'forbidden',
  inputSchema: {},
  handler: async () => {}
});

toolRegistryInstance.register({
  name: 'optimizePromptLocally',
  description: '在本地对用户的提示词进行模板匹配与效果词强化润色',
  permission: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '提示词绘图主体' },
      style: { type: 'string', description: '附加画风说明' }
    },
    required: ['subject']
  },
  handler: async (input: { subject: string; style?: string }) => {
    const subject = input.subject || '';
    const styleSuffix = input.style ? `, ${input.style} style` : '';
    const optimized = `${subject}${styleSuffix}, highly detailed, 4k resolution, cinematic lighting, masterpiece, sharp focus`;
    return {
      optimizedPrompt: optimized
    };
  }
});

// 注册别名机制
toolRegistryInstance.registerAlias('canvas.locateNodes', 'locateCard');
toolRegistryInstance.registerAlias('ui.highlightElement', 'highlightElement');
toolRegistryInstance.registerAlias('ui.locateApiCard', 'locateApiCard');
toolRegistryInstance.registerAlias('ui.openSettings', 'openSettings');
toolRegistryInstance.registerAlias('navigateToSurface', 'ui.navigateToSurface');
toolRegistryInstance.registerAlias('assets.zipOriginals', 'zipOutputs');
toolRegistryInstance.registerAlias('generation.start', 'startGeneration');
toolRegistryInstance.registerAlias('generation.createBatchJob', 'startBatchGeneration');
toolRegistryInstance.registerAlias('generation.cancelJob', 'cancelBatchGeneration');
toolRegistryInstance.registerAlias('generation.submitComposer', 'submitPromptComposer');
toolRegistryInstance.registerAlias('prompt.fillPrompt', 'fillPrompt');
toolRegistryInstance.registerAlias('prompt.optimizeInput', 'fillInputPrompt');
toolRegistryInstance.registerAlias('getModelCapabilities', 'provider.getModelCapabilities');
toolRegistryInstance.registerAlias('export.zipOriginals', 'assets.zipOriginals');

// 导出兼容旧的大模型工具结构
export const TOOL_REGISTRY = toolRegistryInstance.getAllTools().map(t => ({
  name: t.name,
  description: t.description,
  permission: t.permission,
  control: t.control,
  schema: t.inputSchema
}));

export const getToolRegistrySchemas = () => TOOL_REGISTRY;
