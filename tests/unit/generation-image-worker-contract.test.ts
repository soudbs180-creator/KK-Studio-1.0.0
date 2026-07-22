import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readSource = (relativePath: string) => fs.readFileSync(relativePath, 'utf8');

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

test('durable worker remains server-gated and preserves the existing submit and control paths', () => {
  const route = readSource('services/api/routes/generation-v3.js');
  const flag = readSource('services/api/lib/generation-v3/worker/featureFlag.js');
  const server = readSource('services/api/index.js');
  assert.match(flag, /GENERATION_IMAGE_DURABLE_WORKER_ENABLED/);
  assert.match(route, /isImageDurableWorkerEnabled/);
  assert.match(route, /hasImageDurableWorkerRollout/);
  assert.match(route, /enqueueImageJob/);
  assert.match(route, /requestJobCancellation/);
  assert.match(route, /\/v1\/generation\/jobs\/:jobId\/submit/);
  assert.match(route, /\/v1\/generation\/jobs\/:jobId\/control/);
  assert.match(server, /startImageWorkerLoop/);
});
