import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readSource = (relativePath: string) => fs.readFileSync(relativePath, 'utf8');

test('migration 017 accepts every v3 job lifecycle state before Worker leases are added', () => {
  const migration = readSource('infrastructure/database/migrations/017_quote_job_v3_and_ledger.sql');
  const statusConstraint = migration.match(/ADD CONSTRAINT generation_jobs_status_check CHECK \([\s\S]*?\);/)?.[0] || '';

  assert.match(migration, /DROP CONSTRAINT IF EXISTS generation_jobs_status_check/);
  for (const status of ['quoted', 'reserved', 'submitted', 'running', 'paused', 'completed', 'failed', 'cancelled']) {
    assert.match(statusConstraint, new RegExp(`'${status}'`), `migration 017 must accept ${status}`);
  }
});

test('migration 019 adds durable image leases without altering capability graph migration 018', () => {
  const migration = readSource('infrastructure/database/migrations/019_generation_image_worker.sql');
  assert.equal(fs.existsSync('infrastructure/database/migrations/018_capability_graph_foundation.sql'), true);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.generation_image_worker_leases/);
  assert.match(migration, /item_id uuid NOT NULL UNIQUE/);
  assert.match(migration, /lease_token uuid/);
  assert.match(migration, /lease_expires_at timestamptz/);
  assert.match(migration, /heartbeat_at timestamptz/);
  assert.match(migration, /failure_count integer NOT NULL DEFAULT 0/);
  assert.match(migration, /next_attempt_at timestamptz/);
  assert.match(migration, /cancel_requested_at timestamptz/);
  assert.match(migration, /generation_image_worker_claim_idx/);
  assert.match(migration, /^BEGIN;$/m);
  assert.match(migration, /COMMIT;\s*$/);
});

test('postgres worker store claims with skip-locked and guards writes by lease token', () => {
  const source = readSource('services/api/lib/generation-v3/worker/workerStore.js');
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /ON CONFLICT \(item_id\) DO NOTHING/);
  assert.match(source, /lease_token = \$2/);
  assert.match(source, /lease_expires_at <= NOW\(\)/);
  assert.match(source, /OR job\.status = 'cancelled'/);
  assert.match(source, /cancel_requested_at = NOW\(\)/);
});

test('Connection image admission is checked before sync Provider and durable lease side effects', () => {
  const lifecycle = readSource('services/api/lib/generation-v3/jobLifecycle.js');
  const submit = lifecycle.slice(lifecycle.indexOf('async function submitJob'));
  const workerStore = readSource('services/api/lib/generation-v3/worker/workerStore.js');
  const enqueue = workerStore.slice(workerStore.indexOf('async function enqueueImageJob'));

  const syncGate = submit.indexOf('assertImageProviderSliceAdmission(userId, quote.routeSnapshot)');
  const credentialResolution = submit.indexOf('resolveFrozenProviderRoute(userId, quote)');
  const enqueueGate = enqueue.indexOf('assertImageProviderSliceAdmission(userId, row.route_snapshot_json)');
  const leaseInsert = enqueue.indexOf('INSERT INTO public.generation_image_worker_leases');
  assert.ok(syncGate >= 0 && syncGate < credentialResolution);
  assert.ok(enqueueGate >= 0 && enqueueGate < leaseInsert);
});

test('capability graph rollout policy stays independent from generation runtime composition', () => {
  const featureFlag = readSource('services/api/lib/capability-graph/featureFlag.js');
  const admissionPath = 'services/api/lib/generation-v3/imageProviderSliceAdmission.js';

  assert.doesNotMatch(featureFlag, /generation-v3|generationMetrics/);
  assert.equal(fs.existsSync(admissionPath), true);
  const admission = readSource(admissionPath);
  assert.match(admission, /capability-graph\/featureFlag/);
  assert.match(admission, /generationMetrics/);
});

test('durable worker separates submission admission from execution and preserves existing paths', () => {
  const route = readSource('services/api/routes/generation-v3.js');
  const flag = readSource('services/api/lib/generation-v3/worker/featureFlag.js');
  const submissionRouter = readSource('services/api/lib/generation-v3/worker/workerSubmissionRouter.js');
  const server = readSource('services/api/index.js');
  assert.match(flag, /GENERATION_IMAGE_DURABLE_WORKER_ENABLED/);
  assert.match(flag, /GENERATION_IMAGE_WORKER_EXECUTION_ENABLED/);
  assert.match(route, /submitJobWithWorkerRollout/);
  assert.match(route, /isImageWorkerExecutionEnabled/);
  assert.doesNotMatch(route, /hasImageDurableWorkerRollout/);
  assert.match(submissionRouter, /isImageDurableWorkerEnabled/);
  assert.match(submissionRouter, /enqueueImageJob/);
  assert.match(submissionRouter, /submitJob/);
  assert.match(
    route,
    /if \(request\.action === 'cancel' && isImageWorkerExecutionEnabled\(\)\) \{\s*await generationV3\.requestJobCancellation/,
  );
  assert.match(route, /\/v1\/generation\/jobs\/:jobId\/submit/);
  assert.match(route, /\/v1\/generation\/jobs\/:jobId\/control/);
  assert.match(server, /startImageWorkerLoop/);
});

test('durable worker publishes aggregate metrics through the existing telemetry envelope', () => {
  const loop = readSource('services/api/lib/generation-v3/worker/workerLoop.js');
  const metrics = readSource('services/api/lib/generation-v3/worker/workerMetrics.js');
  const telemetry = readSource('services/api/routes/telemetry.js');

  assert.match(loop, /recordResult/);
  assert.match(loop, /recordLoopError/);
  assert.match(metrics, /averageLatencyMs/);
  assert.match(metrics, /lease_lost/);
  assert.doesNotMatch(metrics, /userId|jobId|itemId|prompt|providerTaskId/);
  assert.match(telemetry, /imageDurableWorker/);
  assert.match(telemetry, /getSnapshot/);
});

test('capability graph image rollout variables default closed without embedding identifiers', () => {
  const envTemplate = readSource('services/api/.env.local.example');
  assert.match(envTemplate, /^CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE=off$/m);
  assert.match(envTemplate, /^CAPABILITY_GRAPH_INTERNAL_USER_IDS=$/m);
  assert.match(envTemplate, /^CAPABILITY_GRAPH_INVITED_USER_IDS=$/m);
});

test('durable worker execution defaults closed and documents drain-safe rollback ordering', () => {
  const envTemplate = readSource('services/api/.env.local.example');

  assert.match(envTemplate, /^GENERATION_IMAGE_WORKER_EXECUTION_ENABLED=false$/m);
  assert.match(envTemplate, /After migration 019, enable execution before admission/i);
  assert.match(envTemplate, /During rollback, turn admission off but leave execution on until leases drain/i);
});
