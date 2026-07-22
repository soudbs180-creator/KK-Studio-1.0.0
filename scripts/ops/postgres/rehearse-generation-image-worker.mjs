import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import pg from 'pg';

const { Client } = pg;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const SENTINEL = Object.freeze({
  ownerId: 'kk-migration-rehearsal-owner',
  connectionId: '00000000-0000-4000-8000-000000000018',
  bindingId: '00000000-0000-4000-8000-000000000118',
  lineageId: '00000000-0000-4000-8000-000000000218',
  quoteId: '00000000-0000-4000-8000-000000000017',
  jobId: '00000000-0000-4000-8000-000000000117',
  itemId: '00000000-0000-4000-8000-000000000217',
  leaseId: '00000000-0000-4000-8000-000000000019',
});

export const REHEARSAL_ACKNOWLEDGEMENT = 'isolated-no-production-data';

function migrationNumber(filePath) {
  return Number(path.basename(filePath).match(/^(\d{3})_/)?.[1] || 0);
}

function assertCompleteSequence(migrationPaths) {
  const numbers = migrationPaths.map(migrationNumber);
  assert.equal(numbers.length, 19, 'Expected migrations 001 through 019');
  numbers.forEach((number, index) => {
    assert.equal(number, index + 1, `Missing or unordered migration ${String(index + 1).padStart(3, '0')}`);
  });
}

/** Builds the audited bootstrap, pre-019, and target migration execution plan. */
export function buildMigrationPlan(repoRoot = DEFAULT_REPO_ROOT) {
  const migrationsDir = path.join(repoRoot, 'infrastructure', 'database', 'migrations');
  const migrationPaths = fs.readdirSync(migrationsDir)
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .map((name) => path.join(migrationsDir, name))
    .filter((filePath) => migrationNumber(filePath) <= 19)
    .sort((left, right) => migrationNumber(left) - migrationNumber(right));
  assertCompleteSequence(migrationPaths);
  return {
    bootstrapPath: path.join(repoRoot, 'scripts', 'ops', 'postgres', 'bootstrap-kk-vps.sql'),
    preTargetMigrations: migrationPaths.slice(0, 18),
    targetMigrationPath: migrationPaths[18],
  };
}

/** Refuses execution unless the connected database is the explicitly acknowledged rehearsal target. */
export function assertRehearsalTarget({ actualDatabaseName, expectedDatabaseName, acknowledgement }) {
  if (acknowledgement !== REHEARSAL_ACKNOWLEDGEMENT) {
    throw new Error(`Invalid rehearsal acknowledgement; expected ${REHEARSAL_ACKNOWLEDGEMENT}`);
  }
  if (!expectedDatabaseName || !/rehearsal/i.test(expectedDatabaseName)) {
    throw new Error('Expected database name must identify a rehearsal database');
  }
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new Error('Connected database does not match KK_MIGRATION_REHEARSAL_DATABASE');
  }
}

/** Removes PostgreSQL credentials before an error is written to the terminal. */
export function redactSensitiveText(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/((?:password|token|secret)=)[^&\s]+/gi, '$1[REDACTED]');
}

function readSql(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

async function applySqlFile(client, filePath) {
  try {
    await client.query(readSql(filePath));
  } catch (error) {
    throw new Error(`Failed while applying ${path.basename(filePath)}: ${redactSensitiveText(error?.message || error)}`);
  }
}

async function inspectDatabase(client) {
  const identity = await client.query('select current_database() as database_name');
  return String(identity.rows[0]?.database_name || '');
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

async function seedCapabilityGraph(client) {
  await client.query(
    `insert into public.provider_connections
       (connection_id, user_id, provider_id, display_name, protocol_profile, secret_ref, status)
     values ($1, $2, 'rehearsal-provider', 'Migration Rehearsal', 'openai-compatible', 'rehearsal-secret-ref', 'available')`,
    [SENTINEL.connectionId, SENTINEL.ownerId],
  );
  await client.query(
    `insert into public.capability_bindings
       (binding_id, user_id, connection_id, model_id, capability_id, channel)
     values ($1, $2, $3, 'rehearsal-model', 'image.generate', 'byok')`,
    [SENTINEL.bindingId, SENTINEL.ownerId, SENTINEL.connectionId],
  );
  await client.query(
    `insert into public.asset_lineage_relations
       (lineage_id, user_id, source_asset_id, derived_asset_id, relation)
     values ($1, $2, 'asset-source-018', 'asset-derived-018', 'derived-from')`,
    [SENTINEL.lineageId, SENTINEL.ownerId],
  );
}

async function seedGenerationJob(client) {
  await client.query(
    `insert into public.generation_quotes
       (quote_id, user_id, media_type, model, channel, price_version, expires_at)
     values ($1, $2, 'image', 'rehearsal-model', 'setup-required', 'rehearsal-v1', now() + interval '1 hour')`,
    [SENTINEL.quoteId, SENTINEL.ownerId],
  );
  await client.query(
    `insert into public.generation_jobs
       (job_id, user_id, workspace_id, task_type, provider, status, quote_id, channel, model_code, idempotency_key)
     values ($1, $2, 'rehearsal-workspace', 'image', 'rehearsal-provider', 'submitted', $3, 'setup-required', 'rehearsal-model', 'migration-019-rehearsal')`,
    [SENTINEL.jobId, SENTINEL.ownerId, SENTINEL.quoteId],
  );
  await client.query(
    `insert into public.generation_job_items (item_id, job_id, sequence, status, payload_json)
     values ($1, $2, 0, 'pending', '{"prompt":"migration rehearsal"}'::jsonb)`,
    [SENTINEL.itemId, SENTINEL.jobId],
  );
}

async function seedPre019State(client) {
  await client.query(
    `insert into public.profiles (id, email, role, status)
     values ($1, 'migration-rehearsal@invalid.local', 'user', 'active')`,
    [SENTINEL.ownerId],
  );
  await client.query("select set_config('app.current_user_id', $1, false)", [SENTINEL.ownerId]);
  await seedCapabilityGraph(client);
  await seedGenerationJob(client);
}

async function snapshotCapabilityGraph(client) {
  const result = await client.query(
    `select jsonb_build_object(
       'connection', (select to_jsonb(row_value) from (select * from public.provider_connections where connection_id = $1) row_value),
       'binding', (select to_jsonb(row_value) from (select * from public.capability_bindings where binding_id = $2) row_value),
       'lineage', (select to_jsonb(row_value) from (select * from public.asset_lineage_relations where lineage_id = $3) row_value)
     ) as snapshot`,
    [SENTINEL.connectionId, SENTINEL.bindingId, SENTINEL.lineageId],
  );
  return result.rows[0]?.snapshot;
}

function assertSnapshotsEqual(before, after, stage) {
  assert.deepEqual(after, before, `Capability Graph sentinel changed after ${stage}`);
}

async function verifyWorkerSchema(client) {
  const columns = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'generation_image_worker_leases'`,
  );
  const names = new Set(columns.rows.map((row) => row.column_name));
  for (const required of ['item_id', 'job_id', 'status', 'lease_token', 'lease_expires_at', 'next_attempt_at']) {
    assert.equal(names.has(required), true, `Missing worker lease column ${required}`);
  }
  const indexes = await client.query(
    `select indexname from pg_indexes
     where schemaname = 'public' and tablename = 'generation_image_worker_leases'`,
  );
  const indexNames = new Set(indexes.rows.map((row) => row.indexname));
  assert.equal(indexNames.has('generation_image_worker_claim_idx'), true);
  assert.equal(indexNames.has('generation_image_worker_job_idx'), true);
}

async function seedWorkerLease(client) {
  await client.query(
    `insert into public.generation_image_worker_leases (lease_id, item_id, job_id, status)
     values ($1, $2, $3, 'queued')`,
    [SENTINEL.leaseId, SENTINEL.itemId, SENTINEL.jobId],
  );
}

async function assertWorkerLeasePreserved(client) {
  const result = await client.query(
    `select count(*)::integer as lease_count from public.generation_image_worker_leases
     where lease_id = $1 and item_id = $2 and job_id = $3 and status = 'queued'`,
    [SENTINEL.leaseId, SENTINEL.itemId, SENTINEL.jobId],
  );
  assert.equal(Number(result.rows[0]?.lease_count || 0), 1, '019 rerun changed the sentinel lease');
}

async function applyPreTargetPlan(client, plan) {
  await applySqlFile(client, plan.bootstrapPath);
  for (const migrationPath of plan.preTargetMigrations) {
    await applySqlFile(client, migrationPath);
  }
}

async function verifyTargetMigration(client, plan) {
  const before019 = await snapshotCapabilityGraph(client);
  await applySqlFile(client, plan.targetMigrationPath);
  await verifyWorkerSchema(client);
  await seedWorkerLease(client);
  assertSnapshotsEqual(before019, await snapshotCapabilityGraph(client), '019 first execution');
  await applySqlFile(client, plan.targetMigrationPath);
  await verifyWorkerSchema(client);
  await assertWorkerLeasePreserved(client);
  assertSnapshotsEqual(before019, await snapshotCapabilityGraph(client), '019 repeated execution');
}

function resolveConfiguration(environment) {
  const connectionString = String(environment.KK_MIGRATION_DATABASE_URL || '').trim();
  const expectedDatabaseName = String(environment.KK_MIGRATION_REHEARSAL_DATABASE || '').trim();
  const acknowledgement = String(environment.KK_MIGRATION_REHEARSAL_ACK || '').trim();
  if (!connectionString) throw new Error('KK_MIGRATION_DATABASE_URL is required');
  if (!expectedDatabaseName) throw new Error('KK_MIGRATION_REHEARSAL_DATABASE is required');
  return { connectionString, expectedDatabaseName, acknowledgement };
}

/** Runs the empty-to-018-to-019 rehearsal without dropping or cleaning any database objects. */
export async function runMigrationRehearsal(options = {}) {
  const config = resolveConfiguration(options.environment || process.env);
  const plan = buildMigrationPlan(options.repoRoot || DEFAULT_REPO_ROOT);
  const client = options.client || new Client({ connectionString: config.connectionString });
  await client.connect();
  try {
    const databaseName = await inspectDatabase(client);
    assertRehearsalTarget({ actualDatabaseName: databaseName, ...config });
    await assertDatabaseIsEmpty(client);
    await applyPreTargetPlan(client, plan);
    await seedPre019State(client);
    await verifyTargetMigration(client, plan);
    return {
      databaseName,
      migrationArtifactsApplied: 20,
      sqlFileExecutions: 21,
      targetExecutions: 2,
      capabilityGraphSentinels: 3,
    };
  } finally {
    await client.end();
  }
}

async function runCli() {
  try {
    const report = await runMigrationRehearsal();
    process.stdout.write(`${JSON.stringify({ ok: true, ...report }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`[migration-019-rehearsal] ${redactSensitiveText(error?.message || error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
