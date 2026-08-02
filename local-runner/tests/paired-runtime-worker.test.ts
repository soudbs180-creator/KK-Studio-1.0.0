import assert from 'node:assert/strict';
import test from 'node:test';

import { PairedRuntimeWorker } from '../src/services/pairedRuntimeWorker';

const RUNTIME_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const CREDENTIAL = 'paired-runtime-credential-value-123456';

test('paired runtime worker heartbeats, claims, executes, and completes over outbound HTTPS', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    { success: true, data: { runtimeId: RUNTIME_ID, status: 'online', lastHeartbeatAt: '2026-08-02T00:00:00.000Z' } },
    {
      success: true,
      data: {
        commandId: COMMAND_ID,
        runId: 'run-1',
        kind: 'agent_run',
        leaseToken: 'x'.repeat(32),
        leaseExpiresAt: '2026-08-02T00:00:30.000Z',
        attempt: 1,
        executionEnvelope: {
          schemaVersion: 1,
          kind: 'agent_run',
          runId: 'run-1',
          commands: [{ kind: 'inspect_page', target: 'https://www.google.com/' }],
        },
      },
    },
    { success: true, data: { accepted: true, idempotent: false } },
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  let executedRunId = '';
  const worker = new PairedRuntimeWorker({
    apiBaseUrl: 'https://api.example.test/',
    runtimeId: RUNTIME_ID,
    credential: CREDENTIAL,
    capabilityManifest: {
      schemaVersion: 1,
      runtimeVersion: '1.6.1',
      tools: ['browser.inspectPage'],
      siteAdapters: ['google'],
    },
    now: () => Date.parse('2026-08-02T00:00:00.000Z'),
    fetchImpl,
    executeCommand: async (command) => {
      executedRunId = command.runId;
      return { status: 'completed', resultSummary: 'Page inspected.' };
    },
  });

  await worker.runOnce();

  assert.equal(executedRunId, 'run-1');
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /\/heartbeat$/);
  assert.match(calls[1].url, /\/commands\/claim$/);
  assert.match(calls[2].url, new RegExp(`/commands/${COMMAND_ID}/result$`));
  const completion = JSON.parse(String(calls[2].init?.body));
  assert.equal(completion.status, 'completed');
  for (const call of calls) {
    assert.equal((call.init?.headers as Record<string, string>)['x-kk-runtime-credential'], CREDENTIAL);
    assert.doesNotMatch(call.url, new RegExp(CREDENTIAL));
    assert.doesNotMatch(String(call.init?.body || ''), new RegExp(CREDENTIAL));
  }
});

test('paired runtime worker rejects non-loopback plaintext control planes', () => {
  assert.throws(() => new PairedRuntimeWorker({
    apiBaseUrl: 'http://api.example.test/',
    runtimeId: RUNTIME_ID,
    credential: CREDENTIAL,
    capabilityManifest: {
      schemaVersion: 1,
      runtimeVersion: '1.6.1',
      tools: [],
      siteAdapters: [],
    },
    executeCommand: async () => ({ status: 'completed' }),
  }), /HTTPS or loopback HTTP/);
});
