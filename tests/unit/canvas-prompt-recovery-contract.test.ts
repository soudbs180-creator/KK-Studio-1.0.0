import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import * as ts from 'typescript';

type PromptRecoveryModule = typeof import('../../apps/web/src/context/canvasPromptRecovery.ts');
type RequiredPromptRecoveryExports = Pick<
  PromptRecoveryModule,
  'normalizeCanvasPromptRecovery' | 'markInterruptedSyncPromptGenerations' | 'hasUnrecoverableSyncGenerationInFlight'
>;

const typedPromptRecoveryExport: keyof RequiredPromptRecoveryExports = 'normalizeCanvasPromptRecovery';
const ROOT_DIR = process.cwd();



function resolvePromptChildImageIdsForTest(
  node?: { id?: string; childImageIds?: string[]; sourceImageId?: string } | null,
  imageNodes: Array<{ id: string; parentPromptId?: string | null }> = [],
): string[] {
  if (!node?.id) return [];

  const orderedIds = (node.childImageIds || []).filter((id) => typeof id === 'string' && id.trim().length > 0);
  const imageNodeById = new Map(imageNodes.map((imageNode) => [imageNode.id, imageNode] as const));
  const strongOwnedImages = imageNodes.filter((imageNode) => (
    imageNode.parentPromptId === node.id && imageNode.id !== node.sourceImageId
  ));

  if (strongOwnedImages.length === 0) {
    return orderedIds.filter((imageId) => {
      const imageNode = imageNodeById.get(imageId);
      return !!imageNode && !imageNode.parentPromptId && imageNode.id !== node.sourceImageId;
    });
  }

  const resolvedIds: string[] = [];
  const seenIds = new Set<string>();
  orderedIds.forEach((imageId) => {
    const imageNode = imageNodeById.get(imageId);
    if (!imageNode || imageNode.parentPromptId !== node.id || seenIds.has(imageNode.id)) return;
    seenIds.add(imageNode.id);
    resolvedIds.push(imageNode.id);
  });
  strongOwnedImages.forEach((imageNode) => {
    if (seenIds.has(imageNode.id)) return;
    seenIds.add(imageNode.id);
    resolvedIds.push(imageNode.id);
  });

  return resolvedIds;
}

function loadPromptRecoveryModuleForBehaviorTest(): RequiredPromptRecoveryExports {
  const source = readSource('src/context/canvasPromptRecovery.ts');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleObject = { exports: {} as Record<string, unknown> };
  const dependencyStubs = new Map<string, unknown>([
    [
      '../utils/imageResultPersistence',
      {
        getPromptCompletedTasks: (node?: { generationMetadata?: { completedTasks?: unknown } } | null) => {
          const completedTasks = node?.generationMetadata?.completedTasks;
          return Array.isArray(completedTasks)
            ? completedTasks.filter((task) => !!task && typeof task === 'object' && typeof (task as { taskId?: unknown }).taskId === 'string')
            : [];
        },
      },
    ],
    [
      '../utils/referenceImageStorage',
      {
        normalizeReferenceImagesStorage: (referenceImages?: unknown) => (
          Array.isArray(referenceImages) ? referenceImages : []
        ),
      },
    ],
    ['../workflow/adapters/workflowToLegacy', { workflowToLegacyCanvas: <T>(canvas: T): T => canvas }],
    ['./canvasCompatibility', { syncCanvasCompatibility: <T>(canvas: T): T => canvas }],
    ['./canvasPromptChildImages', { resolvePromptChildImageIds: resolvePromptChildImageIdsForTest }],
  ]);
  const requireStub = (specifier: string): unknown => {
    if (dependencyStubs.has(specifier)) {
      return dependencyStubs.get(specifier);
    }
    throw new Error(`Unexpected canvasPromptRecovery test dependency: ${specifier}`);
  };
  const compiledModule = new Function('require', 'exports', 'module', transpiled);
  compiledModule(requireStub, moduleObject.exports, moduleObject);
  return moduleObject.exports as RequiredPromptRecoveryExports;
}

test('prompt recovery boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasPromptRecovery.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.equal(typedPromptRecoveryExport, 'normalizeCanvasPromptRecovery');
  assert.match(testConfigSource, /tests\/unit\/canvas-prompt-recovery-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasPromptRecovery';/);
  assert.match(helperSource, /export const normalizeCanvasPromptRecovery/);
  assert.match(helperSource, /export const markInterruptedSyncPromptGenerations/);
  assert.match(helperSource, /export const hasUnrecoverableSyncGenerationInFlight/);
  assert.doesNotMatch(contextSource, /const normalizeRecoveredPromptNode =/);
  assert.doesNotMatch(contextSource, /const normalizeCanvasPromptRecovery =/);
});

test('completed recovered prompts clear pending generation state', () => {
  const helperSource = readSource('src/context/canvasPromptRecovery.ts');

  assert.match(helperSource, /const isEffectivelyComplete = resolvedChildImageIds\.length > 0/);
  assert.match(helperSource, /const nextPendingTaskIds = isEffectivelyComplete \? \[\] : pendingTaskIds;/);
  assert.match(helperSource, /const nextPendingSyncRequests = isEffectivelyComplete \? \[\] : pendingSyncRequests;/);
  assert.match(helperSource, /jobId: isEffectivelyComplete \|\| shouldMarkInterrupted \? undefined/);
  assert.match(helperSource, /error: isEffectivelyComplete \? undefined/);
});

test('interrupted sync prompts are marked before risky unload persistence', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasPromptRecovery.ts');

  assert.match(contextSource, /prepareBeforeUnloadState: markInterruptedSyncPromptGenerations/);
  assert.match(helperSource, /code: node\.errorDetails\?\.code \|\| 'SYNC_REQUEST_INTERRUPTED'/);
  assert.match(helperSource, /pendingTaskIds: \[\]/);
  assert.match(helperSource, /pendingSyncRequests: \[\]/);
  assert.match(helperSource, /export const hasUnrecoverableSyncGenerationInFlight = \(state\?: CanvasState \| null\): boolean/);
});

test('completed recovered prompt behavior clears stale generation state', () => {
  const { normalizeCanvasPromptRecovery } = loadPromptRecoveryModuleForBehaviorTest();
  const result = normalizeCanvasPromptRecovery({
    id: 'canvas-1',
    name: 'Canvas',
    promptNodes: [
      {
        id: 'prompt-1',
        prompt: 'make a product image',
        position: { x: 0, y: 0 },
        childImageIds: ['image-1'],
        parallelCount: 1,
        isGenerating: true,
        jobId: 'task-1',
        error: 'stale provider error',
        generationMetadata: {
          pendingTaskIds: ['task-1'],
          pendingSyncRequests: [{ requestId: 'sync-1', index: 0, prompt: 'make a product image', startedAt: 1000 }],
          completedTasks: [{ taskId: 'done-1', resultUrls: ['https://cdn.example.com/image-1.png'] }],
        },
      },
    ],
    imageNodes: [
      {
        id: 'image-1',
        prompt: 'make a product image',
        url: 'https://cdn.example.com/image-1.png',
        parentPromptId: 'prompt-1',
        position: { x: 0, y: 0 },
      },
    ],
    groups: [],
    drawings: [],
  } as never);
  const prompt = result.promptNodes[0];

  assert.deepEqual(prompt.childImageIds, ['image-1']);
  assert.equal(prompt.isGenerating, false);
  assert.equal(prompt.jobId, undefined);
  assert.equal(prompt.error, undefined);
  assert.deepEqual(prompt.generationMetadata?.pendingTaskIds, []);
  assert.deepEqual(prompt.generationMetadata?.pendingSyncRequests, []);
  assert.deepEqual(prompt.generationMetadata?.completedTasks, [
    { taskId: 'done-1', resultUrls: ['https://cdn.example.com/image-1.png'] },
  ]);
});

test('interrupted sync prompt behavior clears risky in-flight generation before unload', () => {
  const {
    hasUnrecoverableSyncGenerationInFlight,
    markInterruptedSyncPromptGenerations,
  } = loadPromptRecoveryModuleForBehaviorTest();
  const state = {
    canvases: [
      {
        id: 'canvas-1',
        name: 'Canvas',
        promptNodes: [
          {
            id: 'prompt-1',
            prompt: 'make an image',
            model: 'provider/model',
            position: { x: 0, y: 0 },
            childImageIds: [],
            isGenerating: true,
            generationMetadata: {
              pendingTaskIds: [],
              pendingSyncRequests: [],
            },
          },
        ],
        imageNodes: [],
        groups: [],
        drawings: [],
      },
    ],
  };

  assert.equal(hasUnrecoverableSyncGenerationInFlight(state as never), true);

  const result = markInterruptedSyncPromptGenerations(state as never);
  const prompt = result.canvases[0].promptNodes[0];

  assert.equal(prompt.isGenerating, false);
  assert.equal(prompt.jobId, undefined);
  assert.equal(prompt.errorDetails?.code, 'SYNC_REQUEST_INTERRUPTED');
  assert.equal(prompt.errorDetails?.model, 'provider/model');
  assert.match(String(prompt.error), /同步生成请求/);
  assert.deepEqual(prompt.generationMetadata?.pendingTaskIds, []);
  assert.deepEqual(prompt.generationMetadata?.pendingSyncRequests, []);
  assert.equal(hasUnrecoverableSyncGenerationInFlight(result), false);
});
