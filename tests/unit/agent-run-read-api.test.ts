import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createKkApiClient } from '../../packages/shared/src/index.ts';

const require = createRequire(import.meta.url);

function createRunRow(id = 'run-1') {
  return {
    id,
    user_id: 'owner-a',
    user_message: `message-${id}`,
    intent: 'help',
    plan: { id: `plan-${id}` },
    status: 'running',
    step_results: [],
    created_at: new Date('2026-07-22T00:00:00.000Z'),
    updated_at: new Date('2026-07-22T00:00:01.000Z'),
  };
}

function createToolRow(runId = 'run-1') {
  return {
    id: `tool-${runId}`,
    run_id: runId,
    tool_name: 'canvas.getState',
    input_summary: '{}',
    status: 'success',
    started_at: new Date('2026-07-22T00:00:00.500Z'),
  };
}

test('typed client exposes Agent Run list/get through additive read paths', async () => {
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

  assert.equal(typeof client.listAgentRuns, 'function');
  assert.equal(typeof client.getAgentRun, 'function');
  await client.listAgentRuns();
  await client.getAgentRun('run/with space');

  assert.deepEqual(requests, [
    { url: 'https://api.example.test/api/ai-assistant/runs', method: 'GET' },
    { url: 'https://api.example.test/api/ai-assistant/runs/run%2Fwith%20space', method: 'GET' },
  ]);
});

test('Agent Run read store scopes list/get and attaches tool calls without N+1', async () => {
  const readStore = require('../../services/api/lib/agent-run-read-store.js');
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [createRunRow('run-2'), createRunRow()] };
      return { rows: [createToolRow(), createToolRow('run-2')] };
    },
  };

  const runs = await readStore.listAgentRuns('owner-a', { client });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /user_id\s*=\s*\$1/i);
  assert.match(calls[0].sql, /ORDER BY updated_at DESC, id DESC/i);
  assert.match(calls[0].sql, /LIMIT \$2/i);
  assert.deepEqual(calls[0].params, ['owner-a', 50]);
  assert.deepEqual(calls[1].params, [['run-2', 'run-1']]);
  assert.deepEqual(runs.map((run: { id: string }) => run.id), ['run-2', 'run-1']);
  assert.deepEqual(runs[1].toolCalls.map((call: { id: string }) => call.id), ['tool-run-1']);
  assert.equal(JSON.stringify(runs).includes('owner-a'), false);

  const getCalls: Array<{ sql: string; params: unknown[] }> = [];
  const getClient = {
    async query(sql: string, params: unknown[] = []) {
      getCalls.push({ sql, params });
      if (getCalls.length === 1) return { rows: [createRunRow()] };
      return { rows: [createToolRow()] };
    },
  };
  const run = await readStore.getAgentRun('owner-a', 'run-1', { client: getClient });

  assert.match(getCalls[0].sql, /id\s*=\s*\$1\s+AND user_id\s*=\s*\$2/i);
  assert.deepEqual(getCalls[0].params, ['run-1', 'owner-a']);
  assert.deepEqual(run.toolCalls.map((call: { id: string }) => call.id), ['tool-run-1']);
});

test('Agent Run GET routes use authenticated owner and hide missing runs with 404', async () => {
  const readStore = require('../../services/api/lib/agent-run-read-store.js');
  const originalList = readStore.listAgentRuns;
  const originalGet = readStore.getAgentRun;
  const router = require('../../services/api/routes/ai-assistant.js');
  const listLayer = router.stack.find((layer: { route?: { path?: string; methods?: { get?: boolean } } }) => (
    layer.route?.path === '/ai-assistant/runs' && layer.route.methods?.get
  ));
  const getLayer = router.stack.find((layer: { route?: { path?: string; methods?: { get?: boolean } } }) => (
    layer.route?.path === '/ai-assistant/runs/:runId' && layer.route.methods?.get
  ));
  assert.ok(listLayer && getLayer);
  const owners: string[] = [];
  readStore.listAgentRuns = async (ownerId: string) => {
    owners.push(ownerId);
    return [];
  };
  readStore.getAgentRun = async (ownerId: string) => {
    owners.push(ownerId);
    return null;
  };

  try {
    const listed = await invokeHandler(listLayer.route.stack[1].handle, { userId: 'owner-a' });
    const missing = await invokeHandler(getLayer.route.stack[1].handle, {
      userId: 'owner-a',
      params: { runId: 'missing-run' },
    });
    assert.deepEqual(listed.body, { ok: true, data: [] });
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(owners, ['owner-a', 'owner-a']);
  } finally {
    readStore.listAgentRuns = originalList;
    readStore.getAgentRun = originalGet;
  }
});

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
