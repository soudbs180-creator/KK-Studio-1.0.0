import {
  CapabilityGraphSnapshotDtoSchema,
  type CapabilityEdgeDto,
  type CapabilityGraphSnapshotDto,
  type CapabilityNodeDto,
} from '@kk/shared';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import { toolRegistryInstance } from '../../ai-assistant-runtime/tools/ToolRegistry.ts';
import type {
  AssistantAction,
  AssistantPlan,
  SanitizedProjectContext,
} from '../types.ts';

const CAPABILITY_QUERY_TIMEOUT_MS = 1_500;
const MAX_CAPABILITY_ROUTES = 100;
const MAX_IDENTIFIER_LENGTH = 200;

export interface AgentPlannerCapabilityRoute {
  connectionId: string;
  providerId: string;
  modelId: string;
  capabilityId: string;
  mediaType?: 'image' | 'video' | 'audio' | 'ppt' | 'browser' | 'data';
  channel?: string;
  requestProfile?: string;
  permission: CapabilityEdgeDto['permissions'];
}

/** Secret-free discovery evidence; it never authorizes execution or selects the final route. */
export interface AgentPlannerCapabilityContext {
  version: 'v1';
  generatedAt: string;
  authority: 'discovery_only';
  routes: AgentPlannerCapabilityRoute[];
}

export type AgentPlannerProjectContext = SanitizedProjectContext & {
  capabilityGraph?: AgentPlannerCapabilityContext;
};

interface CapabilityToolExecutionContext {
  executionOwnerId: string;
  signal: AbortSignal;
}

type ExecuteCapabilityTool = (
  toolName: string,
  input: unknown,
  context: CapabilityToolExecutionContext,
) => Promise<unknown>;

interface CapabilityResolverOptions {
  executeTool?: ExecuteCapabilityTool;
  getOwnerId?: () => string;
  timeoutMs?: number;
}

function boundedIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= MAX_IDENTIFIER_LENGTH ? normalized : undefined;
}

function strictestPermission(
  left: CapabilityEdgeDto['permissions'],
  right: CapabilityEdgeDto['permissions'],
): CapabilityEdgeDto['permissions'] {
  const permissions: CapabilityEdgeDto['permissions'][] = ['safe', 'confirm', 'dangerous', 'forbidden'];
  return permissions[Math.max(permissions.indexOf(left), permissions.indexOf(right))] || 'forbidden';
}

function buildCapabilityRoute(
  bindEdge: CapabilityEdgeDto,
  supportEdge: CapabilityEdgeDto,
  nodes: ReadonlyMap<string, CapabilityNodeDto>,
): AgentPlannerCapabilityRoute | undefined {
  const connection = nodes.get(bindEdge.from);
  const model = nodes.get(bindEdge.to);
  const capability = nodes.get(supportEdge.to);
  if (
    connection?.type !== 'ProviderConnection'
    || connection.status !== 'connected'
    || model?.type !== 'Model'
    || model.status !== 'available'
    || capability?.type !== 'Capability'
    || capability.status !== 'available'
    || connection.providerId !== model.providerId
  ) return undefined;
  const providerId = boundedIdentifier(model.providerId);
  const modelId = boundedIdentifier(model.modelId);
  const capabilityId = boundedIdentifier(capability.capabilityId);
  if (!providerId || !modelId || !capabilityId) return undefined;
  const channel = boundedIdentifier(bindEdge.constraints.channel);
  const requestProfile = boundedIdentifier(bindEdge.constraints.requestProfile);
  return {
    connectionId: connection.connectionId,
    providerId,
    modelId,
    capabilityId,
    ...(capability.mediaType ? { mediaType: capability.mediaType } : {}),
    ...(channel ? { channel } : {}),
    ...(requestProfile ? { requestProfile } : {}),
    permission: strictestPermission(bindEdge.permissions, supportEdge.permissions),
  };
}

function collectCapabilityRoutes(snapshot: CapabilityGraphSnapshotDto): AgentPlannerCapabilityRoute[] {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const activeSupports = snapshot.edges.filter((edge) => (
    edge.relation === 'supports' && edge.status === 'active'
  ));
  const routes = snapshot.edges
    .filter((edge) => edge.relation === 'binds' && edge.status === 'active')
    .flatMap((bindEdge) => activeSupports
      .filter((supportEdge) => supportEdge.from === bindEdge.to)
      .map((supportEdge) => buildCapabilityRoute(bindEdge, supportEdge, nodes)))
    .filter((route): route is AgentPlannerCapabilityRoute => Boolean(route));
  const uniqueRoutes = new Map(routes.map((route) => [
    [route.connectionId, route.modelId, route.capabilityId].join('\u0000'),
    route,
  ]));
  return [...uniqueRoutes.values()]
    .sort((left, right) => (
      left.capabilityId.localeCompare(right.capabilityId)
      || left.providerId.localeCompare(right.providerId)
      || left.modelId.localeCompare(right.modelId)
      || left.connectionId.localeCompare(right.connectionId)
    ))
    .slice(0, MAX_CAPABILITY_ROUTES);
}

/** Converts the server graph into a bounded allowlisted Planner projection. */
export function buildAgentPlannerCapabilityContext(
  snapshot: CapabilityGraphSnapshotDto,
): AgentPlannerCapabilityContext {
  const parsed = CapabilityGraphSnapshotDtoSchema.parse(snapshot);
  return {
    version: parsed.version,
    generatedAt: parsed.generatedAt,
    authority: 'discovery_only',
    routes: collectCapabilityRoutes(parsed),
  };
}

function capabilityTimeout(
  abortController: AbortController,
  timeoutMs: number,
  setTimer: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>,
): { promise: Promise<never>; timer: ReturnType<typeof globalThis.setTimeout> } {
  let timer: ReturnType<typeof globalThis.setTimeout>;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimer(() => {
      abortController.abort();
      reject(new Error('Capability graph query timed out.'));
    }, timeoutMs);
  });
  return { promise, timer: timer! };
}

/** Reads capability evidence through ToolRegistry and discards stale-owner or invalid output. */
export async function resolveAgentPlannerCapabilityContext(
  ownerId: string,
  options: CapabilityResolverOptions = {},
): Promise<AgentPlannerCapabilityContext | undefined> {
  const executeTool = options.executeTool || ((toolName, input, context) => (
    toolRegistryInstance.execute(toolName, input, context)
  ));
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  const abortController = new AbortController();
  const timeoutMs = options.timeoutMs ?? CAPABILITY_QUERY_TIMEOUT_MS;
  const timeout = capabilityTimeout(abortController, timeoutMs, globalThis.setTimeout);
  try {
    const output = await Promise.race([
      executeTool('capabilities.listAvailable', {}, {
        executionOwnerId: ownerId,
        signal: abortController.signal,
      }),
      timeout.promise,
    ]);
    if (getOwnerId() !== ownerId) return undefined;
    return buildAgentPlannerCapabilityContext(CapabilityGraphSnapshotDtoSchema.parse(output));
  } catch {
    return undefined;
  } finally {
    globalThis.clearTimeout(timeout.timer);
  }
}

/** Adds discovery evidence to both Local and LLM Planner input without mutating UI context. */
export function applyAgentPlannerCapabilityContext(
  context: SanitizedProjectContext,
  capabilityContext?: AgentPlannerCapabilityContext,
): AgentPlannerProjectContext {
  return capabilityContext
    ? { ...context, capabilityGraph: capabilityContext }
    : context;
}

function sanitizeModelOptions(options: unknown, allowedModelIds: ReadonlySet<string>): unknown {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return options;
  const modelId = (options as Record<string, unknown>).modelId;
  if (typeof modelId !== 'string' || allowedModelIds.has(modelId)) return options;
  const { modelId: _removedModelId, ...safeOptions } = options as Record<string, unknown>;
  return safeOptions;
}

function sanitizePlannerAction(
  action: AssistantAction,
  allowedModelIds: Readonly<Record<'image' | 'video' | 'audio', ReadonlySet<string>>>,
): AssistantAction {
  if (action.type === 'generation.createBatchJob') {
    const safeOptions = sanitizeModelOptions(action.payload.options, allowedModelIds.image);
    return safeOptions === action.payload.options
      ? action
      : { ...action, payload: { ...action.payload, options: safeOptions } };
  }
  if (action.type === 'startGeneration') {
    const safeOptions = sanitizeModelOptions(action.payload.options, allowedModelIds.image);
    return safeOptions === action.payload.options
      ? action
      : { ...action, payload: { ...action.payload, options: safeOptions } };
  }
  if (action.type === 'generation.start') {
    const safeOptions = sanitizeModelOptions(action.payload.options, allowedModelIds.image);
    return safeOptions === action.payload.options
      ? action
      : { ...action, payload: { ...action.payload, options: safeOptions } };
  }
  if (action.type === 'fillPrompt') {
    return !action.payload.modelId || allowedModelIds.image.has(action.payload.modelId)
      ? action
      : { ...action, payload: { ...action.payload, modelId: undefined } };
  }
  if (action.type === 'generation.createVideoJob') {
    return !action.payload.modelId || allowedModelIds.video.has(action.payload.modelId)
      ? action
      : { ...action, payload: { ...action.payload, modelId: undefined } };
  }
  if (action.type === 'generation.createAudioJob') {
    return !action.payload.modelId || allowedModelIds.audio.has(action.payload.modelId)
      ? action
      : { ...action, payload: { ...action.payload, modelId: undefined } };
  }
  return action;
}

function allowedGenerationModelIds(
  capabilityContext?: AgentPlannerCapabilityContext,
): Record<'image' | 'video' | 'audio', Set<string>> {
  const allowed = { image: new Set<string>(), video: new Set<string>(), audio: new Set<string>() };
  for (const route of capabilityContext?.routes || []) {
    if (route.permission === 'forbidden') continue;
    const mediaType = route.mediaType || route.capabilityId.split('.')[0];
    if (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') {
      allowed[mediaType].add(route.modelId);
    }
  }
  return allowed;
}

/** Removes generation model guesses while preserving server RouteEngine selection. */
export function enforceAgentPlannerCapabilityPolicy(
  plan: AssistantPlan,
  capabilityContext?: AgentPlannerCapabilityContext,
): AssistantPlan {
  const allowedModelIds = allowedGenerationModelIds(capabilityContext);
  return {
    ...plan,
    actions: plan.actions.map((action) => sanitizePlannerAction(action, allowedModelIds)),
    steps: plan.steps?.map((step) => ({
      ...step,
      action: sanitizePlannerAction(step.action, allowedModelIds),
    })),
  };
}
