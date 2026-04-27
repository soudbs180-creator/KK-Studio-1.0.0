import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type Canvas,
  type PromptNode,
} from '../../src/types.ts';
import {
  cancelEcommerceFrameworkNodeQueue,
  createEcommerceFrameworkRuntimeState,
  enqueueEcommerceFrameworkItems,
  migrateLegacyEcommerceFrameworkCanvas,
  pauseEcommerceFrameworkRuntime,
  resolveEcommerceFrameworkDispatchPlan,
  resumeEcommerceFrameworkRuntime,
} from '../../src/services/ecommerce/frameworkRuntime.ts';

function createEcommerceNode(
  id: string,
  overrides: Partial<PromptNode> = {},
): PromptNode {
  return {
    id,
    prompt: id,
    originalPrompt: id,
    position: { x: 100, y: 100 },
    aspectRatio: AspectRatio.SQUARE,
    imageSize: ImageSize.SIZE_1K,
    model: 'gemini-3.1-flash-image-preview',
    childImageIds: [],
    timestamp: 1,
    mode: GenerationMode.ECOMMERCE,
    referenceImages: [],
    ecommerce: {
      kind: 'main-image',
      sourceSheet: '主图',
      sourceRowKey: id,
      stage: 'analysis_ready',
      desktopStage: 'not_applicable',
      mobileStage: 'not_applicable',
    },
    ...overrides,
  } as PromptNode;
}

test('legacy ecommerce canvases auto-wrap into one framework card exactly once', () => {
  const legacyCanvas: Canvas = {
    id: 'canvas-1',
    name: 'Legacy',
    promptNodes: [
      createEcommerceNode('main-group', {
        ecommerce: {
          kind: 'a-plus-group',
          sourceSheet: '主图',
          sourceRowKey: 'main-group',
          stage: 'analysis_ready',
          desktopStage: 'pending',
          mobileStage: 'locked',
        },
      }),
      createEcommerceNode('aplus-group', {
        position: { x: 1040, y: 100 },
        ecommerce: {
          kind: 'a-plus-group',
          sourceSheet: 'A+',
          sourceRowKey: 'aplus-group',
          stage: 'analysis_ready',
          desktopStage: 'pending',
          mobileStage: 'locked',
        },
      }),
      createEcommerceNode('main-task', {
        position: { x: 100, y: 320 },
        ecommerce: {
          kind: 'main-image',
          sourceSheet: '主图',
          sourceRowKey: 'main-task',
          groupId: 'main-group',
          stage: 'ready',
          desktopStage: 'not_applicable',
          mobileStage: 'not_applicable',
        },
      }),
      createEcommerceNode('aplus-task', {
        position: { x: 1040, y: 320 },
        ecommerce: {
          kind: 'a-plus-module',
          sourceSheet: 'A+',
          sourceRowKey: 'aplus-task',
          groupId: 'aplus-group',
          stage: 'ready',
          desktopStage: 'pending',
          mobileStage: 'locked',
        },
      }),
    ],
    imageNodes: [],
    groups: [],
    drawings: [],
    lastModified: 1,
  };

  const migrated = migrateLegacyEcommerceFrameworkCanvas(legacyCanvas);
  const frameworkNodes = migrated.promptNodes.filter((node) => node.ecommerce?.kind === 'framework');

  assert.equal(frameworkNodes.length, 1);
  assert.equal(frameworkNodes[0].ecommerce?.frameworkMeta?.activeSheet, '主图');
  assert.equal(
    migrated.promptNodes.find((node) => node.id === 'main-group')?.ecommerce?.frameworkId,
    frameworkNodes[0].id,
  );
  assert.equal(
    migrated.promptNodes.find((node) => node.id === 'main-task')?.ecommerce?.parentNodeId,
    'main-group',
  );

  const remigrated = migrateLegacyEcommerceFrameworkCanvas(migrated);
  assert.equal(
    remigrated.promptNodes.filter((node) => node.ecommerce?.kind === 'framework').length,
    1,
  );
});

test('framework dispatch caps remote lanes and allows local lanes to fill configured capacity', () => {
  const runtime = enqueueEcommerceFrameworkItems(
    createEcommerceFrameworkRuntimeState({
      frameworkId: 'fw-1',
      activeSheet: '主图',
      config: {
        maxLocalConcurrency: 4,
        maxRemoteConcurrency: 2,
      },
    }),
    [
      {
        queueId: 'queue-1',
        nodeId: 'local-1',
        phase: 'sheet',
        laneKey: 'local:gateway',
        laneType: 'local',
        sourceSheet: '主图',
      },
      {
        queueId: 'queue-2',
        nodeId: 'local-2',
        phase: 'sheet',
        laneKey: 'local:gateway',
        laneType: 'local',
        sourceSheet: '主图',
      },
      {
        queueId: 'queue-3',
        nodeId: 'local-3',
        phase: 'sheet',
        laneKey: 'local:gateway',
        laneType: 'local',
        sourceSheet: '主图',
      },
      {
        queueId: 'queue-4',
        nodeId: 'remote-1',
        phase: 'sheet',
        laneKey: 'remote:google',
        laneType: 'remote',
        sourceSheet: '主图',
      },
      {
        queueId: 'queue-5',
        nodeId: 'remote-2',
        phase: 'sheet',
        laneKey: 'remote:12ai',
        laneType: 'remote',
        sourceSheet: '主图',
      },
      {
        queueId: 'queue-6',
        nodeId: 'remote-3',
        phase: 'sheet',
        laneKey: 'remote:12ai',
        laneType: 'remote',
        sourceSheet: '主图',
      },
    ],
  );

  const starters = resolveEcommerceFrameworkDispatchPlan(runtime).map((item) => item.nodeId);

  assert.deepEqual(starters, ['local-1', 'local-2', 'local-3', 'remote-1', 'remote-2']);
});

test('framework dispatch fairly spreads remote capacity across provider lanes', () => {
  const runtime = enqueueEcommerceFrameworkItems(
    createEcommerceFrameworkRuntimeState({
      frameworkId: 'fw-provider-fairness',
      activeSheet: '涓诲浘',
      config: {
        maxLocalConcurrency: 4,
        maxRemoteConcurrency: 2,
      },
    }),
    [
      {
        queueId: 'queue-google-1',
        nodeId: 'google-1',
        phase: 'sheet',
        laneKey: 'remote:google',
        laneType: 'remote',
        sourceSheet: '涓诲浘',
      },
      {
        queueId: 'queue-google-2',
        nodeId: 'google-2',
        phase: 'sheet',
        laneKey: 'remote:google',
        laneType: 'remote',
        sourceSheet: '涓诲浘',
      },
      {
        queueId: 'queue-12ai-1',
        nodeId: '12ai-1',
        phase: 'sheet',
        laneKey: 'remote:12ai',
        laneType: 'remote',
        sourceSheet: '涓诲浘',
      },
    ],
  );

  const starters = resolveEcommerceFrameworkDispatchPlan(runtime).map((item) => item.nodeId);

  assert.deepEqual(starters, ['google-1', '12ai-1']);
});

test('framework pause stops dequeues but does not rewrite running work', () => {
  const runtime = pauseEcommerceFrameworkRuntime({
    frameworkId: 'fw-2',
    activeSheet: 'A+',
    paused: false,
    config: {
      maxLocalConcurrency: 3,
      maxRemoteConcurrency: 2,
    },
    queue: [
      {
        queueId: 'running-1',
        frameworkId: 'fw-2',
        nodeId: 'node-running',
        phase: 'desktop',
        laneKey: 'remote:google',
        laneType: 'remote',
        sourceSheet: 'A+',
        status: 'running',
        enqueuedAt: 1,
      },
      {
        queueId: 'queued-1',
        frameworkId: 'fw-2',
        nodeId: 'node-queued',
        phase: 'desktop',
        laneKey: 'remote:google',
        laneType: 'remote',
        sourceSheet: 'A+',
        status: 'queued',
        enqueuedAt: 2,
      },
    ],
    lastUpdatedAt: 1,
  });

  assert.equal(runtime.paused, true);
  assert.equal(runtime.queue[0].status, 'running');
  assert.equal(runtime.queue[1].status, 'paused');

  const resumed = resumeEcommerceFrameworkRuntime(runtime);
  assert.equal(resumed.paused, false);
  assert.equal(resumed.queue[1].status, 'queued');
});

test('single-card cancel removes queued follow-up work only', () => {
  const runtime = cancelEcommerceFrameworkNodeQueue({
    frameworkId: 'fw-3',
    activeSheet: 'A+',
    paused: false,
    config: {
      maxLocalConcurrency: 3,
      maxRemoteConcurrency: 2,
    },
    queue: [
      {
        queueId: 'running-task',
        frameworkId: 'fw-3',
        nodeId: 'task-1',
        phase: 'desktop',
        laneKey: 'remote:google',
        laneType: 'remote',
        sourceSheet: 'A+',
        status: 'running',
        enqueuedAt: 1,
      },
      {
        queueId: 'queued-follow-up',
        frameworkId: 'fw-3',
        nodeId: 'task-1',
        phase: 'mobile',
        laneKey: 'remote:google',
        laneType: 'remote',
        sourceSheet: 'A+',
        status: 'queued',
        enqueuedAt: 2,
      },
      {
        queueId: 'queued-other',
        frameworkId: 'fw-3',
        nodeId: 'task-2',
        phase: 'desktop',
        laneKey: 'local:gateway',
        laneType: 'local',
        sourceSheet: 'A+',
        status: 'queued',
        enqueuedAt: 3,
      },
    ],
    lastUpdatedAt: 1,
  }, 'task-1');

  assert.deepEqual(
    runtime.queue.map((item) => `${item.nodeId}:${item.phase}:${item.status}`),
    ['task-1:desktop:running', 'task-2:desktop:queued'],
  );
});
