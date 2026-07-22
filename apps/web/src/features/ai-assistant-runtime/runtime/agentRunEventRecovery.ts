import {
  AgentRunDtoSchema,
  AgentRunEventListDtoSchema,
  type AgentRunEventDto,
} from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';
import { agentRunStore, type AgentRunRecord, type AgentRunStore } from './AgentRunStore.ts';

const CURSOR_STORAGE_PREFIX = 'kk_agent_run_event_cursors:owner:';
const MAX_RECOVERY_RUNS = 20;
const MAX_RECOVERY_CONCURRENCY = 4;
const ACTIVE_STATUSES = new Set<AgentRunRecord['status']>([
  'planning',
  'waiting_confirmation',
  'waiting_execution',
  'running',
]);

interface AgentRunEventApiResponse {
  success: boolean;
  data?: {
    ok?: unknown;
    data?: unknown;
  };
}

export interface AgentRunEventRecoveryClient {
  listAgentRunEvents(
    runId: string,
    input?: { afterSequence?: number },
    options?: { expectedAuthSubject?: string; signal?: AbortSignal },
  ): Promise<AgentRunEventApiResponse>;
  getAgentRun(
    runId: string,
    options?: { expectedAuthSubject?: string; signal?: AbortSignal },
  ): Promise<AgentRunEventApiResponse>;
}

export type AgentRunEventRecoveryOutcome =
  | 'refreshed'
  | 'no_changes'
  | 'local_only'
  | 'owner_changed'
  | 'invalid_payload'
  | 'unavailable';

export interface AgentRunEventRecoveryResult {
  outcome: AgentRunEventRecoveryOutcome;
  refreshedRunCount: number;
  queriedRunCount: number;
}

type CandidateRecoveryOutcome = Exclude<AgentRunEventRecoveryOutcome, 'local_only'>;

interface AgentRunEventRecoveryOptions {
  ownerId?: string;
  store?: AgentRunStore;
  cursorStore?: AgentRunEventCursorStore;
  client?: AgentRunEventRecoveryClient;
  getOwnerId?: () => string;
  signal?: AbortSignal;
}

interface CandidateRecoveryResult {
  outcome: CandidateRecoveryOutcome;
  refreshed: boolean;
}

const normalizeOwnerId = (ownerId: string): string => String(ownerId || '').trim() || 'local_user';

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
};

const parseCursorEntries = (value: string | null): Map<string, number> => {
  if (!value) return new Map();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map();
    return new Map(Object.entries(parsed).filter(([runId, sequence]) => (
      runId.length > 0
      && runId.length <= 200
      && Number.isSafeInteger(sequence)
      && Number(sequence) > 0
    )) as Array<[string, number]>);
  } catch {
    return new Map();
  }
};

/** Persists event cursors under an authenticated owner key without mixing accounts. */
export class AgentRunEventCursorStore {
  private readonly storage: Storage | null;
  private readonly ownerCursors = new Map<string, Map<string, number>>();

  constructor(storage: Storage | null = getBrowserStorage()) {
    this.storage = storage;
  }

  private storageKey(ownerId: string): string {
    return `${CURSOR_STORAGE_PREFIX}${encodeURIComponent(ownerId)}`;
  }

  private readOwner(ownerId: string): Map<string, number> {
    const cached = this.ownerCursors.get(ownerId);
    if (cached) return cached;
    let cursors = new Map<string, number>();
    try {
      cursors = parseCursorEntries(this.storage?.getItem(this.storageKey(ownerId)) || null);
    } catch {
      // A missing browser storage projection safely replays from sequence zero.
      cursors = new Map();
    }
    this.ownerCursors.set(ownerId, cursors);
    return cursors;
  }

  getSequence(ownerId: string, runId: string): number {
    return this.readOwner(normalizeOwnerId(ownerId)).get(String(runId || '').trim()) || 0;
  }

  setSequence(ownerId: string, runId: string, sequence: number): boolean {
    if (!Number.isSafeInteger(sequence) || sequence <= 0) return false;
    const normalizedOwnerId = normalizeOwnerId(ownerId);
    const cursors = new Map(this.readOwner(normalizedOwnerId));
    cursors.delete(runId);
    cursors.set(runId, sequence);
    while (cursors.size > 100) cursors.delete(cursors.keys().next().value as string);
    if (!this.storage) {
      this.ownerCursors.set(normalizedOwnerId, cursors);
      return true;
    }
    try {
      this.storage.setItem(this.storageKey(normalizedOwnerId), JSON.stringify(Object.fromEntries(cursors)));
      this.ownerCursors.set(normalizedOwnerId, cursors);
      return true;
    } catch {
      return false;
    }
  }
}

const selectRecoveryCandidates = (store: AgentRunStore): AgentRunRecord[] => (
  store.listRuns()
    .filter((run) => run.backendSyncState === 'synced' && ACTIVE_STATUSES.has(run.status))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_RECOVERY_RUNS)
);

const isValidEventPage = (
  events: AgentRunEventDto[],
  runId: string,
  afterSequence: number,
): boolean => {
  let previousSequence = afterSequence;
  for (const event of events) {
    if (event.runId !== runId || event.sequence <= previousSequence) return false;
    previousSequence = event.sequence;
  }
  return true;
};

const runBounded = async <Input, Output>(
  inputs: Input[],
  worker: (input: Input) => Promise<Output>,
): Promise<Output[]> => {
  const results = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const consume = async (): Promise<void> => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(inputs[index]);
    }
  };
  const workerCount = Math.min(inputs.length, MAX_RECOVERY_CONCURRENCY);
  await Promise.all(Array.from({ length: workerCount }, consume));
  return results;
};

const loadEventPage = async (
  run: AgentRunRecord,
  ownerId: string,
  cursorStore: AgentRunEventCursorStore,
  client: AgentRunEventRecoveryClient,
  signal?: AbortSignal,
): Promise<{ events: AgentRunEventDto[] } | CandidateRecoveryOutcome> => {
  const afterSequence = cursorStore.getSequence(ownerId, run.id);
  const response = await client.listAgentRunEvents(
    run.id,
    { afterSequence },
    { expectedAuthSubject: ownerId, signal },
  );
  if (!response.success || response.data?.ok !== true) return 'unavailable';
  const parsed = AgentRunEventListDtoSchema.safeParse(response.data.data);
  if (!parsed.success || !isValidEventPage(parsed.data, run.id, afterSequence)) return 'invalid_payload';
  return { events: parsed.data };
};

const recoverCandidate = async (
  run: AgentRunRecord,
  options: Required<Pick<AgentRunEventRecoveryOptions, 'store' | 'cursorStore' | 'client' | 'getOwnerId'>>
    & Pick<AgentRunEventRecoveryOptions, 'signal'>
    & { ownerId: string },
): Promise<CandidateRecoveryResult> => {
  if (normalizeOwnerId(options.getOwnerId()) !== options.ownerId) return { outcome: 'owner_changed', refreshed: false };
  try {
    const page = await loadEventPage(run, options.ownerId, options.cursorStore, options.client, options.signal);
    if (typeof page === 'string') return { outcome: page, refreshed: false };
    if (normalizeOwnerId(options.getOwnerId()) !== options.ownerId) return { outcome: 'owner_changed', refreshed: false };
    if (page.events.length === 0) return { outcome: 'no_changes', refreshed: false };
    const latestEvent = page.events[page.events.length - 1];
    const response = await options.client.getAgentRun(run.id, {
      expectedAuthSubject: options.ownerId,
      signal: options.signal,
    });
    if (normalizeOwnerId(options.getOwnerId()) !== options.ownerId) return { outcome: 'owner_changed', refreshed: false };
    if (!response.success || response.data?.ok !== true) return { outcome: 'unavailable', refreshed: false };
    const parsed = AgentRunDtoSchema.safeParse(response.data.data);
    if (!parsed.success || parsed.data.id !== run.id) return { outcome: 'invalid_payload', refreshed: false };
    if (Date.parse(parsed.data.updatedAt) < Date.parse(latestEvent.runUpdatedAt)) {
      return { outcome: 'invalid_payload', refreshed: false };
    }
    options.store.hydrateAuthoritativeRuns(options.ownerId, [parsed.data]);
    if (options.store.getRun(run.id)?.updatedAt !== parsed.data.updatedAt) {
      return { outcome: 'unavailable', refreshed: false };
    }
    const cursorPersisted = options.cursorStore.setSequence(options.ownerId, run.id, latestEvent.sequence);
    return { outcome: cursorPersisted ? 'refreshed' : 'unavailable', refreshed: true };
  } catch {
    return { outcome: 'unavailable', refreshed: false };
  }
};

const summarizeRecovery = (
  results: CandidateRecoveryResult[],
  queriedRunCount: number,
): AgentRunEventRecoveryResult => {
  const refreshedRunCount = results.filter((result) => result.refreshed).length;
  const outcomes = new Set(results.map((result) => result.outcome));
  const outcome = outcomes.has('owner_changed') ? 'owner_changed'
    : outcomes.has('invalid_payload') ? 'invalid_payload'
      : outcomes.has('unavailable') ? 'unavailable'
        : refreshedRunCount > 0 ? 'refreshed'
          : 'no_changes';
  return { outcome, refreshedRunCount, queriedRunCount };
};

export const agentRunEventCursorStore = new AgentRunEventCursorStore();

/** Uses metadata events only as invalidation signals for validated read-only Run snapshots. */
export const refreshAgentRunEventProjection = async (
  options: AgentRunEventRecoveryOptions = {},
): Promise<AgentRunEventRecoveryResult> => {
  const store = options.store || agentRunStore;
  const cursorStore = options.cursorStore || agentRunEventCursorStore;
  const client = options.client || kkWebApiClient;
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  const ownerId = normalizeOwnerId(options.ownerId || getOwnerId());
  if (ownerId === 'local_user') return { outcome: 'local_only', refreshedRunCount: 0, queriedRunCount: 0 };
  if (normalizeOwnerId(getOwnerId()) !== ownerId) {
    return { outcome: 'owner_changed', refreshedRunCount: 0, queriedRunCount: 0 };
  }
  const candidates = selectRecoveryCandidates(store);
  const recoveryOptions = { store, cursorStore, client, getOwnerId, ownerId, signal: options.signal };
  const results = await runBounded(candidates, (run) => recoverCandidate(run, recoveryOptions));
  return summarizeRecovery(results, candidates.length);
};
