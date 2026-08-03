import assert from 'node:assert/strict';
import test from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('Agent coordination migration contains global arbitration and recovery state', () => {
  const migration = readSource('infrastructure/database/migrations/032_agent_coordination.sql');

  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_coordination_tasks/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_coordination_claims/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_coordination_waits/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_coordination_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_coordination_commands/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_coordination_snapshots/);
  assert.match(migration, /agent_coordination_snapshots_user_updated_idx/);
  assert.match(migration, /UNIQUE \(user_id, resource_key\)/);
  assert.match(migration, /cluster_id text NOT NULL/);
  assert.match(migration, /max_rounds integer NOT NULL CHECK \(max_rounds BETWEEN 1 AND 32\)/);
  assert.match(migration, /'lease_expired'/);
  assert.match(migration, /COMMIT;\s*$/);
});

test('Agent coordination API and runtime share the same fail-closed contract', () => {
  const route = readSource('services/api/routes/ai-assistant.js');
  const client = readSource('packages/shared/src/contracts/client/kk-api-client.ts');
  const gate = readSource('apps/web/src/features/ai-assistant-runtime/runtime/agentCoordinationGate.ts');
  const packageJson = readSource('package.json');

  assert.match(route, /coordinator and compensator roles are server-managed/);
  assert.match(route, /coordination\/metrics/);
  assert.match(client, /getAgentCoordinationMetrics/);
  assert.match(gate, /admitAgentPlan/);
  assert.match(gate, /heartbeatAgentCoordinationTask/);
  assert.match(gate, /clearInterval\(timer\)/);
  assert.match(packageJson, /check-agent-coordination-guard\.mjs/);
});

test('all production database entrypoints apply coordination migration 032', () => {
  const sources = [
    readSource('scripts/ops/vps/bootstrap-kk-vps.sh'),
    readSource('scripts/ops/vps/deploy-kk-vps.sh'),
    readSource('scripts/ops/postgres/import-runtime-into-vps.sh'),
    readSource('scripts/ops/setup/setup-database.bat'),
  ];
  for (const source of sources) {
    assert.match(source, /032_agent_coordination\.sql/);
    assert.match(source, /AGENT_COORDINATION/);
  }
  assert.match(sources[1], /agent_coordination_snapshots/);
});
