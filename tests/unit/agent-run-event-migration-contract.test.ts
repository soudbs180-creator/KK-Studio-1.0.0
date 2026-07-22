import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { readSource } from '../support/workspacePaths.js';

const MIGRATION_PATH = 'infrastructure/database/migrations/020_agent_run_events.sql';

function assertBefore(source: string, before: string, after: string, label: string) {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);
  assert.ok(beforeIndex >= 0, `${label}: missing ${before}`);
  assert.ok(afterIndex >= 0, `${label}: missing ${after}`);
  assert.ok(beforeIndex < afterIndex, `${label}: expected ordered migration application`);
}

test('migration 020 adds private metadata-only Agent Run events and transactional triggers', () => {
  assert.equal(existsSync(MIGRATION_PATH), true);
  const migration = readSource(MIGRATION_PATH);

  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /SET LOCAL lock_timeout = '10s'/);
  assert.match(migration, /ALTER TABLE public\.agent_runs[\s\S]*event_sequence integer/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_run_events/);
  assert.match(migration, /PRIMARY KEY \(run_id, sequence\)/);
  assert.doesNotMatch(migration, /\buser_id\b/);
  assert.match(migration, /prepare_agent_run_event_sequence/);
  assert.match(migration, /append_agent_run_snapshot_event/);
  assert.match(migration, /AFTER INSERT OR UPDATE/);
  assert.match(migration, /INSERT INTO public\.agent_run_events/);
  assert.match(migration, /WHERE event_sequence = 0/);
  assert.doesNotMatch(migration, /\buser_message\b|\bevent_data\b|\bpayload\b/i);
  assert.match(migration, /COMMIT;\s*$/);
});

test('fresh bootstrap and every database entrypoint apply migration 020 after owner scoping', () => {
  const bootstrap = readSource('scripts/ops/postgres/bootstrap-kk-vps.sql');
  const linuxBootstrap = readSource('scripts/ops/vps/bootstrap-kk-vps.sh');
  const windowsSetup = readSource('scripts/ops/setup/setup-database.bat');
  const runtimeImport = readSource('scripts/ops/postgres/import-runtime-into-vps.sh');
  const deploy = readSource('scripts/ops/vps/deploy-kk-vps.sh');

  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS public\.agent_run_events/);
  assert.match(bootstrap, /CREATE TRIGGER append_agent_run_snapshot_event/);
  assert.match(linuxBootstrap, /SCRIPT_DIR\}\/\.\.\/\.\.\/\.\./);
  assert.match(linuxBootstrap, /scripts\/ops\/postgres\/bootstrap-kk-vps\.sql/);
  assert.match(linuxBootstrap, /infrastructure\/database\/migrations\/020_agent_run_events\.sql/);
  assert.match(windowsSetup, /scripts\\ops\\postgres\\bootstrap-kk-vps\.sql/);
  assert.match(runtimeImport, /SCRIPT_DIR\}\/\.\.\/\.\.\/\.\./);
  assert.match(deploy, /infrastructure\/database\/migrations\/020_agent_run_events\.sql/);
  assertBefore(linuxBootstrap, 'AI_ASSISTANT_SCOPE_MIGRATION', 'AGENT_RUN_EVENT_MIGRATION', 'Linux bootstrap variables');
  assertBefore(linuxBootstrap, '-f "${AI_ASSISTANT_SCOPE_MIGRATION}"', '-f "${AGENT_RUN_EVENT_MIGRATION}"', 'Linux bootstrap');
  assertBefore(windowsSetup, '-f "%AI_SCOPE_MIGRATION%"', '-f "%AGENT_RUN_EVENT_MIGRATION%"', 'Windows setup');
  assertBefore(runtimeImport, '-f "${AI_ASSISTANT_SCOPE_MIGRATION}"', '-f "${AGENT_RUN_EVENT_MIGRATION}"', 'runtime import');
  assertBefore(deploy, 'AI_ASSISTANT_SCOPE_MIGRATION_PATH', 'AGENT_RUN_EVENT_MIGRATION_PATH', 'deploy variables');
  assertBefore(deploy, '-f "${NEW_RELEASE_DIR}/${AI_ASSISTANT_SCOPE_MIGRATION_PATH}"', '-f "${NEW_RELEASE_DIR}/${AGENT_RUN_EVENT_MIGRATION_PATH}"', 'deploy');
  assert.match(deploy, /\('agent_run_events'\)/);
  assert.match(deploy, /'run_updated_at', 'timestamp with time zone'/);
  assert.match(deploy, /prepare_agent_run_event_sequence/);
  assert.match(deploy, /agent_run_events schema is missing or invalid/);
});
