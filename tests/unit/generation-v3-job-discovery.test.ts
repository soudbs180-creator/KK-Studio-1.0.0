import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  GenerationJobListDtoV3Schema,
  createKkApiClient,
  type GenerationJobDto,
} from '../../packages/shared/src/index.ts';
import { readSource } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);
const JOB_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_JOB_ID = '22222222-2222-4222-8222-222222222222';
const QUOTE_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_META = {
  requestId: 'request-job-discovery',
  timestamp: '2026-07-22T00:00:04.000Z',
};

function createJob(overrides: Partial<GenerationJobDto> = {}): GenerationJobDto {
  return {
    jobId: JOB_ID,
    quoteId: QUOTE_ID,
    channel: 'platform-credits',
    provider: 'fake-provider',
    model: 'fake-image-model',
    capabilityVersion: 'v1',
    status: 'running',
    items: [{
      itemId: '44444444-4444-4444-8444-444444444444',
      sequence: 0,
      status: 'running',
      reconciliation: 'pending',
    }],
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:01.000Z',
    ownerId: 'owner-a',
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

function createJobRow(overrides: Record<string, unknown> = {}) {
  return {
    job_id: JOB_ID,
    quote_id: QUOTE_ID,
    channel: 'platform-credits',
    provider: 'fake-provider',
    model_code: 'fake-image-model',
    capability_version: 'v1',
    anonymous_key_slot_id: null,
    status: 'running',
    schema_version: 3,
    user_id: 'owner-a',
    created_at: '2026-07-22T00:00:00.000Z',
    updated_at: new Date('2026-07-22T00:00:01.000Z'),
    ...overrides,
  };
}

function createItemRow(itemId: string, jobId: string, sequence: number) {
  return {
    item_id: itemId,
    job_id: jobId,
    sequence,
    status: 'running',
    provider_task_id: null,
    reconciliation_status: 'pending',
    asset_id: null,
    output_json: null,
    canvas_node_id: sequence === 0 ? 'canvas-node' : null,
    error_code: null,
    error_message: null,
    payload_json: sequence === 0
      ? { promptNodeId: 'payload-node', requestId: 'attempt-node:0', mediaType: 'image' }
      : {},
  };
}

test('Generation v3 list schema accepts valid Jobs and rejects malformed projections', () => {
  const parsed = GenerationJobListDtoV3Schema.parse({ jobs: [createJob()] });
  assert.equal(parsed.jobs[0]?.jobId, JOB_ID);
  assert.throws(() => GenerationJobListDtoV3Schema.parse({
    jobs: [{ ...createJob(), ownerId: '' }],
  }));
});

test('pending Job store parameterizes owner, filters v3 statuses, caps 50 and maps Items in two reads', async () => {
  const secondJob = createJobRow({
    job_id: SECOND_JOB_ID,
    updated_at: new Date('2026-07-23T00:00:02.000Z'),
    status: 'submitted',
  });
  const queryCalls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      queryCalls.push({ sql, params });
      if (queryCalls.length === 1) {
        return {
          rows: [
            createJobRow({ schema_version: 2, job_id: '55555555-5555-4555-8555-555555555555' }),
            createJobRow({ user_id: 'owner-b', job_id: '99999999-9999-4999-8999-999999999999' }),
            createJobRow({ status: 'completed', job_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
            createJobRow(),
            secondJob,
          ],
        };
      }
      return {
        rows: [
          createItemRow('77777777-7777-4777-8777-777777777777', JOB_ID, 1),
          createItemRow('66666666-6666-4666-8666-666666666666', JOB_ID, 0),
          createItemRow('88888888-8888-4888-8888-888888888888', SECOND_JOB_ID, 0),
        ],
      };
    },
  };
  const { listPendingJobs } = require('../../services/api/lib/generation-v3/jobStore.js');

  const jobs = await listPendingJobs('owner-a', { client });

  assert.equal(queryCalls.length, 2);
  assert.match(queryCalls[0]?.sql || '', /user_id\s*=\s*\$1/i);
  assert.match(queryCalls[0]?.sql || '', /schema_version\s*=\s*3/i);
  assert.match(queryCalls[0]?.sql || '', /status\s*=\s*ANY\(\$2::text\[\]\)/i);
  assert.match(queryCalls[0]?.sql || '', /ORDER BY updated_at DESC, job_id DESC/i);
  assert.match(queryCalls[0]?.sql || '', /LIMIT \$3/i);
  assert.deepEqual(queryCalls[0]?.params, [
    'owner-a',
    ['quoted', 'reserved', 'submitted', 'running', 'paused'],
    50,
  ]);
  assert.equal(queryCalls[1]?.params[0] instanceof Array, true);
  assert.deepEqual(jobs.map((job: GenerationJobDto) => job.jobId), [SECOND_JOB_ID, JOB_ID]);
  assert.deepEqual(jobs[1].items.map((item: { sequence: number }) => item.sequence), [0, 1]);
});

test('Generation v3 collection GET passes req.userId and preserves the success envelope', async () => {
  const generationV3 = require('../../services/api/lib/generation-v3/index.js');
  const originalListPendingJobs = generationV3.listPendingJobs;
  const router = require('../../services/api/routes/generation-v3.js');
  const routeLayer = router.stack.find(
    (layer: { route?: { path?: string; methods?: Record<string, boolean> } }) => (
      layer.route?.path === '/v1/generation/jobs' && layer.route.methods?.get
    ),
  );
  assert.ok(routeLayer);
  const handler = routeLayer.route.stack.at(-1).handle;
  const ownerLookups: string[] = [];
  let payload: unknown;
  const response = {
    json(value: unknown) {
      payload = value;
      return value;
    },
    status() {
      return response;
    },
  };
  generationV3.listPendingJobs = async (ownerId: string) => {
    ownerLookups.push(ownerId);
    return [createJob({ ownerId })];
  };

  try {
    await handler({ userId: 'owner-a' }, response);
  } finally {
    generationV3.listPendingJobs = originalListPendingJobs;
  }

  assert.deepEqual(ownerLookups, ['owner-a']);
  assert.equal((payload as { success?: boolean }).success, true);
  assert.equal((payload as { data?: { jobs?: GenerationJobDto[] } }).data?.jobs?.[0]?.ownerId, 'owner-a');
});

test('typed v3 client uses only the additive collection path and leaves the v2 list path unchanged', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const client = createKkApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), method: String(init?.method || 'GET') });
      return new Response(JSON.stringify({ success: true, data: { jobs: [] }, meta: REQUEST_META }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await client.listPendingGenerationV3Jobs();
  await client.listGenerationJobs();

  assert.deepEqual(requests, [
    { url: 'https://api.example.test/api/v1/generation/jobs', method: 'GET' },
    { url: 'https://api.example.test/api/v1/generation-jobs', method: 'GET' },
  ]);
});

test('Web discovery validates owner, filters observable Jobs and derives safe Prompt node IDs', async () => {
  const {
    discoverPendingGenerationJobs,
  } = await import('../../apps/web/src/services/generation/generationJobDiscovery.ts');
  const requestOptions: Array<{ expectedAuthSubject?: string; signal?: AbortSignal }> = [];
  const pausedJob = createJob({ jobId: SECOND_JOB_ID, status: 'paused' });
  const runningJob = createJob({
    items: [
      {
        ...createJob().items[0],
        canvasNodeId: '  canvas-node  ',
        payload: {
          promptNodeId: 'payload-node',
          requestId: 'attempt-node:0',
        },
      },
      {
        ...createJob().items[0],
        itemId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        sequence: 1,
        payload: { requestId: 'not-an-index' },
      },
    ],
  });
  const candidates = await discoverPendingGenerationJobs({
    client: {
      async listPendingGenerationV3Jobs(options) {
        requestOptions.push(options || {});
        return { success: true, data: { jobs: [pausedJob, runningJob] }, meta: REQUEST_META };
      },
    },
    getOwnerId: () => 'owner-a',
  });

  assert.equal(requestOptions[0]?.expectedAuthSubject, 'owner-a');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.taskId, JOB_ID);
  assert.deepEqual(candidates[0]?.promptNodeCandidateIds, [
    'canvas-node',
    'payload-node',
    'attempt-node',
  ]);
});

test('Web discovery fails closed on mismatched projections, owner changes and aborts', async () => {
  const {
    GenerationJobDiscoveryError,
    discoverPendingGenerationJobs,
  } = await import('../../apps/web/src/services/generation/generationJobDiscovery.ts');
  const mismatched = discoverPendingGenerationJobs({
    client: {
      async listPendingGenerationV3Jobs() {
        return { success: true, data: { jobs: [createJob({ ownerId: 'owner-b' })] }, meta: REQUEST_META };
      },
    },
    getOwnerId: () => 'owner-a',
  });
  await assert.rejects(mismatched, (error: unknown) => (
    error instanceof GenerationJobDiscoveryError && error.code === 'OWNER_MISMATCH'
  ));

  let ownerReadCount = 0;
  const ownerChanged = discoverPendingGenerationJobs({
    client: {
      async listPendingGenerationV3Jobs() {
        return { success: true, data: { jobs: [createJob()] }, meta: REQUEST_META };
      },
    },
    getOwnerId: () => (++ownerReadCount === 1 ? 'owner-a' : 'owner-b'),
  });
  await assert.rejects(ownerChanged, (error: unknown) => (
    error instanceof GenerationJobDiscoveryError && error.code === 'OWNER_CHANGED'
  ));

  const controller = new AbortController();
  const aborted = discoverPendingGenerationJobs({
    client: {
      async listPendingGenerationV3Jobs() {
        controller.abort();
        return { success: true, data: { jobs: [createJob()] }, meta: REQUEST_META };
      },
    },
    getOwnerId: () => 'owner-a',
    signal: controller.signal,
  });
  await assert.rejects(aborted, (error: unknown) => (
    error instanceof GenerationJobDiscoveryError && error.code === 'ABORTED'
  ));
});

test('recovery candidate merge de-duplicates by Job ID and preserves richer local metadata', async () => {
  const {
    findRecoveryPromptNode,
    mergeRecoveryCandidates,
  } = await import('../../apps/web/src/services/generation/generationJobDiscovery.ts');
  const localTask = {
    id: `task_${JOB_ID}`,
    taskId: JOB_ID,
    taskType: 'image' as const,
    status: 'pending' as const,
    prompt: 'local prompt',
    model: 'local-model',
    promptNodeId: 'local-node',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:03.000Z',
  };
  const serverTask = {
    ...localTask,
    id: `server_${JOB_ID}`,
    prompt: undefined,
    model: 'server-model',
    promptNodeId: 'server-node',
    promptNodeCandidateIds: ['server-node', 'attempt-node'],
    discoveredFromServer: true,
  };

  const merged = mergeRecoveryCandidates([localTask], [serverTask]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.prompt, 'local prompt');
  assert.equal(merged[0]?.model, 'local-model');
  assert.equal(merged[0]?.discoveredFromServer, true);
  assert.deepEqual(merged[0]?.promptNodeCandidateIds, ['local-node', 'server-node', 'attempt-node']);
  assert.deepEqual(findRecoveryPromptNode([
    { id: 'attempt-node' },
    { id: 'job-node', jobId: JOB_ID },
  ], merged[0]), { id: 'job-node', jobId: JOB_ID });

  const billingAttemptId = 'generation:initial:node_1720000000000_abcdef:1720000000001:nonce';
  const billingAttemptTask = {
    ...serverTask,
    promptNodeId: billingAttemptId,
    promptNodeCandidateIds: [billingAttemptId],
  };
  assert.deepEqual(findRecoveryPromptNode([
    { id: 'node_1720000000000_abcdef', billingAttemptId },
  ], billingAttemptTask), {
    id: 'node_1720000000000_abcdef',
    billingAttemptId,
  });
});

test('task recovery merges discovery before lookup and hydrates only an existing safe Prompt node', () => {
  const recoverySource = readSource('apps/web/src/hooks/useTaskRecovery.ts');
  const imageSource = readSource('apps/web/src/hooks/useImageGeneration.ts');

  assert.match(recoverySource, /await discoverPendingGenerationJobs\(/);
  assert.match(recoverySource, /mergeRecoveryCandidates\(/);
  assert.match(recoverySource, /findRecoveryPromptNode\(/);
  assert.match(recoverySource, /getRuntimeOwnerId\(\)\s*!==\s*recoveryOwnerId/);
  assert.match(recoverySource, /hydrateDiscoveredTask/);
  assert.match(recoverySource, /reason === 'online' && !task\.discoveredFromServer/);
  assert.match(recoverySource, /claimedPromptNodeIds\.has\(node\.id\)/);
  assert.match(recoverySource, /claimedPromptNodeIds\.add\(hydratedNode\.id\)/);
  assert.match(recoverySource, /if \(!hydratedNode\) continue;/);
  assert.match(recoverySource, /activeCanvasSnapshotRef\.current\?\.promptNodes/);
  assert.doesNotMatch(recoverySource, /\}, \[activeCanvas, hydrateDiscoveredTask, pollTaskFn\]\);/);

  const hydrationStart = imageSource.indexOf('const hydrateDiscoveredTask = useCallback');
  const recoveryCall = imageSource.indexOf('useTaskRecovery(', hydrationStart);
  assert.ok(hydrationStart >= 0 && recoveryCall > hydrationStart);
  const hydrationSource = imageSource.slice(hydrationStart, recoveryCall);
  assert.match(hydrationSource, /getRuntimeOwnerId\(\)\s*!==\s*expectedOwnerId/);
  assert.match(hydrationSource, /latestNode\.jobId\s*&&\s*latestNode\.jobId\s*!==\s*taskId/);
  assert.match(hydrationSource, /registerPendingTaskId\(latestNode, taskId\)/);
  assert.match(hydrationSource, /urgentUpdatePromptNode\(/);
  assert.doesNotMatch(hydrationSource, /addPromptNode|createPromptNode/);
});
