import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { AgentRunDtoSchema } from '@kk/shared';
import { readSource } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);

const makeRunDto = (sessionId?: string) => ({
  id: 'run-binding-1',
  sessionId,
  userMessage: 'bind this run',
  intent: 'workspace_task',
  plan: { id: 'plan-binding-1', actions: [] },
  status: 'waiting_execution',
  toolCalls: [],
  stepResults: [],
  createdAt: '2026-07-22T02:00:00.000Z',
  updatedAt: '2026-07-22T02:00:00.000Z',
});

const makeRunRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-binding-1',
  user_id: 'binding-owner-a',
  session_id: 'session-binding-1',
  user_message: 'bind this run',
  intent: 'workspace_task',
  plan: { id: 'plan-binding-1', actions: [] },
  status: 'waiting_execution',
  step_results: [],
  created_at: '2026-07-22T02:00:00.000Z',
  updated_at: '2026-07-22T02:00:00.000Z',
  ...overrides,
});

test('Agent Run DTO accepts one bounded optional Session binding', () => {
  assert.equal(AgentRunDtoSchema.parse(makeRunDto('session-binding-1')).sessionId, 'session-binding-1');
  assert.equal(AgentRunDtoSchema.parse(makeRunDto()).sessionId, undefined);
  assert.equal(AgentRunDtoSchema.safeParse(makeRunDto('x'.repeat(201))).success, false);
});

test('migration 022 enforces an owner-matched Run to Session foreign key', () => {
  const migrationPath = 'infrastructure/database/migrations/022_agent_run_session_binding.sql';
  assert.equal(existsSync(migrationPath), true);
  const migration = readSource(migrationPath);

  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS session_id text/);
  assert.match(migration, /UNIQUE \(id, user_id\)/);
  assert.match(migration, /FOREIGN KEY \(session_id, user_id\)/);
  assert.match(migration, /REFERENCES public\.agent_sessions \(id, user_id\)/);
  assert.match(migration, /agent_runs_session_updated_idx/);
  assert.match(migration, /ROW\(NEW\.status, NEW\.plan, NEW\.step_results, NEW\.session_id, NEW\.updated_at\)/);
  assert.match(migration, /COMMIT;\s*$/);

  for (const path of [
    'scripts/ops/vps/bootstrap-kk-vps.sh',
    'scripts/ops/setup/setup-database.bat',
    'scripts/ops/postgres/import-runtime-into-vps.sh',
    'scripts/ops/vps/deploy-kk-vps.sh',
  ]) {
    const source = readSource(path);
    assert.ok(source.indexOf('021_agent_sessions.sql') < source.indexOf('022_agent_run_session_binding.sql'));
  }
  const deploy = readSource('scripts/ops/vps/deploy-kk-vps.sh');
  assert.match(deploy, /agent_runs\.session_id is missing or its owner binding is invalid/);
});

test('Run write store accepts only owned Sessions and keeps an established binding immutable', async () => {
  const { upsertAgentRun } = require('../../services/api/lib/agent-run-write-store.js');
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    async query(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      return { rows: [makeRunRow()] };
    },
  };

  const result = await upsertAgentRun('binding-owner-a', makeRunDto('session-binding-1'), { client });

  assert.equal(result.outcome, 'accepted');
  assert.equal(result.data?.sessionId, 'session-binding-1');
  assert.match(calls[0].sql, /FROM public\.agent_sessions/);
  assert.match(calls[0].sql, /session\.user_id = \$2/);
  assert.match(calls[0].sql, /COALESCE\(current_run\.session_id, EXCLUDED\.session_id\)/);
  assert.match(calls[0].sql, /EXCLUDED\.session_id IS NULL/);
  assert.deepEqual(calls[0].params.slice(0, 3), ['run-binding-1', 'binding-owner-a', 'bind this run']);
  assert.equal(calls[0].params[8], 'session-binding-1');
  assert.equal(calls[0].params[9], 'local-desktop');
});

test('Run write store distinguishes missing, immutable, stale, and cross-owner conflicts', async () => {
  const { upsertAgentRun } = require('../../services/api/lib/agent-run-write-store.js');
  const run = makeRunDto('session-binding-1');
  const outcomeFor = async (existingRow?: Record<string, unknown>) => {
    let queryCount = 0;
    const client = {
      async query() {
        queryCount += 1;
        return queryCount === 1 ? { rows: [] } : { rows: existingRow ? [existingRow] : [] };
      },
    };
    return (await upsertAgentRun('binding-owner-a', run, { client })).outcome;
  };

  assert.equal(await outcomeFor(), 'session_conflict');
  assert.equal(await outcomeFor(makeRunRow({ session_id: 'session-other' })), 'binding_conflict');
  assert.equal(await outcomeFor(makeRunRow()), 'stale');
  assert.equal(await outcomeFor(makeRunRow({ user_id: 'binding-owner-b' })), 'ownership_conflict');
});

test('Run routes delegate writes and preserve conflict-specific envelopes', () => {
  const route = readSource('services/api/routes/ai-assistant.js');
  const mapping = readSource('services/api/lib/ai-assistant-dto.js');

  assert.match(route, /agentRunWriteStore\.upsertPairedAgentRun/);
  assert.match(route, /agentRunWriteStore\.upsertAgentRun/);
  assert.match(route, /const outcome = await writeRun\(req\.userId/);
  assert.match(route, /Agent session ownership conflict/);
  assert.match(route, /Agent run Session binding conflict/);
  assert.match(route, /outcome\.outcome === 'stale'[\s\S]*stale: true/);
  assert.doesNotMatch(route, /stale: outcome\.outcome === 'stale'/);
  assert.match(mapping, /sessionId: row\.session_id/);
});

test('Chat takeover passes only the asynchronously resolved authoritative Session binding into a new Run', () => {
  const sidebar = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const takeoverContext = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');

  assert.match(sidebar, /resolveChatAgentRunSessionId\(\{[\s\S]*session: activeSession, collaborationMode, maxTokens/);
  assert.match(sidebar, /sendTakeoverMessage\(userText, sessionBinding\)/);
  assert.match(takeoverContext, /sessionBinding\?: Promise<string \| undefined>/);
  assert.match(takeoverContext, /const sessionId = await sessionBinding\?\.catch\(\(\) => undefined\)/);
  assert.match(takeoverContext, /agentRuntimeInstance\.run\(text, projectContext, selectedModel\?\.id, sessionId\)/);
});
