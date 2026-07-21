import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);

test('generation job APIs are user scoped and enforce an active client lease', () => {
  const source = readSource('services/api/routes/compat/workspace.js');

  assert.match(source, /router\.post\('\/api\/v1\/generation-jobs', requireUser/);
  assert.match(source, /router\.patch\('\/api\/v1\/generation-jobs\/:jobId', requireUser/);
  assert.match(source, /WHERE job_id::text = \$1 AND user_id = \$2[\s\S]{0,120}lease_owner = \$7 AND lease_expires_at >= NOW\(\)/);
  assert.match(source, /GENERATION_JOB_LEASE_CONFLICT/);
  assert.match(source, /job\.leaseOwner !== input\.leaseOwner/);
});

test('generation job migration adds idempotency, outputs, and lease indexes', () => {
  const migration = readSource('infrastructure/database/migrations/015_unified_media_generation_jobs.sql');

  assert.match(migration, /schema_version integer NOT NULL DEFAULT 2/);
  assert.match(migration, /outputs_json jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(migration, /generation_jobs_user_idempotency_idx/);
  assert.match(migration, /generation_jobs_lease_idx/);
});

test('OpenAPI publishes the unified media job and lease contracts', () => {
  const spec = readSource('docs/specs/openapi.yaml');

  assert.match(spec, /\/api\/v1\/generation-jobs:\n/);
  assert.match(spec, /\/api\/v1\/generation-jobs\/\{jobId\}\/claim:/);
  assert.match(spec, /UpdateGenerationBatchJobRequest:[\s\S]{0,100}required: \[leaseOwner\]/);
  assert.match(spec, /enum: \[image, video, audio\]/);
});

test('ComfyUI rejects unapproved templates and arbitrary workflow input', async () => {
  const adapter = require('../../services/api/lib/dispatcher/adapters/comfyUiWorkflowAdapter.js');

  assert.deepEqual(adapter.listApprovedTemplates(), []);
  await assert.rejects(
    adapter.generateVideo({ templateId: 'unapproved-template', workflow: {} }),
    /not approved|forbidden/i,
  );
});

test('the browser sync always identifies the lease owner when pushing updates', () => {
  const source = readSource('apps/web/src/features/ai-assistant-runtime/queue/GenerationQueueSync.ts');

  assert.match(source, /updateGenerationJob\(\s*remoteId,\s*\{[\s\S]{0,500}leaseOwner: getDeviceId\(\)/);
  assert.doesNotMatch(source, /leaseOwner: ACTIVE_STATUSES\.has\(job\.status\) \? getDeviceId\(\) : undefined/);
});

test('the browser sync reschedules the current owner after an in-flight owner switch', () => {
  const source = readSource('apps/web/src/features/ai-assistant-runtime/queue/GenerationQueueSync.ts');

  assert.match(source, /if \(syncInFlightOwnerId\) \{\s*syncRequestedWhileInFlight = true;\s*return;/);
  assert.match(source, /const currentOwnerId = ensureSyncOwner\(\);/);
  assert.match(source, /syncRequestedWhileInFlight \|\| currentOwnerId !== ownerId/);
  assert.match(source, /queueMicrotask\(\(\) => void syncJobsToServer\(durableGenerationQueue\.getJobs\(\)\)\)/);
});
