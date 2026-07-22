import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AgentSessionDto,
  ApiResponse,
  AssetDto,
  AssistantApiResultDto,
} from '@kk/shared';
import {
  writeChatAgentSession,
  type ChatAgentSessionWriteClient,
  type ChatAgentSessionWriteRequest,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatAgentSessionWriteCoordinator.ts';
import type { ChatSessionItem } from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';
import { AgentSessionProjectionStore } from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts';

const now = '2026-07-22T10:00:00.000Z';
const updatedAt = Date.parse(now);

const response = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  meta: { requestId: 'request-1', timestamp: now },
});

const missingResponse = (): ApiResponse<never> => ({
  success: false,
  error: { code: 'HTTP_404', message: 'Agent session not found' },
  meta: { requestId: 'request-1', timestamp: now },
});

const sessionResponse = (
  session: AgentSessionDto,
  stale = false,
): ApiResponse<AssistantApiResultDto<AgentSessionDto>> => response({
  ok: true,
  stale,
  data: session,
});

const createChatSession = (overrides: Partial<ChatSessionItem> = {}): ChatSessionItem => ({
  id: 'chat-session-1',
  title: 'Safe write',
  messages: [{
    id: 'message-1',
    role: 'user',
    content: 'Continue safely',
    timestamp: updatedAt,
  }],
  agentSummary: {
    text: 'Validated summary',
    coveredMessageCount: 1,
    updatedAt: now,
  },
  updatedAt,
  ...overrides,
});

const createRequest = (
  overrides: Partial<ChatAgentSessionWriteRequest> = {},
): ChatAgentSessionWriteRequest => ({
  session: createChatSession(),
  collaborationMode: 'assist',
  maxTokens: 100_000,
  systemRules: 'Follow verified project rules.',
  createdAt: '2026-07-22T09:59:00.000Z',
  heartbeatAt: '2026-07-22T10:00:01.000Z',
  approvedDocumentAttachmentIds: new Set<string>(),
  ...overrides,
});

const createAuthoritativeSession = (
  overrides: Partial<AgentSessionDto> = {},
): AgentSessionDto => ({
  sessionId: 'chat-session-1',
  ownerId: 'owner-a',
  collaborationMode: 'assist',
  messages: [{
    id: 'message-1',
    role: 'user',
    content: 'Continue safely',
    createdAt: now,
  }],
  summary: { text: 'Validated summary', coveredMessageCount: 1, updatedAt: now },
  toolResults: [],
  knowledgeRefs: [],
  tokenBudget: { maxTokens: 100_000, usedTokens: 100, reservedTokens: 5_000 },
  confirmations: [],
  checkpoints: [],
  lastHeartbeatAt: '2026-07-22T10:00:01.000Z',
  createdAt: '2026-07-22T09:59:00.000Z',
  updatedAt: now,
  ...overrides,
});

const createAsset = (overrides: Partial<AssetDto> = {}): AssetDto => ({
  id: 'asset-1',
  kind: 'image',
  storagePath: '/api/v1/assets/asset-1/content',
  mimeType: 'image/png',
  sizeBytes: 5,
  metadata: {},
  createdAt: now,
  ...overrides,
});

test('creates a new owner-scoped Session and hydrates the authoritative projection', async () => {
  const ownerId = 'owner-a';
  const calls: string[] = [];
  const expectedSubjects: string[] = [];
  const store = new AgentSessionProjectionStore(() => ownerId);
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession(_sessionId, options) {
      calls.push('get');
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      return missingResponse();
    },
    async listAssets() { throw new Error('attachments are empty'); },
    async createAsset() { throw new Error('attachments are empty'); },
    async upsertAgentSession(input, options) {
      calls.push('upsert');
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      return sessionResponse({ ...input, ownerId });
    },
  };

  const result = await writeChatAgentSession(createRequest(), {
    ownerId,
    getOwnerId: () => ownerId,
    client,
    store,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.outcome, 'written');
  assert.deepEqual(calls, ['get', 'upsert']);
  assert.deepEqual(expectedSubjects, [ownerId, ownerId]);
  assert.equal(store.getSession('chat-session-1')?.ownerId, ownerId);
  assert.deepEqual(store.listSessions().map((session) => session.sessionId), ['chat-session-1']);
  assert.equal(result.contextPlan.tokenBudget.maxTokens, 100_000);
});

test('preserves authoritative non-Chat state while resolving attachments through owner-stable Asset calls', async () => {
  const ownerId = 'owner-a';
  const expectedSubjects: string[] = [];
  const authoritative = createAuthoritativeSession({
    toolResults: [{
      id: 'tool-1', toolName: 'canvas.getState', outcome: 'success',
      outputSummary: 'Canvas read', createdAt: now,
    }],
    knowledgeRefs: [{ documentId: 'doc-1', title: 'Architecture facts' }],
    confirmations: [{
      id: 'confirmation-1', status: 'granted', planHash: 'plan-1', toolId: 'tool-1',
      targetSnapshotHash: 'snapshot-1', expiresAt: '2026-07-22T11:00:00.000Z',
    }],
    checkpoints: [{ id: 'checkpoint-1', label: 'Before write', createdAt: now }],
  });
  const chatSession = createChatSession({
    messages: [{
      id: 'message-1', role: 'user', content: 'Use this image', timestamp: updatedAt,
      attachments: [{
        id: 'attachment-1', type: 'image', name: 'reference.png',
        data: 'data:image/png;base64,aGVsbG8=', mimeType: 'image/png', size: 5,
      }],
    }],
  });
  let written: AgentSessionDto | undefined;
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession(_sessionId, options) {
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      return sessionResponse(authoritative);
    },
    async listAssets(_input, options) {
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      return response({ items: [] });
    },
    async createAsset(input, options) {
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      const asset = createAsset({ id: input.id, metadata: input.metadata });
      return response({ asset, url: asset.storagePath });
    },
    async upsertAgentSession(input, options) {
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      written = { ...input, ownerId };
      return sessionResponse(written);
    },
  };

  const result = await writeChatAgentSession(createRequest({ session: chatSession }), {
    ownerId,
    getOwnerId: () => ownerId,
    client,
    store: new AgentSessionProjectionStore(() => ownerId),
  });

  assert.equal(result.ok, true);
  assert.ok(written);
  assert.deepEqual(expectedSubjects, [ownerId, ownerId, ownerId, ownerId]);
  assert.equal(written.messages[0].attachments?.[0]?.assetId.startsWith('chat_'), true);
  assert.deepEqual(written.toolResults, authoritative.toolResults);
  assert.deepEqual(written.knowledgeRefs, authoritative.knowledgeRefs);
  assert.deepEqual(written.confirmations, authoritative.confirmations);
  assert.deepEqual(written.checkpoints, authoritative.checkpoints);
});

test('stops after a delayed detail read when the authenticated owner changes', async () => {
  let ownerId = 'owner-a';
  let upsertCount = 0;
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession() {
      ownerId = 'owner-b';
      return sessionResponse(createAuthoritativeSession());
    },
    async listAssets() { throw new Error('must not resolve Assets'); },
    async createAsset() { throw new Error('must not create Assets'); },
    async upsertAgentSession() {
      upsertCount += 1;
      return sessionResponse(createAuthoritativeSession());
    },
  };

  const result = await writeChatAgentSession(createRequest(), {
    ownerId: 'owner-a',
    getOwnerId: () => ownerId,
    client,
    store: new AgentSessionProjectionStore(() => ownerId),
  });

  assert.deepEqual(result, { ok: false, reason: 'owner_changed' });
  assert.equal(upsertCount, 0);
});

test('accepts a stale write only as an authoritative server projection', async () => {
  const ownerId = 'owner-a';
  const authoritative = createAuthoritativeSession({
    messages: [{ id: 'remote-message', role: 'assistant', content: 'Newer remote state', createdAt: now }],
    summary: { text: 'Newer remote summary', coveredMessageCount: 1, updatedAt: now },
    updatedAt: '2026-07-22T10:01:00.000Z',
  });
  const store = new AgentSessionProjectionStore(() => ownerId);
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession() { return missingResponse(); },
    async listAssets() { throw new Error('attachments are empty'); },
    async createAsset() { throw new Error('attachments are empty'); },
    async upsertAgentSession() { return sessionResponse(authoritative, true); },
  };

  const result = await writeChatAgentSession(createRequest(), {
    ownerId,
    getOwnerId: () => ownerId,
    client,
    store,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.outcome, 'authoritative_stale');
  assert.equal(result.session.messages[0]?.id, 'remote-message');
  assert.equal(store.getSession('chat-session-1')?.summary.text, 'Newer remote summary');
});

test('fails closed for missing summary and cross-owner authoritative detail', async () => {
  const ownerId = 'owner-a';
  let upsertCount = 0;
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession() { return sessionResponse(createAuthoritativeSession({ ownerId: 'owner-b' })); },
    async listAssets() { return response({ items: [] }); },
    async createAsset() { throw new Error('must not create unapproved document'); },
    async upsertAgentSession() {
      upsertCount += 1;
      return sessionResponse(createAuthoritativeSession());
    },
  };
  const options = {
    ownerId,
    getOwnerId: () => ownerId,
    client,
    store: new AgentSessionProjectionStore(() => ownerId),
  };

  const noSummary = await writeChatAgentSession(createRequest({
    session: createChatSession({ agentSummary: undefined }),
  }), options);
  const crossOwner = await writeChatAgentSession(createRequest(), options);

  assert.deepEqual(noSummary, { ok: false, reason: 'missing_summary' });
  assert.deepEqual(crossOwner, { ok: false, reason: 'invalid_session_response' });
  assert.equal(upsertCount, 0);
});

test('rejects an unapproved document before Asset or Session mutation', async () => {
  const ownerId = 'owner-a';
  let listCount = 0;
  let upsertCount = 0;
  const documentSession = createChatSession({
    messages: [{
      id: 'message-1', role: 'user', content: 'Read the brief', timestamp: updatedAt,
      attachments: [{
        id: 'document-1', type: 'document', name: 'brief.txt',
        data: 'data:text/plain;base64,aGVsbG8=', mimeType: 'text/plain', size: 5,
      }],
    }],
  });
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession() { return missingResponse(); },
    async listAssets() { listCount += 1; return response({ items: [] }); },
    async createAsset() { throw new Error('must not create unapproved document'); },
    async upsertAgentSession() {
      upsertCount += 1;
      return sessionResponse(createAuthoritativeSession());
    },
  };

  const result = await writeChatAgentSession(createRequest({ session: documentSession }), {
    ownerId,
    getOwnerId: () => ownerId,
    client,
    store: new AgentSessionProjectionStore(() => ownerId),
  });

  assert.deepEqual(result, {
    ok: false,
    reason: 'asset_rejected',
    detail: 'document_approval_required',
  });
  assert.equal(listCount, 0);
  assert.equal(upsertCount, 0);
});

test('does not hydrate a malformed or cross-owner upsert response', async () => {
  const ownerId = 'owner-a';
  const store = new AgentSessionProjectionStore(() => ownerId);
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession() { return missingResponse(); },
    async listAssets() { throw new Error('attachments are empty'); },
    async createAsset() { throw new Error('attachments are empty'); },
    async upsertAgentSession() {
      return sessionResponse(createAuthoritativeSession({ ownerId: 'owner-b' }));
    },
  };

  const result = await writeChatAgentSession(createRequest(), {
    ownerId,
    getOwnerId: () => ownerId,
    client,
    store,
  });

  assert.deepEqual(result, { ok: false, reason: 'invalid_write_response' });
  assert.equal(store.getSession('chat-session-1'), undefined);
  assert.deepEqual(store.listSessions(), []);
});
