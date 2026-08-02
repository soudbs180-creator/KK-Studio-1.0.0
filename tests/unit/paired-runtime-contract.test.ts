import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  AgentRunDtoSchema,
  CompletePairedRuntimeCommandRequestSchema,
  PairedRuntimeCommandSchema,
  PairedRuntimeExecutionEnvelopeSchema,
  RegisterPairedRuntimeRequestSchema,
  createKkApiClient,
} from '../../packages/shared/src/index.ts';

const NOW = '2026-08-02T00:00:00.000Z';
const RUNTIME_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';

test('paired runtime DTOs require owner-safe bounded manifests and leases', () => {
  const registration = RegisterPairedRuntimeRequestSchema.parse({
    displayName: 'Studio desktop',
    capabilityManifest: {
      schemaVersion: 1,
      runtimeVersion: '1.6.1',
      tools: ['browser.open'],
      siteAdapters: ['google'],
    },
  });
  assert.equal(registration.capabilityManifest.siteAdapters[0], 'google');

  const command = PairedRuntimeCommandSchema.parse({
    commandId: COMMAND_ID,
    runId: 'run-1',
    kind: 'agent_run',
    leaseToken: 'x'.repeat(32),
    leaseExpiresAt: NOW,
    attempt: 1,
    executionEnvelope: {
      schemaVersion: 1,
      kind: 'agent_run',
      runId: 'run-1',
      commands: [{ kind: 'inspect_page', target: 'https://www.google.com/' }],
    },
  });
  assert.equal(command.kind, 'agent_run');
  assert.equal(PairedRuntimeExecutionEnvelopeSchema.safeParse({
    ...command.executionEnvelope,
    commands: [{ kind: 'click', target: 'https://www.google.com/' }],
  }).success, false);
  assert.equal(CompletePairedRuntimeCommandRequestSchema.safeParse({
    leaseToken: 'x'.repeat(32),
    status: 'failed',
  }).success, false);
});

test('paired Agent Runs require a runtime and local runs cannot smuggle one', () => {
  const baseRun = {
    id: 'run-1',
    userMessage: 'inspect',
    intent: 'browser',
    plan: {},
    status: 'waiting_execution',
    toolCalls: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
  assert.equal(AgentRunDtoSchema.safeParse({
    ...baseRun,
    executionTarget: 'paired-desktop',
  }).success, false);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...baseRun,
    executionTarget: 'paired-desktop',
    pairedRuntimeId: RUNTIME_ID,
  }).success, true);
  assert.equal(AgentRunDtoSchema.safeParse({
    ...baseRun,
    executionTarget: 'local-desktop',
    pairedRuntimeId: RUNTIME_ID,
  }).success, false);
});

test('paired runtime API client sends credentials only in the dedicated header', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await client.claimPairedRuntimeCommand(RUNTIME_ID, 'private-runtime-credential');
  assert.match(calls[0].url, /paired-runtimes\/.*\/commands\/claim$/);
  assert.equal((calls[0].init?.headers as Record<string, string>)['x-kk-runtime-credential'], 'private-runtime-credential');
  assert.doesNotMatch(String(calls[0].init?.body || ''), /private-runtime-credential/);
});

test('paired runtime queue accepts only a matching strict execution envelope', async () => {
  const module = await import('../../services/api/lib/paired-runtime-store.js');
  const { enqueueAgentRunCommand } = module.default || module;
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      queries.push({ sql, values });
      return { rows: [{ id: COMMAND_ID }] };
    },
  };
  const baseRun = {
    id: 'run-1',
    executionTarget: 'paired-desktop',
    pairedRuntimeId: RUNTIME_ID,
  };

  await assert.rejects(
    enqueueAgentRunCommand('owner-1', { ...baseRun, plan: {} }, { client }),
    (error: Error & { code?: string }) => error.code === 'INVALID_PAIRED_RUNTIME_ENVELOPE',
  );
  assert.equal(queries.length, 0);

  await enqueueAgentRunCommand('owner-1', {
    ...baseRun,
    plan: {
      pairedExecution: {
        schemaVersion: 1,
        kind: 'agent_run',
        runId: 'run-1',
        commands: [{ kind: 'extract_product', target: 'https://www.google.com/' }],
      },
    },
  }, { client });
  const persistedEnvelope = JSON.parse(String(queries[0].values?.[5]));
  assert.equal(persistedEnvelope.runId, 'run-1');
  assert.equal(persistedEnvelope.commands[0].kind, 'extract_product');
});

test('paired runtime migrations and server store enforce owner scope, leases, and idempotency', () => {
  const migration = fs.readFileSync('infrastructure/database/migrations/030_paired_runtimes.sql', 'utf8');
  const extensionMigration = fs.readFileSync('infrastructure/database/migrations/031_agent_extensions.sql', 'utf8');
  const store = fs.readFileSync('services/api/lib/paired-runtime-store.js', 'utf8');
  const routes = fs.readFileSync('services/api/routes/paired-runtimes.js', 'utf8');
  const deployScript = fs.readFileSync('scripts/ops/vps/deploy-kk-vps.sh', 'utf8');
  const bootstrapScript = fs.readFileSync('scripts/ops/vps/bootstrap-kk-vps.sh', 'utf8');
  const importScript = fs.readFileSync('scripts/ops/postgres/import-runtime-into-vps.sh', 'utf8');
  const mobileSources = fs.readdirSync('apps/mobile/src', { recursive: true })
    .filter((entry) => typeof entry === 'string' && /\.(ts|tsx)$/.test(entry))
    .map((entry) => fs.readFileSync(`apps/mobile/src/${entry}`, 'utf8'))
    .join('\n');

  assert.match(migration, /paired_runtimes/);
  assert.match(migration, /paired_runtime_commands/);
  assert.match(migration, /UNIQUE \(user_id, idempotency_key\)/);
  assert.match(migration, /ROW LEVEL SECURITY/i);
  assert.match(extensionMigration, /agent_extensions/);
  assert.match(extensionMigration, /secret_ref/);
  assert.match(store, /timingSafeEqual/);
  assert.match(store, /FOR UPDATE SKIP LOCKED/);
  assert.match(store, /PairedRuntimeExecutionEnvelopeSchema/);
  assert.match(store, /executionEnvelope/);
  assert.match(store, /credential_expires_at/);
  assert.match(store, /revoked_at/);
  assert.match(routes, /RUNTIME_HEARTBEAT_UNAVAILABLE/);
  assert.match(routes, /RUNTIME_COMMAND_CLAIM_UNAVAILABLE/);
  assert.match(routes, /RUNTIME_COMMAND_RESULT_UNAVAILABLE/);
  for (const script of [deployScript, bootstrapScript, importScript]) {
    assert.match(script, /029_provider_connection_routing_priority\.sql/);
    assert.match(script, /030_paired_runtimes\.sql/);
    assert.match(script, /031_agent_extensions\.sql/);
  }
  assert.doesNotMatch(mobileSources, /opencli|OpencliClient|localhost:9099/i);
});
