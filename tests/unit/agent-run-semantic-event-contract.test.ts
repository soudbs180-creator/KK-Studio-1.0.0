import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { AgentRunEventListDtoSchema } from '../../packages/shared/src/index.ts';
import { readSource } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);
const MIGRATION_PATH = 'infrastructure/database/migrations/023_agent_run_semantic_events.sql';
const OCCURRED_AT = '2026-07-23T01:02:03.000Z';

function createStepOutcomeEvent() {
  return {
    runId: 'run-semantic-1',
    sequence: 2,
    type: 'step_outcome',
    status: 'running',
    runUpdatedAt: OCCURRED_AT,
    createdAt: OCCURRED_AT,
    step: {
      stepId: 'step-1',
      toolName: 'canvas.arrangeNodes',
      outcome: 'success',
      verificationRule: 'canvas_state',
      retryable: false,
      verifiedAt: OCCURRED_AT,
    },
  };
}

test('Agent Run events use a strict metadata-only discriminated union', () => {
  const parsed = AgentRunEventListDtoSchema.parse([createStepOutcomeEvent()]);

  assert.equal(parsed[0]?.type, 'step_outcome');
  assert.throws(() => AgentRunEventListDtoSchema.parse([{
    ...createStepOutcomeEvent(),
    step: {
      ...createStepOutcomeEvent().step,
      message: 'must not replay tool output or free-form errors',
    },
  }]));
  assert.throws(() => AgentRunEventListDtoSchema.parse([{
    ...createStepOutcomeEvent(),
    payload: { toolInput: { nodeIds: ['secret-target'] } },
  }]));
});

test('migration 023 appends relational step outcomes without arbitrary payloads', () => {
  assert.equal(existsSync(MIGRATION_PATH), true);
  const migration = readSource(MIGRATION_PATH);

  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS step_id text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS tool_name text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS outcome text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS verification_rule text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS retryable boolean/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS verified_at timestamptz/);
  assert.match(migration, /event_type IN \('run_snapshot', 'step_outcome'\)/);
  assert.match(migration, /jsonb_array_elements/);
  assert.match(migration, /LIMIT 100/);
  assert.match(migration, /row_number\(\) OVER \(ORDER BY step_ordinal\)/);
  assert.match(migration, /'step_outcome'/);
  assert.doesNotMatch(migration, /\bpayload\b|\buser_message\b|\btool_input\b|\btool_output\b/i);
  assert.doesNotMatch(migration, /->>\s*'message'/);
  assert.match(migration, /COMMIT;\s*$/);
});

test('database entrypoints apply semantic events after Run Session binding', () => {
  const sources = [
    readSource('scripts/ops/vps/bootstrap-kk-vps.sh'),
    readSource('scripts/ops/setup/setup-database.bat'),
    readSource('scripts/ops/postgres/import-runtime-into-vps.sh'),
    readSource('scripts/ops/vps/deploy-kk-vps.sh'),
  ];

  for (const source of sources) {
    const bindingIndex = source.indexOf('022_agent_run_session_binding.sql');
    const semanticIndex = source.indexOf('023_agent_run_semantic_events.sql');
    assert.ok(bindingIndex >= 0, 'missing Run Session binding migration');
    assert.ok(semanticIndex > bindingIndex, 'semantic event migration must follow Run Session binding');
  }
  const bootstrap = readSource('scripts/ops/postgres/bootstrap-kk-vps.sql');
  assert.match(bootstrap, /event_type IN \('run_snapshot', 'step_outcome', 'replan'\)/);
  assert.match(bootstrap, /jsonb_array_elements/);
});

test('event store maps step outcomes through the owner-scoped bounded query', async () => {
  const eventStore = require('../../services/api/lib/agent-run-event-store.js');
  const row = {
    owned_run_id: 'run-semantic-1',
    run_id: 'run-semantic-1',
    sequence: 2,
    event_type: 'step_outcome',
    status: 'running',
    run_updated_at: new Date(OCCURRED_AT),
    created_at: new Date(OCCURRED_AT),
    step_id: 'step-1',
    tool_name: 'canvas.arrangeNodes',
    outcome: 'success',
    verification_rule: 'canvas_state',
    retryable: false,
    verified_at: new Date(OCCURRED_AT),
  };
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const events = await eventStore.listAgentRunEvents(
    'owner-semantic',
    'run-semantic-1',
    1,
    {
      client: {
        async query(sql: string, params: unknown[]) {
          calls.push({ sql, params });
          return { rows: [row] };
        },
      },
    },
  );

  assert.match(calls[0]?.sql || '', /event\.step_id/);
  assert.deepEqual(events, [createStepOutcomeEvent()]);
  assert.deepEqual(calls[0]?.params, ['run-semantic-1', 'owner-semantic', 1, 100]);
});
