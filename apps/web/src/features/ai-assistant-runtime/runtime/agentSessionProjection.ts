import {
  AgentSessionDtoSchema,
  AgentSessionListDtoSchema,
  type AgentSessionDto,
  type AgentSessionListItemDto,
} from '@kk/shared';
import { kkWebApiClient } from '../../../services/api/kkApiClient.ts';
import { getRuntimeOwnerId } from '../../../services/auth/runtimeSessionProfile.ts';

interface AgentSessionApiResponse {
  success: boolean;
  data?: {
    ok?: unknown;
    data?: unknown;
  };
}

export interface AgentSessionProjectionClient {
  listAgentSessions(options?: {
    expectedAuthSubject?: string;
    signal?: AbortSignal;
  }): Promise<AgentSessionApiResponse>;
  getAgentSession(
    sessionId: string,
    options?: { expectedAuthSubject?: string; signal?: AbortSignal },
  ): Promise<AgentSessionApiResponse>;
}

export type AgentSessionHydrationOutcome =
  | 'hydrated'
  | 'local_only'
  | 'owner_changed'
  | 'invalid_payload'
  | 'unavailable';

export interface AgentSessionHydrationResult {
  outcome: AgentSessionHydrationOutcome;
  sessionCount: number;
}

export interface AgentSessionDetailHydrationResult {
  outcome: AgentSessionHydrationOutcome;
  session?: AgentSessionDto;
}

interface AgentSessionHydrationOptions {
  ownerId?: string;
  store?: AgentSessionProjectionStore;
  client?: AgentSessionProjectionClient;
  getOwnerId?: () => string;
  signal?: AbortSignal;
}

const normalizeOwnerId = (ownerId: string): string => String(ownerId || '').trim() || 'local_user';

const cloneListItem = (session: AgentSessionListItemDto): AgentSessionListItemDto => ({ ...session });

const cloneSession = (session: AgentSessionDto): AgentSessionDto => (
  JSON.parse(JSON.stringify(session)) as AgentSessionDto
);

/** Holds server-owned Session projections without mutating the local Chat session model. */
export class AgentSessionProjectionStore {
  private sessions: AgentSessionListItemDto[] = [];
  private readonly sessionDetails = new Map<string, AgentSessionDto>();
  private readonly ownerIdResolver: () => string;
  private activeOwnerId: string;

  constructor(ownerIdResolver: () => string = getRuntimeOwnerId) {
    this.ownerIdResolver = ownerIdResolver;
    this.activeOwnerId = normalizeOwnerId(ownerIdResolver());
  }

  private ensureOwnerScope(): void {
    const ownerId = normalizeOwnerId(this.ownerIdResolver());
    if (ownerId === this.activeOwnerId) return;
    this.activeOwnerId = ownerId;
    this.sessions = [];
    this.sessionDetails.clear();
  }

  listSessions(): AgentSessionListItemDto[] {
    this.ensureOwnerScope();
    return this.sessions.map(cloneListItem);
  }

  getSession(sessionId: string): AgentSessionDto | undefined {
    this.ensureOwnerScope();
    const session = this.sessionDetails.get(sessionId);
    return session ? cloneSession(session) : undefined;
  }

  replaceOwnerProjection(ownerId: string, sessions: AgentSessionListItemDto[]): boolean {
    this.ensureOwnerScope();
    const normalizedOwnerId = normalizeOwnerId(ownerId);
    if (normalizedOwnerId !== this.activeOwnerId) return false;
    if (sessions.some((session) => session.ownerId !== normalizedOwnerId)) return false;
    this.sessions = sessions.map(cloneListItem);
    this.sessionDetails.clear();
    return true;
  }

  storeOwnerSession(ownerId: string, session: AgentSessionDto): boolean {
    this.ensureOwnerScope();
    const normalizedOwnerId = normalizeOwnerId(ownerId);
    if (normalizedOwnerId !== this.activeOwnerId || session.ownerId !== normalizedOwnerId) return false;
    this.sessionDetails.set(session.sessionId, cloneSession(session));
    return true;
  }
}

export const agentSessionProjectionStore = new AgentSessionProjectionStore();

/** Hydrates the bounded Session list only after shared-schema and owner validation. */
export const hydrateAgentSessionProjection = async (
  options: AgentSessionHydrationOptions = {},
): Promise<AgentSessionHydrationResult> => {
  const store = options.store || agentSessionProjectionStore;
  const client = options.client || kkWebApiClient;
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  const ownerId = normalizeOwnerId(options.ownerId || getOwnerId());
  if (ownerId === 'local_user') return { outcome: 'local_only', sessionCount: store.listSessions().length };
  if (normalizeOwnerId(getOwnerId()) !== ownerId) return { outcome: 'owner_changed', sessionCount: 0 };
  try {
    const response = await client.listAgentSessions({ expectedAuthSubject: ownerId, signal: options.signal });
    if (normalizeOwnerId(getOwnerId()) !== ownerId) return { outcome: 'owner_changed', sessionCount: 0 };
    if (!response.success || response.data?.ok !== true) return { outcome: 'unavailable', sessionCount: 0 };
    const parsed = AgentSessionListDtoSchema.safeParse(response.data.data);
    if (!parsed.success || parsed.data.some((session) => session.ownerId !== ownerId)) {
      return { outcome: 'invalid_payload', sessionCount: 0 };
    }
    if (!store.replaceOwnerProjection(ownerId, parsed.data)) return { outcome: 'owner_changed', sessionCount: 0 };
    return { outcome: 'hydrated', sessionCount: parsed.data.length };
  } catch {
    return { outcome: 'unavailable', sessionCount: 0 };
  }
};

/** Fetches one owner-qualified Session detail without merging it into ChatSidebar history. */
export const hydrateAgentSessionDetail = async (
  sessionId: string,
  options: AgentSessionHydrationOptions = {},
): Promise<AgentSessionDetailHydrationResult> => {
  const store = options.store || agentSessionProjectionStore;
  const client = options.client || kkWebApiClient;
  const getOwnerId = options.getOwnerId || getRuntimeOwnerId;
  const ownerId = normalizeOwnerId(options.ownerId || getOwnerId());
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId || normalizedSessionId.length > 200) return { outcome: 'invalid_payload' };
  if (ownerId === 'local_user') return { outcome: 'local_only' };
  if (normalizeOwnerId(getOwnerId()) !== ownerId) return { outcome: 'owner_changed' };
  try {
    const response = await client.getAgentSession(normalizedSessionId, {
      expectedAuthSubject: ownerId,
      signal: options.signal,
    });
    if (normalizeOwnerId(getOwnerId()) !== ownerId) return { outcome: 'owner_changed' };
    if (!response.success || response.data?.ok !== true) return { outcome: 'unavailable' };
    const parsed = AgentSessionDtoSchema.safeParse(response.data.data);
    if (!parsed.success || parsed.data.ownerId !== ownerId || parsed.data.sessionId !== normalizedSessionId) {
      return { outcome: 'invalid_payload' };
    }
    if (!store.storeOwnerSession(ownerId, parsed.data)) return { outcome: 'owner_changed' };
    return { outcome: 'hydrated', session: cloneSession(parsed.data) };
  } catch {
    return { outcome: 'unavailable' };
  }
};
