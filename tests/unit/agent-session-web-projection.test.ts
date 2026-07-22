import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { AgentSessionDto, AgentSessionListItemDto } from '@kk/shared';
import {
  AgentSessionProjectionStore,
  hydrateAgentSessionDetail,
  hydrateAgentSessionProjection,
  type AgentSessionProjectionClient,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts';

const makeListItem = (
  overrides: Partial<AgentSessionListItemDto> = {},
): AgentSessionListItemDto => ({
  sessionId: 'session-authoritative-1',
  ownerId: 'session-owner-a',
  collaborationMode: 'assist',
  messageCount: 2,
  lastHeartbeatAt: '2026-07-22T01:00:00.000Z',
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T01:00:00.000Z',
  ...overrides,
});

const makeSession = (overrides: Partial<AgentSessionDto> = {}): AgentSessionDto => ({
  sessionId: 'session-authoritative-1',
  ownerId: 'session-owner-a',
  collaborationMode: 'assist',
  messages: [
    {
      id: 'message-1',
      role: 'user',
      content: 'authoritative text only',
      createdAt: '2026-07-22T00:30:00.000Z',
    },
  ],
  summary: {
    text: 'safe summary',
    coveredMessageCount: 1,
    updatedAt: '2026-07-22T00:31:00.000Z',
  },
  toolResults: [],
  knowledgeRefs: [],
  tokenBudget: { maxTokens: 100_000, usedTokens: 100, reservedTokens: 0 },
  confirmations: [],
  checkpoints: [],
  lastHeartbeatAt: '2026-07-22T01:00:00.000Z',
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T01:00:00.000Z',
  ...overrides,
});

const ok = (payload: unknown) => Promise.resolve({
  success: true,
  data: { ok: true, data: payload },
});

const createClient = (listPayload: unknown, detailPayload?: unknown): AgentSessionProjectionClient => ({
  listAgentSessions: async () => ok(listPayload),
  getAgentSession: async () => ok(detailPayload),
});

test('hydrates only owner-qualified Session list projections', async () => {
  const ownerId = 'session-owner-a';
  const store = new AgentSessionProjectionStore(() => ownerId);
  let requestedOwner = '';
  const client: AgentSessionProjectionClient = {
    listAgentSessions: async (options) => {
      requestedOwner = String(options?.expectedAuthSubject || '');
      return ok([makeListItem()]);
    },
    getAgentSession: async () => ok(makeSession()),
  };

  const result = await hydrateAgentSessionProjection({
    ownerId,
    store,
    client,
    getOwnerId: () => ownerId,
  });

  assert.deepEqual(result, { outcome: 'hydrated', sessionCount: 1 });
  assert.equal(requestedOwner, ownerId);
  assert.deepEqual(store.listSessions().map((session) => session.sessionId), ['session-authoritative-1']);
  assert.equal(store.getSession('session-authoritative-1'), undefined);
});

test('rejects malformed or cross-owner Session lists without replacing the current projection', async () => {
  const ownerId = 'session-owner-a';
  const store = new AgentSessionProjectionStore(() => ownerId);
  await hydrateAgentSessionProjection({
    ownerId,
    store,
    client: createClient([makeListItem()]),
    getOwnerId: () => ownerId,
  });

  const crossOwner = await hydrateAgentSessionProjection({
    ownerId,
    store,
    client: createClient([makeListItem({ ownerId: 'session-owner-b' })]),
    getOwnerId: () => ownerId,
  });
  const malformed = await hydrateAgentSessionProjection({
    ownerId,
    store,
    client: createClient([{ ...makeListItem(), messageCount: -1 }]),
    getOwnerId: () => ownerId,
  });

  assert.equal(crossOwner.outcome, 'invalid_payload');
  assert.equal(malformed.outcome, 'invalid_payload');
  assert.deepEqual(store.listSessions().map((session) => session.sessionId), ['session-authoritative-1']);
});

test('discards a delayed Session list after the authenticated owner changes', async () => {
  let ownerId = 'session-owner-a';
  const store = new AgentSessionProjectionStore(() => ownerId);
  let releaseList!: (value: Awaited<ReturnType<AgentSessionProjectionClient['listAgentSessions']>>) => void;
  const client: AgentSessionProjectionClient = {
    listAgentSessions: async () => new Promise((resolve) => {
      releaseList = resolve;
    }),
    getAgentSession: async () => ok(makeSession()),
  };
  const hydration = hydrateAgentSessionProjection({
    ownerId,
    store,
    client,
    getOwnerId: () => ownerId,
  });

  ownerId = 'session-owner-b';
  releaseList(await ok([makeListItem()]));

  assert.equal((await hydration).outcome, 'owner_changed');
  assert.deepEqual(store.listSessions(), []);
});

test('loads a validated detail without granting Chat ownership or accepting another Session id', async () => {
  const ownerId = 'session-owner-a';
  const store = new AgentSessionProjectionStore(() => ownerId);
  const client = createClient([makeListItem()], makeSession());
  await hydrateAgentSessionProjection({ ownerId, store, client, getOwnerId: () => ownerId });

  const accepted = await hydrateAgentSessionDetail('session-authoritative-1', {
    ownerId,
    store,
    client,
    getOwnerId: () => ownerId,
  });
  const rejected = await hydrateAgentSessionDetail('session-authoritative-1', {
    ownerId,
    store,
    client: createClient([], makeSession({ sessionId: 'session-substituted' })),
    getOwnerId: () => ownerId,
  });

  assert.equal(accepted.outcome, 'hydrated');
  assert.equal(store.getSession('session-authoritative-1')?.messages[0]?.content, 'authoritative text only');
  assert.equal(rejected.outcome, 'invalid_payload');
  assert.equal(store.getSession('session-substituted'), undefined);
});

test('Session projection stays independent from local Chat storage and is requested on auth hydration', () => {
  const projectionSource = readFileSync(
    'apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts',
    'utf8',
  );
  const contextSource = readFileSync(
    'apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx',
    'utf8',
  );

  assert.doesNotMatch(projectionSource, /chatSessionData|kk_chat_sidebar_sessions|localStorage/);
  assert.match(contextSource, /requestSessionHydration/);
});
