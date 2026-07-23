import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { AgentRunEventListDtoSchema } from '../../packages/shared/src/index.ts';
import { readSource } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);
const MIGRATION_PATH = 'infrastructure/database/migrations/024_agent_run_replan_events.sql';
const OCCURRED_AT = '2026-07-24T01:02:03.000Z';

function createReplanEvent(count = 1) {
  return {
    runId: 'run-replan-1',
    sequence: 3,
    type: 'replan',
    status: 'running',
    runUpdatedAt: OCCURRED_AT,
    createdAt: OCCURRED_AT,
    replan: {
      count,
      reasonCode: 'plan_replaced',
      triggerCode: 'accepted_plan_change',
    },
  };
}

test('Agent Run replan events are strict, bounded, and metadata-only', () => {
  const parsed = AgentRunEventListDtoSchema.parse([createReplanEvent()]);

  assert.equal(parsed[0]?.type, 'replan');
  assert.throws(() => AgentRunEventListDtoSchema.parse([createReplanEvent(4)]));
  assert.throws(() => AgentRunEventListDtoSchema.parse([{
    ...createReplanEvent(),
    replan: {
      ...createReplanEvent().replan,
      reason: 'free-form planner output must not enter replay metadata',
    },
  }]));
  assert.throws(() => AgentRunEventListDtoSchema.parse([{
    ...createReplanEvent(),
    payload: { plan: { steps: ['secret'] } },
  }]));
});

test('migration 024 derives at most three replan events from accepted plan changes', () => {
  assert.equal(existsSync(MIGRATION_PATH), true);
  const migration = readSource(MIGRATION_PATH);

  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS replan_count integer NOT NULL DEFAULT 0/);
  assert.match(migration, /replan_count BETWEEN 0 AND 3/);
  assert.match(migration, /event_type IN \('run_snapshot', 'step_outcome', 'replan'\)/);
  assert.match(migration, /NEW\.plan IS DISTINCT FROM OLD\.plan/);
  assert.match(migration, /OLD\.replan_count >= 3/);
  assert.match(migration, /'plan_replaced'/);
  assert.match(migration, /'accepted_plan_change'/);
  assert.doesNotMatch(migration, /\bpayload\b|\buser_message\b|\btool_input\b|\btool_output\b/i);
  assert.match(migration, /COMMIT;\s*$/);
});

test('Run writes reject a fourth plan replacement without trusting client replanCount', async () => {
  const { upsertAgentRun } = require('../../services/api/lib/agent-run-write-store.js');
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const input = {
    id: 'run-replan-1',
    userMessage: 'replace the failed plan',
    intent: 'workspace_task',
    plan: { id: 'plan-replacement', actions: [] },
    status: 'running',
    toolCalls: [],
    stepResults: [],
    replanCount: 99,
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT,
  };
  const client = {
    async query(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      return { rows: [{
        id: input.id,
        user_id: 'owner-replan',
        user_message: input.userMessage,
        intent: input.intent,
        plan: input.plan,
        status: input.status,
        step_results: [],
        replan_count: 2,
        created_at: OCCURRED_AT,
        updated_at: OCCURRED_AT,
      }] };
    },
  };

  const result = await upsertAgentRun('owner-replan', input, { client });

  assert.match(calls[0]?.sql || '', /current_run\.plan = EXCLUDED\.plan[\s\S]*current_run\.replan_count < 3/);
  assert.equal(calls[0]?.params.includes(99), false);
  assert.equal(result.data?.replanCount, 2);
});

test('event store maps structured replan metadata through the owner-scoped query', async () => {
  const eventStore = require('../../services/api/lib/agent-run-event-store.js');
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const events = await eventStore.listAgentRunEvents('owner-replan', 'run-replan-1', 2, {
    client: {
      async query(sql: string, params: unknown[]) {
        calls.push({ sql, params });
        return { rows: [{
          owned_run_id: 'run-replan-1',
          run_id: 'run-replan-1',
          sequence: 3,
          event_type: 'replan',
          status: 'running',
          run_updated_at: new Date(OCCURRED_AT),
          created_at: new Date(OCCURRED_AT),
          replan_count: 1,
          reason_code: 'plan_replaced',
          trigger_code: 'accepted_plan_change',
        }] };
      },
    },
  });

  assert.match(calls[0]?.sql || '', /event\.replan_count/);
  assert.deepEqual(events, [createReplanEvent()]);
});

test('database entrypoints apply replan events after semantic step outcomes', () => {
  const sources = [
    readSource('scripts/ops/vps/bootstrap-kk-vps.sh'),
    readSource('scripts/ops/setup/setup-database.bat'),
    readSource('scripts/ops/postgres/import-runtime-into-vps.sh'),
    readSource('scripts/ops/vps/deploy-kk-vps.sh'),
  ];

  for (const source of sources) {
    const semanticIndex = source.indexOf('023_agent_run_semantic_events.sql');
    const replanIndex = source.indexOf('024_agent_run_replan_events.sql');
    assert.ok(semanticIndex >= 0, 'missing step outcome migration');
    assert.ok(replanIndex > semanticIndex, 'replan migration must follow step outcomes');
  }
  const bootstrap = readSource('scripts/ops/postgres/bootstrap-kk-vps.sql');
  assert.match(bootstrap, /replan_count integer NOT NULL DEFAULT 0/);
  assert.match(bootstrap, /event_type IN \('run_snapshot', 'step_outcome', 'replan'\)/);
});
