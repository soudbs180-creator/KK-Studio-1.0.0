import { AgentRunListDtoSchema } from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import { agentRunStore, type AgentRunStore } from './AgentRunStore.ts';

export interface AgentRunHydrationClient {
  listAgentRuns(options?: {
    expectedAuthSubject?: string;
    signal?: AbortSignal;
  }): Promise<{
    success: boolean;
    data?: {
      ok?: unknown;
      data?: unknown;
    };
  }>;
}

export type AgentRunHydrationOutcome =
  | 'hydrated'
  | 'local_only'
  | 'owner_changed'
  | 'invalid_payload'
  | 'unavailable';

export interface AgentRunHydrationResult {
  outcome: AgentRunHydrationOutcome;
  runCount: number;
}

interface HydrationOptions {
  ownerId?: string;
  store?: AgentRunStore;
  client?: AgentRunHydrationClient;
  getOwnerId?: () => string;
  signal?: AbortSignal;
}

const normalizeOwnerId = (ownerId: string): string => String(ownerId || '').trim() || 'local_user';

/** Restores owner-scoped server projections before any pending local upload begins. */
export const hydrateAgentRunProjection = async (
  options: HydrationOptions = {},
): Promise<AgentRunHydrationResult> => {
  const store = options.store || agentRunStore;
  const client = options.client || kkWebApiClient;
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  const ownerId = normalizeOwnerId(options.ownerId || getOwnerId());
  if (ownerId === 'local_user') return { outcome: 'local_only', runCount: store.listRuns().length };
  if (normalizeOwnerId(getOwnerId()) !== ownerId) return { outcome: 'owner_changed', runCount: 0 };

  try {
    const response = await client.listAgentRuns({
      expectedAuthSubject: ownerId,
      signal: options.signal,
    });
    if (normalizeOwnerId(getOwnerId()) !== ownerId) return { outcome: 'owner_changed', runCount: 0 };
    if (!response.success || response.data?.ok !== true) return { outcome: 'unavailable', runCount: 0 };
    const parsed = AgentRunListDtoSchema.safeParse(response.data.data);
    if (!parsed.success) return { outcome: 'invalid_payload', runCount: 0 };
    const hydrated = store.hydrateAuthoritativeRuns(ownerId, parsed.data);
    return { outcome: 'hydrated', runCount: hydrated.length };
  } catch {
    return { outcome: 'unavailable', runCount: 0 };
  }
};
