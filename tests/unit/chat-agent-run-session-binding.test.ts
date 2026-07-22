import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AgentSessionDto,
  AgentSessionUpsertDto,
  ApiResponse,
  AssistantApiResultDto,
} from '@kk/shared';
import {
  CHAT_AGENT_SESSION_SYSTEM_RULES,
  resolveChatAgentRunSessionId,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatAgentRunSessionBinding.ts';
import type { ChatAgentSessionWriteClient } from '../../apps/web/src/components/layout/chat-sidebar/session/chatAgentSessionWriteCoordinator.ts';
import type { ChatSessionItem } from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';
import { AgentSessionProjectionStore } from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts';

const createdAt = '2026-07-22T09:59:00.000Z';
const updatedAt = '2026-07-22T10:00:00.000Z';

const response = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  meta: { requestId: 'request-binding-1', timestamp: updatedAt },
});

const notFound = (): ApiResponse<never> => ({
  success: false,
  error: { code: 'HTTP_404', message: 'Agent session not found' },
  meta: { requestId: 'request-binding-1', timestamp: updatedAt },
});

const sessionResponse = (
  session: AgentSessionDto,
): ApiResponse<AssistantApiResultDto<AgentSessionDto>> => response({ ok: true, data: session });

const createChatSession = (overrides: Partial<ChatSessionItem> = {}): ChatSessionItem => ({
  id: 'chat-binding-1',
  title: 'Bound chat',
  createdAt: Date.parse(createdAt),
  updatedAt: Date.parse(updatedAt),
  messages: [{
    id: 'message-1', role: 'user', content: 'Use authoritative context', timestamp: Date.parse(updatedAt),
  }],
  agentSummary: { text: 'Validated context', coveredMessageCount: 1, updatedAt },
  ...overrides,
});

const toAuthoritativeSession = (input: AgentSessionUpsertDto, ownerId: string): AgentSessionDto => ({
  ...input,
  ownerId,
});

test('writes and hydrates a changed Chat Session before returning its Run binding', async () => {
  const ownerId = 'owner-binding-a';
  const store = new AgentSessionProjectionStore(() => ownerId);
  let detailReads = 0;
  let writes = 0;
  let writtenInput: AgentSessionUpsertDto | undefined;
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession() {
      detailReads += 1;
      return notFound();
    },
    async listAssets() { throw new Error('No attachments should be resolved.'); },
    async createAsset() { throw new Error('No attachments should be created.'); },
    async upsertAgentSession(input) {
      writes += 1;
      writtenInput = input;
      return sessionResponse(toAuthoritativeSession(input, ownerId));
    },
  };

  const sessionId = await resolveChatAgentRunSessionId({
    session: createChatSession(),
    collaborationMode: 'assist',
    maxTokens: 100_000,
  }, { ownerId, getOwnerId: () => ownerId, client, store });

  assert.equal(sessionId, 'chat-binding-1');
  assert.equal(detailReads, 1);
  assert.equal(writes, 1);
  assert.equal(writtenInput?.createdAt, createdAt);
  assert.equal(store.getSession('chat-binding-1')?.ownerId, ownerId);
  assert.match(CHAT_AGENT_SESSION_SYSTEM_RULES, /IntentGate -> Planner -> ToolRegistry/);

  const cachedSessionId = await resolveChatAgentRunSessionId({
    session: createChatSession(),
    collaborationMode: 'assist',
    maxTokens: 100_000,
  }, { ownerId, getOwnerId: () => ownerId, client, store });

  assert.equal(cachedSessionId, 'chat-binding-1');
  assert.equal(detailReads, 1);
  assert.equal(writes, 1);
});

test('does not bind legacy, uncompressed, temporary, or creation-mismatched Sessions', async () => {
  const ownerId = 'owner-binding-a';
  const store = new AgentSessionProjectionStore(() => ownerId);
  let requestCount = 0;
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession() { requestCount += 1; return notFound(); },
    async listAssets() { throw new Error('No attachments should be resolved.'); },
    async createAsset() { throw new Error('No attachments should be created.'); },
    async upsertAgentSession(input) {
      requestCount += 1;
      return sessionResponse(toAuthoritativeSession(input, ownerId));
    },
  };
  const options = { ownerId, getOwnerId: () => ownerId, client, store };
  const request = { collaborationMode: 'takeover' as const, maxTokens: 100_000 };

  assert.equal(await resolveChatAgentRunSessionId({
    ...request, session: createChatSession({ createdAt: undefined }),
  }, options), undefined);
  assert.equal(await resolveChatAgentRunSessionId({
    ...request, session: createChatSession({ agentSummary: undefined }),
  }, options), undefined);
  assert.equal(await resolveChatAgentRunSessionId({
    ...request, session: createChatSession({ isTemp: true }),
  }, options), undefined);

  const mismatched = toAuthoritativeSession({
    sessionId: 'chat-binding-1',
    collaborationMode: 'takeover',
    messages: [],
    summary: { text: 'Server context', coveredMessageCount: 0, updatedAt },
    toolResults: [],
    knowledgeRefs: [],
    tokenBudget: { maxTokens: 100_000, usedTokens: 100, reservedTokens: 5_000 },
    confirmations: [],
    checkpoints: [],
    lastHeartbeatAt: updatedAt,
    createdAt: '2026-07-22T08:00:00.000Z',
    updatedAt,
  }, ownerId);
  assert.equal(store.storeOwnerSession(ownerId, mismatched), true);
  assert.equal(await resolveChatAgentRunSessionId({
    ...request, session: createChatSession(),
  }, options), undefined);
  assert.equal(requestCount, 0);
});

test('bounds the optional Session promotion so Agent Run creation can fall back unbound', async () => {
  const ownerId = 'owner-binding-a';
  let aborted = false;
  const client: ChatAgentSessionWriteClient = {
    async getAgentSession(_sessionId, options) {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('Timed out', 'AbortError'));
        }, { once: true });
      });
    },
    async listAssets() { throw new Error('No attachments should be resolved.'); },
    async createAsset() { throw new Error('No attachments should be created.'); },
    async upsertAgentSession(input) { return sessionResponse(toAuthoritativeSession(input, ownerId)); },
  };

  const sessionId = await resolveChatAgentRunSessionId({
    session: createChatSession(), collaborationMode: 'assist', maxTokens: 100_000,
  }, {
    ownerId,
    getOwnerId: () => ownerId,
    client,
    store: new AgentSessionProjectionStore(() => ownerId),
    timeoutMs: 5,
  });

  assert.equal(sessionId, undefined);
  assert.equal(aborted, true);
});
