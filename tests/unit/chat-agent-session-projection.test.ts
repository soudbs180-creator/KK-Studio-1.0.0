import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentSessionDto } from '@kk/shared';
import {
  buildAgentSessionProjection,
  type ChatSessionProjectionEvidence,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatAgentSessionProjection.ts';
import { buildChatAgentContextPlan } from '../../apps/web/src/components/layout/chat-sidebar/session/chatAgentContextBudget.ts';
import { createChatContextCompression } from '../../apps/web/src/components/layout/chat-sidebar/session/chatContextCompression.ts';
import type {
  ChatSessionItem,
  Message,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';

const timestamp = Date.parse('2026-07-22T08:00:00.000Z');

const createSession = (messages: Message[]): ChatSessionItem => ({
  id: 'chat-session-1',
  title: 'Projection test',
  messages,
  updatedAt: timestamp,
});

const createEvidence = (
  overrides: Partial<ChatSessionProjectionEvidence> = {},
): ChatSessionProjectionEvidence => ({
  ownerId: 'owner-a',
  collaborationMode: 'assist',
  summary: {
    text: 'Validated conversation summary',
    coveredMessageCount: 1,
    updatedAt: '2026-07-22T08:00:00.000Z',
  },
  tokenBudget: { maxTokens: 100_000, usedTokens: 120, reservedTokens: 2_000 },
  canonicalAssetIds: {},
  createdAt: '2026-07-22T07:59:00.000Z',
  heartbeatAt: '2026-07-22T08:00:01.000Z',
  ...overrides,
});

const userMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'message-1',
  role: 'user',
  content: 'Continue the project',
  timestamp,
  ...overrides,
});

test('Chat projection requires explicit summary and token evidence before creating a bounded DTO', () => {
  const result = buildAgentSessionProjection(createSession([userMessage()]), createEvidence());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.sessionId, 'chat-session-1');
  assert.equal(result.data.messages.length, 1);
  assert.equal(result.data.messages[0].createdAt, '2026-07-22T08:00:00.000Z');
  assert.deepEqual(result.data.summary, createEvidence().summary);
  assert.deepEqual(result.data.tokenBudget, createEvidence().tokenBudget);
});

test('canonical compression and budget outputs satisfy the strict Session projection gate', () => {
  const compression = createChatContextCompression({
    summaryText: 'Structured summary',
    coveredMessageCount: 1,
    modelId: 'model-1',
    timestamp,
  });
  assert.ok(compression);
  const plan = buildChatAgentContextPlan({
    maxTokens: 100_000,
    systemRules: 'Follow the verified plan.',
    summary: compression.summary,
    messages: [userMessage()],
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;

  const result = buildAgentSessionProjection(createSession([userMessage()]), createEvidence({
    summary: compression.summary,
    tokenBudget: plan.data.tokenBudget,
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.summary, compression.summary);
  assert.deepEqual(result.data.tokenBudget, plan.data.tokenBudget);
});

test('Chat projection never infers an Asset id from attachment data, URLs, or local ids', () => {
  const session = createSession([userMessage({
    attachments: [{
      id: 'local-random-id',
      type: 'image',
      name: 'private.png',
      data: 'data:image/png;base64,do-not-copy',
      mimeType: 'image/png',
    }],
  })]);

  const result = buildAgentSessionProjection(session, createEvidence());

  assert.deepEqual(result, { ok: false, reason: 'unresolved_attachment' });
  assert.equal(JSON.stringify(result).includes('do-not-copy'), false);
});

test('Chat projection accepts only an explicit canonical Asset mapping', () => {
  const session = createSession([userMessage({
    attachments: [{
      id: 'local-random-id',
      type: 'document',
      name: 'brief.pdf',
      data: 'https://temporary.example/brief.pdf',
      mimeType: 'application/pdf',
    }],
  })]);
  const result = buildAgentSessionProjection(session, createEvidence({
    canonicalAssetIds: { 'local-random-id': 'asset-canonical-7' },
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.messages[0].attachments, [{
    assetId: 'asset-canonical-7',
    kind: 'document',
    name: 'brief.pdf',
    mimeType: 'application/pdf',
  }]);
  assert.equal(JSON.stringify(result.data).includes('temporary.example'), false);
});

test('Chat projection fails closed for temporary Sessions, URL attachments, and invalid evidence', () => {
  const temporary = { ...createSession([userMessage()]), isTemp: true };
  assert.deepEqual(
    buildAgentSessionProjection(temporary, createEvidence()),
    { ok: false, reason: 'temporary_session' },
  );
  const unsupported = createSession([userMessage({
    attachments: [{ id: 'url-1', type: 'url', name: 'site', data: 'https://example.com' }],
  })]);
  assert.deepEqual(
    buildAgentSessionProjection(unsupported, createEvidence({ canonicalAssetIds: { 'url-1': 'asset-1' } })),
    { ok: false, reason: 'unsupported_attachment' },
  );
  const invalidBudget = createEvidence({
    tokenBudget: { maxTokens: 100, usedTokens: 90, reservedTokens: 20 },
  });
  assert.deepEqual(
    buildAgentSessionProjection(createSession([userMessage()]), invalidBudget),
    { ok: false, reason: 'invalid_projection' },
  );
  const invalidTimestamp = createSession([userMessage({ timestamp: Number.NaN })]);
  assert.deepEqual(
    buildAgentSessionProjection(invalidTimestamp, createEvidence()),
    { ok: false, reason: 'invalid_projection' },
  );
});

test('Chat projection preserves authoritative non-Chat state instead of erasing it', () => {
  const base = {
    ...buildAgentSessionProjection(createSession([userMessage()]), createEvidence()),
  };
  assert.equal(base.ok, true);
  if (!base.ok) return;
  const authoritativeBase: AgentSessionDto = {
    ...base.data,
    ownerId: 'owner-a',
    toolResults: [{
      id: 'tool-result-1', toolName: 'canvas.getState', outcome: 'success',
      outputSummary: 'Canvas state read', createdAt: '2026-07-22T08:00:00.000Z',
    }],
    knowledgeRefs: [{ documentId: 'doc-1', title: 'Architecture facts' }],
  };
  const result = buildAgentSessionProjection(
    createSession([userMessage({ content: 'Continue safely' })]),
    createEvidence({ authoritativeBase }),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.toolResults, authoritativeBase.toolResults);
  assert.deepEqual(result.data.knowledgeRefs, authoritativeBase.knowledgeRefs);
  assert.deepEqual(
    buildAgentSessionProjection(
      createSession([userMessage()]),
      createEvidence({ ownerId: 'owner-b', authoritativeBase }),
    ),
    { ok: false, reason: 'invalid_projection' },
  );
});
