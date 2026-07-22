import {
  AgentContextSnapshotDtoSchema,
  type AgentContextSnapshotDto,
  type AgentContextSnapshotInputDto,
} from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import {
  AgentSessionProjectionStore,
  agentSessionProjectionStore,
} from './agentSessionProjection.ts';

interface AgentContextSnapshotApiResponse {
  success: boolean;
  data?: { ok?: unknown; data?: unknown };
}

interface AgentContextSnapshotRequestOptions {
  expectedAuthSubject?: string;
  signal?: AbortSignal;
}

export interface AgentContextSnapshotProjectionClient {
  getLatestAgentContextSnapshot(
    sessionId: string,
    options?: AgentContextSnapshotRequestOptions,
  ): Promise<AgentContextSnapshotApiResponse>;
  appendAgentContextSnapshot(
    sessionId: string,
    input: AgentContextSnapshotInputDto,
    options?: AgentContextSnapshotRequestOptions,
  ): Promise<AgentContextSnapshotApiResponse>;
}

export type AgentContextSnapshotProjectionOutcome =
  | 'hydrated'
  | 'not_found'
  | 'local_only'
  | 'owner_changed'
  | 'invalid_payload'
  | 'unavailable';

export interface AgentContextSnapshotProjectionResult {
  outcome: AgentContextSnapshotProjectionOutcome;
  snapshot?: AgentContextSnapshotDto;
}

interface AgentContextSnapshotProjectionOptions {
  ownerId?: string;
  store?: AgentSessionProjectionStore;
  client?: AgentContextSnapshotProjectionClient;
  getOwnerId?: () => string;
  signal?: AbortSignal;
}

const normalizeOwnerId = (ownerId: string): string => String(ownerId || '').trim() || 'local_user';
const normalizeSessionId = (sessionId: string): string => String(sessionId || '').trim();

function storeSnapshotResponse(
  payload: unknown,
  sessionId: string,
  ownerId: string,
  store: AgentSessionProjectionStore,
): AgentContextSnapshotProjectionResult {
  const parsed = AgentContextSnapshotDtoSchema.safeParse(payload);
  if (!parsed.success || parsed.data.sessionId !== sessionId) return { outcome: 'invalid_payload' };
  if (!store.storeOwnerContextSnapshot(ownerId, parsed.data)) return { outcome: 'invalid_payload' };
  return { outcome: 'hydrated', snapshot: parsed.data };
}

function resolveProjectionOptions(options: AgentContextSnapshotProjectionOptions) {
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  return {
    getOwnerId,
    ownerId: normalizeOwnerId(options.ownerId || getOwnerId()),
    store: options.store || agentSessionProjectionStore,
    client: options.client || kkWebApiClient,
  };
}

/** Hydrates the latest exact Session Snapshot after schema, owner, and Session validation. */
export async function hydrateAgentContextSnapshotProjection(
  sessionId: string,
  options: AgentContextSnapshotProjectionOptions = {},
): Promise<AgentContextSnapshotProjectionResult> {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId || normalizedSessionId.length > 200) return { outcome: 'invalid_payload' };
  const resolved = resolveProjectionOptions(options);
  if (resolved.ownerId === 'local_user') return { outcome: 'local_only' };
  if (normalizeOwnerId(resolved.getOwnerId()) !== resolved.ownerId) return { outcome: 'owner_changed' };
  try {
    const response = await resolved.client.getLatestAgentContextSnapshot(normalizedSessionId, {
      expectedAuthSubject: resolved.ownerId,
      signal: options.signal,
    });
    if (normalizeOwnerId(resolved.getOwnerId()) !== resolved.ownerId) return { outcome: 'owner_changed' };
    if (!response.success || response.data?.ok !== true) return { outcome: 'unavailable' };
    if (response.data.data === null) return { outcome: 'not_found' };
    return storeSnapshotResponse(response.data.data, normalizedSessionId, resolved.ownerId, resolved.store);
  } catch {
    return { outcome: 'unavailable' };
  }
}

/** Appends only strict metadata while preserving the active Session projection on failure. */
export async function appendAgentContextSnapshotProjection(
  sessionId: string,
  input: AgentContextSnapshotInputDto,
  options: AgentContextSnapshotProjectionOptions = {},
): Promise<AgentContextSnapshotProjectionResult> {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId || normalizedSessionId.length > 200) return { outcome: 'invalid_payload' };
  const resolved = resolveProjectionOptions(options);
  if (resolved.ownerId === 'local_user') return { outcome: 'local_only' };
  if (normalizeOwnerId(resolved.getOwnerId()) !== resolved.ownerId) return { outcome: 'owner_changed' };
  try {
    const response = await resolved.client.appendAgentContextSnapshot(normalizedSessionId, input, {
      expectedAuthSubject: resolved.ownerId,
      signal: options.signal,
    });
    if (normalizeOwnerId(resolved.getOwnerId()) !== resolved.ownerId) return { outcome: 'owner_changed' };
    if (!response.success || response.data?.ok !== true) return { outcome: 'unavailable' };
    return storeSnapshotResponse(response.data.data, normalizedSessionId, resolved.ownerId, resolved.store);
  } catch {
    return { outcome: 'unavailable' };
  }
}
