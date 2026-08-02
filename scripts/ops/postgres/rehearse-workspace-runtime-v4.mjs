import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import pg from 'pg';

import {
  REHEARSAL_ACKNOWLEDGEMENT,
  assertRehearsalTarget,
  redactSensitiveText,
} from './rehearse-generation-image-worker.mjs';

const { Client } = pg;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const FIRST_TARGET_MIGRATION = 29;
const LAST_TARGET_MIGRATION = 31;

const SENTINEL = Object.freeze({
  ownerA: 'kk-workspace-v4-rehearsal-owner-a',
  ownerB: 'kk-workspace-v4-rehearsal-owner-b',
  olderConnection: '00000000-0000-4000-8000-000000000291',
  newerConnection: '00000000-0000-4000-8000-000000000292',
  otherOwnerConnection: '00000000-0000-4000-8000-000000000293',
  revokedConnection: '00000000-0000-4000-8000-000000000294',
  runId: 'workspace-v4-rehearsal-run',
  skillId: 'workspace-v4-rehearsal-skill',
  runtimeId: '00000000-0000-4000-8000-000000000030',
  commandId: '00000000-0000-4000-8000-000000000130',
  extensionId: '00000000-0000-4000-8000-000000000031',
});

function migrationNumber(filePath) {
  return Number(path.basename(filePath).match(/^(\d{3})_/)?.[1] || 0);
}

function assertCompleteSequence(migrationPaths) {
  assert.equal(migrationPaths.length, LAST_TARGET_MIGRATION, 'Expected migrations 001 through 031');
  migrationPaths.forEach((filePath, index) => {
    assert.equal(migrationNumber(filePath), index + 1, `Missing migration ${String(index + 1).padStart(3, '0')}`);
  });
}

/** Builds the audited bootstrap, 001-028, and 029-031 execution plan. */
export function buildWorkspaceRuntimeMigrationPlan(repoRoot = DEFAULT_REPO_ROOT) {
  const migrationsDir = path.join(repoRoot, 'infrastructure', 'database', 'migrations');
  const migrationPaths = fs.readdirSync(migrationsDir)
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .map((name) => path.join(migrationsDir, name))
    .filter((filePath) => migrationNumber(filePath) <= LAST_TARGET_MIGRATION)
    .sort((left, right) => migrationNumber(left) - migrationNumber(right));
  assertCompleteSequence(migrationPaths);
  return {
    bootstrapPath: path.join(repoRoot, 'scripts', 'ops', 'postgres', 'bootstrap-kk-vps.sql'),
    preTargetMigrations: migrationPaths.slice(0, FIRST_TARGET_MIGRATION - 1),
    targetMigrations: migrationPaths.slice(FIRST_TARGET_MIGRATION - 1),
  };
}

function readSql(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

async function applySqlFile(client, filePath) {
  try {
    await client.query(readSql(filePath));
  } catch (error) {
    const message = redactSensitiveText(error?.message || error);
    throw new Error(`Failed while applying ${path.basename(filePath)}: ${message}`);
  }
}

async function inspectDatabase(client) {
  const result = await client.query('select current_database() as database_name');
  return String(result.rows[0]?.database_name || '');
}

async function assertDatabaseIsEmpty(client) {
  const result = await client.query(
    "select count(*)::integer as table_count from pg_tables where schemaname = 'public'",
  );
  const tableCount = Number(result.rows[0]?.table_count || 0);
  if (tableCount !== 0) {
    throw new Error(`Rehearsal database must start empty; found ${tableCount} public tables`);
  }
}

async function applyPreTargetPlan(client, plan) {
  await applySqlFile(client, plan.bootstrapPath);
  for (const migrationPath of plan.preTargetMigrations) {
    await applySqlFile(client, migrationPath);
  }
}

async function seedOwners(client) {
  await client.query(
    `insert into public.profiles (id, email, role, status)
     values ($1, 'workspace-v4-a@invalid.local', 'user', 'active'),
            ($2, 'workspace-v4-b@invalid.local', 'user', 'active')`,
    [SENTINEL.ownerA, SENTINEL.ownerB],
  );
  await client.query("select set_config('app.current_user_id', $1, false)", [SENTINEL.ownerA]);
}

async function seedProviderConnections(client) {
  const rows = [
    [SENTINEL.olderConnection, SENTINEL.ownerA, 'older', '2026-01-01T00:00:00.000Z', null],
    [SENTINEL.newerConnection, SENTINEL.ownerA, 'newer', '2026-02-01T00:00:00.000Z', null],
    [SENTINEL.otherOwnerConnection, SENTINEL.ownerB, 'other-owner', '2026-01-15T00:00:00.000Z', null],
    [SENTINEL.revokedConnection, SENTINEL.ownerA, 'revoked', '2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z'],
  ];
  for (const [connectionId, ownerId, providerId, updatedAt, revokedAt] of rows) {
    await client.query("select set_config('app.current_user_id', $1, false)", [ownerId]);
    await client.query(
      `insert into public.provider_connections
         (connection_id, user_id, provider_id, display_name, protocol_profile, secret_ref, status, updated_at, revoked_at)
       values ($1, $2, $3, $3, 'openai-compatible', 'rehearsal-secret-ref', 'available', $4, $5)`,
      [connectionId, ownerId, providerId, updatedAt, revokedAt],
    );
  }
  await client.query("select set_config('app.current_user_id', $1, false)", [SENTINEL.ownerA]);
}

async function seedAgentState(client) {
  await client.query(
    `insert into public.agent_runs (id, user_id, user_message, intent, plan, status)
     values ($1, $2, 'rehearsal', 'inspect', '{"steps":[]}'::jsonb, 'planning')`,
    [SENTINEL.runId, SENTINEL.ownerA],
  );
  await client.query(
    `insert into public.agent_skills
       (id, user_id, owner_scope, name, trigger_text, tools, steps, safety)
     values ($1, $2, 'user', 'rehearsal-skill', 'rehearse', ARRAY['canvas.getState'], ARRAY['inspect'], ARRAY['read-only'])`,
    [SENTINEL.skillId, SENTINEL.ownerA],
  );
}

async function seedPreTargetState(client) {
  await seedOwners(client);
  await seedProviderConnections(client);
  await seedAgentState(client);
}

async function applyTargetMigrations(client, plan) {
  for (const migrationPath of plan.targetMigrations) {
    await applySqlFile(client, migrationPath);
  }
}

async function verifyRoutingPriority(client) {
  await client.query("select set_config('app.current_user_id', $1, false)", [SENTINEL.ownerA]);
  const ownerAPriorities = await client.query(
    `select connection_id::text, routing_priority from public.provider_connections
     where connection_id = any($1::uuid[]) order by connection_id`,
    [[SENTINEL.olderConnection, SENTINEL.newerConnection]],
  );
  const byId = new Map(ownerAPriorities.rows.map((row) => [row.connection_id, Number(row.routing_priority)]));
  assert.equal(byId.get(SENTINEL.newerConnection), 0, 'Newest owner connection must route first');
  assert.equal(byId.get(SENTINEL.olderConnection), 1, 'Older owner connection must route second');
  const ownerARevision = await client.query(
    'select revision from public.provider_connection_order_revisions where user_id = $1',
    [SENTINEL.ownerA],
  );
  assert.equal(Number(ownerARevision.rows[0]?.revision), 0, 'Owner A revision must be initialized');
  await client.query("select set_config('app.current_user_id', $1, false)", [SENTINEL.ownerB]);
  const ownerBPriority = await client.query(
    'select routing_priority from public.provider_connections where connection_id = $1',
    [SENTINEL.otherOwnerConnection],
  );
  assert.equal(Number(ownerBPriority.rows[0]?.routing_priority), 0, 'Priority must restart for each owner');
  const ownerBRevision = await client.query(
    'select revision from public.provider_connection_order_revisions where user_id = $1',
    [SENTINEL.ownerB],
  );
  assert.equal(Number(ownerBRevision.rows[0]?.revision), 0, 'Owner B revision must be initialized');
  await client.query("select set_config('app.current_user_id', $1, false)", [SENTINEL.ownerA]);
}

async function verifyRequiredSchema(client) {
  const result = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name = any($1::text[])`,
    [['provider_connection_order_revisions', 'paired_runtimes', 'paired_runtime_commands', 'agent_extensions']],
  );
  const tables = new Set(result.rows.map((row) => row.table_name));
  for (const table of ['provider_connection_order_revisions', 'paired_runtimes', 'paired_runtime_commands', 'agent_extensions']) {
    assert.equal(tables.has(table), true, `Missing target table ${table}`);
  }
}

async function verifyPolicies(client) {
  const result = await client.query(
    `select tablename, policyname from pg_policies
     where schemaname = 'public' and tablename = any($1::text[])`,
    [['provider_connection_order_revisions', 'paired_runtimes', 'paired_runtime_commands', 'agent_extensions']],
  );
  const policies = new Set(result.rows.map((row) => `${row.tablename}:${row.policyname}`));
  for (const policy of [
    'provider_connection_order_revisions:provider_connection_order_revisions_user_policy',
    'paired_runtimes:paired_runtimes_owner_policy',
    'paired_runtime_commands:paired_runtime_commands_owner_policy',
    'agent_extensions:agent_extensions_owner_policy',
  ]) {
    assert.equal(policies.has(policy), true, `Missing owner policy ${policy}`);
  }
}

async function verifyLegacyProjection(client) {
  const run = await client.query(
    'select execution_target, paired_runtime_id from public.agent_runs where id = $1',
    [SENTINEL.runId],
  );
  assert.equal(run.rows[0]?.execution_target, 'local-desktop');
  assert.equal(run.rows[0]?.paired_runtime_id, null);
  const extension = await client.query(
    `select extension_type, import_source from public.agent_extensions
     where user_id = $1 and manifest_key = 'rehearsal-skill'`,
    [SENTINEL.ownerA],
  );
  assert.deepEqual(extension.rows[0], { extension_type: 'skill', import_source: 'local-import' });
}

async function seedPostTargetState(client) {
  await client.query(
    `insert into public.paired_runtimes
       (id, user_id, display_name, credential_hash, credential_expires_at, status)
     values ($1, $2, 'Rehearsal Desktop', $3, now() + interval '1 day', 'online')`,
    [SENTINEL.runtimeId, SENTINEL.ownerA, 'a'.repeat(64)],
  );
  await client.query(
    `update public.agent_runs set execution_target = 'paired-desktop', paired_runtime_id = $1 where id = $2`,
    [SENTINEL.runtimeId, SENTINEL.runId],
  );
  const envelope = { schemaVersion: 1, kind: 'agent_run', runId: SENTINEL.runId, commands: [{ kind: 'inspect', siteAdapter: 'rehearsal' }] };
  await client.query(
    `insert into public.paired_runtime_commands
       (id, user_id, runtime_id, run_id, idempotency_key, command_envelope)
     values ($1, $2, $3, $4, 'workspace-v4-rehearsal', $5::jsonb)`,
    [SENTINEL.commandId, SENTINEL.ownerA, SENTINEL.runtimeId, SENTINEL.runId, JSON.stringify(envelope)],
  );
  await client.query(
    `insert into public.agent_extensions
       (id, user_id, extension_type, manifest_key, display_name, manifest, permissions, secret_ref)
     values ($1, $2, 'mcp', 'rehearsal-mcp', 'Rehearsal MCP', '{"schemaVersion":1}'::jsonb, '["read:canvas"]'::jsonb, 'encrypted:rehearsal')`,
    [SENTINEL.extensionId, SENTINEL.ownerA],
  );
}

async function snapshotTargetState(client) {
  const result = await client.query(
    `select jsonb_build_object(
       'connections', (select jsonb_agg(to_jsonb(row_value) order by connection_id) from
         (select connection_id, routing_priority from public.provider_connections where user_id = $1) row_value),
       'revisions', (select jsonb_agg(to_jsonb(row_value) order by user_id) from
         (select user_id, revision from public.provider_connection_order_revisions) row_value),
       'runtime', (select to_jsonb(row_value) from
         (select id, user_id, display_name, status from public.paired_runtimes where id = $2) row_value),
       'command', (select to_jsonb(row_value) from
         (select id, runtime_id, run_id, status, attempt_count from public.paired_runtime_commands where id = $3) row_value),
       'run', (select to_jsonb(row_value) from
         (select id, execution_target, paired_runtime_id from public.agent_runs where id = $4) row_value),
       'extensions', (select jsonb_agg(to_jsonb(row_value) order by manifest_key) from
         (select extension_type, manifest_key, import_source, secret_ref from public.agent_extensions where user_id = $1) row_value)
     ) as snapshot`,
    [SENTINEL.ownerA, SENTINEL.runtimeId, SENTINEL.commandId, SENTINEL.runId],
  );
  return result.rows[0]?.snapshot;
}

function resolveConfiguration(environment) {
  const connectionString = String(environment.KK_MIGRATION_DATABASE_URL || '').trim();
  const expectedDatabaseName = String(environment.KK_MIGRATION_REHEARSAL_DATABASE || '').trim();
  const acknowledgement = String(environment.KK_MIGRATION_REHEARSAL_ACK || '').trim();
  if (!connectionString) throw new Error('KK_MIGRATION_DATABASE_URL is required');
  if (!expectedDatabaseName) throw new Error('KK_MIGRATION_REHEARSAL_DATABASE is required');
  return { connectionString, expectedDatabaseName, acknowledgement };
}

/** Rehearses 001-031 from empty state and repeats 029-031 with populated sentinels. */
export async function runWorkspaceRuntimeMigrationRehearsal(options = {}) {
  const config = resolveConfiguration(options.environment || process.env);
  const plan = buildWorkspaceRuntimeMigrationPlan(options.repoRoot || DEFAULT_REPO_ROOT);
  const client = options.client || new Client({ connectionString: config.connectionString });
  await client.connect();
  try {
    const databaseName = await inspectDatabase(client);
    assertRehearsalTarget({ actualDatabaseName: databaseName, ...config });
    await assertDatabaseIsEmpty(client);
    await applyPreTargetPlan(client, plan);
    await seedPreTargetState(client);
    await applyTargetMigrations(client, plan);
    await verifyRoutingPriority(client);
    await verifyRequiredSchema(client);
    await verifyPolicies(client);
    await verifyLegacyProjection(client);
    await seedPostTargetState(client);
    const beforeRepeat = await snapshotTargetState(client);
    await applyTargetMigrations(client, plan);
    assert.deepEqual(await snapshotTargetState(client), beforeRepeat, '029-031 repeat changed sentinel state');
    return { databaseName, migrationArtifactsApplied: 32, sqlFileExecutions: 35, targetExecutions: 6 };
  } finally {
    await client.end();
  }
}

async function runCli() {
  try {
    const report = await runWorkspaceRuntimeMigrationRehearsal();
    process.stdout.write(`${JSON.stringify({ ok: true, ...report }, null, 2)}\n`);
  } catch (error) {
    const message = redactSensitiveText(error?.message || error);
    process.stderr.write(`[migration-029-031-rehearsal] ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

export { REHEARSAL_ACKNOWLEDGEMENT, assertRehearsalTarget, redactSensitiveText };
