import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  AgentContextSnapshotDtoSchema,
  AgentContextSnapshotInputDtoSchema,
  AgentSessionDtoSchema,
  AgentSessionUpsertDtoSchema,
  createKkApiClient,
} from '../../packages/shared/src/index.ts';

const require = createRequire(import.meta.url);

function createSessionInput() {
  return {
    sessionId: 'session-1',
    collaborationMode: 'assist' as const,
    messages: [{
      id: 'message-1', role: 'user' as const, content: '继续上一项工作', createdAt: '2026-07-22T02:00:00.000Z',
      attachments: [{ assetId: 'asset-1', kind: 'image' as const, name: 'reference.png' }],
    }],
    summary: { text: '用户要求继续工作', coveredMessageCount: 1, updatedAt: '2026-07-22T02:00:01.000Z' },
    toolResults: [],
    knowledgeRefs: [],
    tokenBudget: { maxTokens: 10000, usedTokens: 1200, reservedTokens: 500 },
    confirmations: [],
    checkpoints: [],
    lastHeartbeatAt: '2026-07-22T02:00:02.000Z',
    createdAt: '2026-07-22T02:00:00.000Z',
    updatedAt: '2026-07-22T02:00:02.000Z',
  };
}

function createContextInput() {
  return {
    snapshotId: 'snapshot-1',
    activeSurface: 'canvas' as const,
    canvasId: 'canvas-1',
    canvasSummary: { nodeCount: 4, selectedNodeCount: 1, generatedAssetCount: 2 },
    selectedNodeIds: ['node-1'],
    viewport: { x: 10, y: 20, width: 1280, height: 720, zoom: 1 },
    recentEvents: [{ id: 'event-1', type: 'selection_changed' as const, occurredAt: '2026-07-22T02:00:03.000Z' }],
    inputBox: { hasText: true, attachmentCount: 1 },
    availableTools: ['canvas.inspect'],
    capturedAt: '2026-07-22T02:00:03.000Z',
  };
}

test('Agent Session and Context schemas are bounded, strict, and privacy preserving', () => {
  const input = AgentSessionUpsertDtoSchema.parse(createSessionInput());
  const session = AgentSessionDtoSchema.parse({ ...input, ownerId: 'owner-a' });
  const contextInput = AgentContextSnapshotInputDtoSchema.parse(createContextInput());
  const snapshot = AgentContextSnapshotDtoSchema.parse({
    ...contextInput,
    sessionId: session.sessionId,
    sequence: 3,
    createdAt: '2026-07-22T02:00:04.000Z',
  });

  assert.equal(snapshot.sequence, 3);
  assert.throws(() => AgentSessionUpsertDtoSchema.parse({ ...input, ownerId: 'forged-owner' }));
  assert.throws(() => AgentContextSnapshotInputDtoSchema.parse({ ...contextInput, inputText: 'secret' }));
  assert.throws(() => AgentContextSnapshotInputDtoSchema.parse({ ...contextInput, payload: { raw: true } }));
  assert.throws(() => AgentSessionUpsertDtoSchema.parse({
    ...input,
    messages: [{ ...input.messages[0], attachments: [{ ...input.messages[0]?.attachments?.[0], data: 'base64' }] }],
  }));

  const { mapAgentContextSnapshotRow } = require('../../services/api/lib/ai-assistant-dto.js');
  const mapped = mapAgentContextSnapshotRow({
    snapshot_id: 'snapshot-authoritative',
    session_id: 'session-authoritative',
    sequence: '4',
    snapshot_data: { ...contextInput, payload: { secret: true }, sessionId: 'forged' },
    captured_at: new Date(contextInput.capturedAt),
    created_at: new Date('2026-07-22T02:00:04.000Z'),
  });
  assert.equal(mapped.sessionId, 'session-authoritative');
  assert.equal('payload' in mapped, false);
});

test('typed client exposes owner-neutral Session and Context Snapshot paths', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: async (request, init) => {
      requests.push({ url: String(request), method: String(init?.method || 'GET') });
      return new Response(JSON.stringify({ ok: true, data: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await client.listAgentSessions();
  await client.getAgentSession('session/one');
  await client.upsertAgentSession(createSessionInput());
  await client.appendAgentContextSnapshot('session/one', createContextInput());
  await client.getLatestAgentContextSnapshot('session/one');

  assert.deepEqual(requests, [
    { url: 'https://api.example.test/api/ai-assistant/sessions', method: 'GET' },
    { url: 'https://api.example.test/api/ai-assistant/sessions/session%2Fone', method: 'GET' },
    { url: 'https://api.example.test/api/ai-assistant/sessions', method: 'POST' },
    { url: 'https://api.example.test/api/ai-assistant/sessions/session%2Fone/context-snapshots', method: 'POST' },
    { url: 'https://api.example.test/api/ai-assistant/sessions/session%2Fone/context-snapshots/latest', method: 'GET' },
  ]);
});

test('Session store keeps owner checks and snapshot idempotency inside SQL', async () => {
  const store = require('../../services/api/lib/agent-session-store.js');
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = { async query(sql: string, params: unknown[]) { calls.push({ sql, params }); return { rows: [] }; } };

  await store.listAgentSessions('owner-a', { client });
  await store.getAgentSession('owner-a', 'session-1', { client });
  await store.upsertAgentSession('owner-a', createSessionInput(), { client });
  await store.appendAgentContextSnapshot('owner-a', 'session-1', createContextInput(), { client });
  await store.getLatestAgentContextSnapshot('owner-a', 'session-1', { client });

  assert.equal(calls.length, 5);
  assert.match(calls[0].sql, /WHERE user_id = \$1/i);
  assert.match(calls[1].sql, /id = \$1 AND user_id = \$2/i);
  assert.match(calls[2].sql, /ON CONFLICT \(id\)[\s\S]*user_id = EXCLUDED\.user_id/i);
  assert.match(calls[3].sql, /ON CONFLICT \(snapshot_id\) DO NOTHING/i);
  assert.match(calls[3].sql, /session\.user_id = \$3/i);
  assert.match(calls[4].sql, /ORDER BY snapshot\.sequence DESC/i);
});

interface RouteLayer {
  route?: { path?: string; methods?: { get?: boolean; post?: boolean }; stack: Array<{ handle: RouteHandler }> };
}
type RouteHandler = (request: Record<string, unknown>, response: Record<string, unknown>) => unknown;

async function invokeHandler(handler: RouteHandler, request: Record<string, unknown>) {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { body = value; return response; },
  };
  await handler(request, response);
  return { statusCode, body };
}

test('Session routes reject forged payloads and preserve owner-scoped not-found responses', async () => {
  const store = require('../../services/api/lib/agent-session-store.js');
  const originalGet = store.getAgentSession;
  const router = require('../../services/api/routes/ai-assistant.js');
  const upsertLayer = router.stack.find((layer: RouteLayer) => (
    layer.route?.path === '/ai-assistant/sessions' && layer.route.methods?.post
  ));
  const getLayer = router.stack.find((layer: RouteLayer) => (
    layer.route?.path === '/ai-assistant/sessions/:sessionId' && layer.route.methods?.get
  ));
  assert.ok(upsertLayer?.route && getLayer?.route);
  store.getAgentSession = async () => null;

  try {
    const invalid = await invokeHandler(upsertLayer.route.stack[1].handle, {
      userId: 'owner-a', body: { ...createSessionInput(), ownerId: 'owner-b' },
    });
    const missing = await invokeHandler(getLayer.route.stack[1].handle, {
      userId: 'owner-a', params: { sessionId: 'missing' },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(missing.statusCode, 404);
  } finally {
    store.getAgentSession = originalGet;
  }
});
