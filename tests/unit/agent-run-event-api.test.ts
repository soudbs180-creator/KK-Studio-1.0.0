import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  AgentRunEventListDtoSchema,
  createKkApiClient,
} from '../../packages/shared/src/index.ts';

const require = createRequire(import.meta.url);

function createEventRow(sequence = 2) {
  return {
    owned_run_id: 'run-1',
    run_id: 'run-1',
    sequence,
    event_type: 'run_snapshot',
    status: 'running',
    run_updated_at: new Date('2026-07-22T01:00:00.000Z'),
    created_at: new Date('2026-07-22T01:00:01.000Z'),
  };
}

test('Agent Run event DTO accepts only bounded operational metadata', () => {
  const events = AgentRunEventListDtoSchema.parse([{
    runId: 'run-1',
    sequence: 1,
    type: 'run_snapshot',
    status: 'planning',
    runUpdatedAt: '2026-07-22T01:00:00.000Z',
    createdAt: '2026-07-22T01:00:01.000Z',
  }]);

  assert.equal(events[0]?.sequence, 1);
  assert.throws(() => AgentRunEventListDtoSchema.parse([{
    ...events[0],
    userMessage: 'must not enter the event log',
  }]));
});

test('typed client reads Agent Run events with an encoded bounded cursor', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), method: String(init?.method || 'GET') });
      return new Response(JSON.stringify({ ok: true, data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(typeof client.listAgentRunEvents, 'function');
  await client.listAgentRunEvents('run/with space', { afterSequence: 7 });
  await client.listAgentRunEvents('run-2');

  assert.deepEqual(requests, [
    {
      url: 'https://api.example.test/api/ai-assistant/runs/run%2Fwith%20space/events?afterSequence=7',
      method: 'GET',
    },
    { url: 'https://api.example.test/api/ai-assistant/runs/run-2/events', method: 'GET' },
  ]);
});

test('Agent Run event store scopes one bounded query by owner, run, and cursor', async () => {
  const eventStore = require('../../services/api/lib/agent-run-event-store.js');
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    async query(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      return { rows: [createEventRow()] };
    },
  };

  const events = await eventStore.listAgentRunEvents('owner-a', 'run-1', 1, { client });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /user_id\s*=\s*\$2/i);
  assert.match(calls[0].sql, /sequence\s*>\s*\$3/i);
  assert.match(calls[0].sql, /ORDER BY event\.sequence ASC/i);
  assert.match(calls[0].sql, /LIMIT \$4/i);
  assert.deepEqual(calls[0].params, ['run-1', 'owner-a', 1, 100]);
  assert.deepEqual(events, [{
    runId: 'run-1',
    sequence: 2,
    type: 'run_snapshot',
    status: 'running',
    runUpdatedAt: '2026-07-22T01:00:00.000Z',
    createdAt: '2026-07-22T01:00:01.000Z',
  }]);

  const missing = await eventStore.listAgentRunEvents('owner-b', 'run-1', 0, {
    client: { async query() { return { rows: [] }; } },
  });
  assert.equal(missing, null);
});

test('Agent Run event route validates cursors and preserves owner-scoped 404', async () => {
  const eventStore = require('../../services/api/lib/agent-run-event-store.js');
  const originalList = eventStore.listAgentRunEvents;
  const router = require('../../services/api/routes/ai-assistant.js');
  const routeLayer = router.stack.find((layer: RouteLayer) => (
    layer.route?.path === '/ai-assistant/runs/:runId/events'
    && layer.route.methods?.get === true
  ));
  assert.ok(routeLayer);
  const cursors: number[] = [];
  eventStore.listAgentRunEvents = async (_ownerId: string, runId: string, afterSequence: number) => {
    cursors.push(afterSequence);
    return runId === 'missing-run' ? null : [];
  };

  try {
    const invalid = await invokeHandler(routeLayer.route.stack[1].handle, {
      userId: 'owner-a',
      params: { runId: 'run-1' },
      query: { afterSequence: '-1' },
    });
    const listed = await invokeHandler(routeLayer.route.stack[1].handle, {
      userId: 'owner-a',
      params: { runId: 'run-1' },
      query: { afterSequence: '8' },
    });
    const missing = await invokeHandler(routeLayer.route.stack[1].handle, {
      userId: 'owner-a',
      params: { runId: 'missing-run' },
      query: {},
    });

    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(listed.body, { ok: true, data: [] });
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(cursors, [8, 0]);
  } finally {
    eventStore.listAgentRunEvents = originalList;
  }
});

interface RouteLayer {
  route?: {
    path?: string;
    methods?: { get?: boolean };
    stack: Array<{ handle: RouteHandler }>;
  };
}

type RouteHandler = (
  request: Record<string, unknown>,
  response: Record<string, unknown>,
) => unknown;

async function invokeHandler(handler: RouteHandler, request: Record<string, unknown>) {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  };
  await handler(request, response);
  return { statusCode, body };
}
