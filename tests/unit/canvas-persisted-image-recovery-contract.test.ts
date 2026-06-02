import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import * as ts from 'typescript';

type PersistedImageRecoveryModule = typeof import('../../apps/web/src/context/canvasPersistedImageRecovery.ts');
type RequiredPersistedImageRecoveryExports = Pick<
  PersistedImageRecoveryModule,
  | 'buildPersistedImageRecoverySignature'
  | 'buildPromptRecoveryEntries'
  | 'resolveImageRecoveryUrlFromMetadata'
  | 'resolvePromptRecoveryEntrySource'
>;

const typedPersistedImageRecoveryExport: keyof RequiredPersistedImageRecoveryExports = 'buildPromptRecoveryEntries';
const ROOT_DIR = process.cwd();



function loadPersistedImageRecoveryModuleForBehaviorTest(options: {
  cachedImages?: Record<string, string>;
  strictOriginals?: Record<string, string>;
} = {}): RequiredPersistedImageRecoveryExports {
  const source = readSource('apps/web/src/context/canvasPersistedImageRecovery.ts');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleObject = { exports: {} as Record<string, unknown> };
  const dependencyStubs = new Map<string, unknown>([
    [
      '../services/storage/imageStorage',
      {
        getImage: async (id: string) => options.cachedImages?.[id],
        getImageByQuality: async () => undefined,
        getStrictOriginalImage: async (id: string) => options.strictOriginals?.[id],
      },
    ],
    ['../services/image/imageQuality', { ImageQuality: { MICRO: 'micro' }, getQualityStorageId: (id: string) => `${id}:micro` }],
    ['../utils/modelDisplayName', { resolveModelDisplayName: (model?: string, label?: string) => label || model || 'Unknown model' }],
    [
      '../utils/imageResultPersistence',
      {
        buildImageResultIdentity: (image?: { sourceTaskId?: string; sourceResultIndex?: number; apiResultUrl?: string; originalUrl?: string; url?: string }) => {
          if (!image) return undefined;
          const taskId = typeof image.sourceTaskId === 'string' ? image.sourceTaskId.trim() : '';
          const hasIndex = typeof image.sourceResultIndex === 'number' && Number.isFinite(image.sourceResultIndex);
          const url = image.apiResultUrl || image.originalUrl || image.url;
          if (taskId && hasIndex) return `${taskId}::${image.sourceResultIndex}`;
          if (taskId && url) return `${taskId}::${url}`;
          return url || taskId || undefined;
        },
        buildTaskResultIdentity: (params: { taskId?: string; resultIndex?: number; url?: string }) => {
          const taskId = typeof params.taskId === 'string' ? params.taskId.trim() : '';
          const hasIndex = typeof params.resultIndex === 'number' && Number.isFinite(params.resultIndex);
          if (taskId && hasIndex) return `${taskId}::${params.resultIndex}`;
          if (taskId && params.url) return `${taskId}::${params.url}`;
          return params.url || taskId || undefined;
        },
        getCompletedTaskResultUrls: (task?: { resultUrls?: unknown }) => (
          Array.isArray(task?.resultUrls)
            ? task.resultUrls.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
            : []
        ),
        getImageRecoveryCandidates: (image?: { apiResultUrl?: string; originalUrl?: string; url?: string }) => (
          [image?.apiResultUrl, image?.originalUrl, image?.url].filter(Boolean)
        ),
        getPromptCompletedTasks: (node?: { generationMetadata?: { completedTasks?: unknown } } | null) => (
          Array.isArray(node?.generationMetadata?.completedTasks)
            ? node.generationMetadata.completedTasks.filter((task) => !!task && typeof task === 'object' && typeof (task as { taskId?: unknown }).taskId === 'string')
            : []
        ),
        normalizePersistentResultUrl: (value?: string | null) => {
          const normalized = typeof value === 'string' ? value.trim() : '';
          return /^https?:\/\//i.test(normalized) ? normalized : undefined;
        },
      },
    ],
  ]);
  const requireStub = (specifier: string): unknown => {
    if (dependencyStubs.has(specifier)) {
      return dependencyStubs.get(specifier);
    }
    throw new Error(`Unexpected canvasPersistedImageRecovery test dependency: ${specifier}`);
  };
  const compiledModule = new Function('require', 'exports', 'module', transpiled);
  compiledModule(requireStub, moduleObject.exports, moduleObject);
  return moduleObject.exports as RequiredPersistedImageRecoveryExports;
}

test('persisted image recovery boundary lives outside CanvasContext', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasPersistedImageRecovery.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.equal(typedPersistedImageRecoveryExport, 'buildPromptRecoveryEntries');
  assert.match(testConfigSource, /tests\/unit\/canvas-persisted-image-recovery-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasPersistedImageRecovery';/);
  assert.match(helperSource, /export const buildPromptRecoveryEntries/);
  assert.match(helperSource, /export const buildPersistedImageRecoverySignature/);
  assert.match(helperSource, /export const resolveImageRecoveryUrlFromMetadata/);
  assert.match(helperSource, /export const resolvePromptRecoveryEntrySource/);
  assert.doesNotMatch(contextSource, /const buildPromptRecoveryEntries =/);
  assert.doesNotMatch(contextSource, /const buildPersistedImageRecoverySignature =/);
  assert.doesNotMatch(contextSource, /const resolveImageRecoveryUrlFromMetadata =/);
});

test('prompt recovery entries merge completed tasks and persisted tasks without duplicates', () => {
  const { buildPromptRecoveryEntries } = loadPersistedImageRecoveryModuleForBehaviorTest();
  const entries = buildPromptRecoveryEntries({
    id: 'prompt-1',
    prompt: 'make image',
    position: { x: 0, y: 0 },
    generationMetadata: {
      completedTasks: [
        {
          taskId: 'task-a',
          resultUrls: ['https://cdn.example.com/a-0.png', 'https://cdn.example.com/a-1.png'],
          resultStorageIds: { 1: 'stored-a-1' },
          completedAt: 1000,
          model: 'model-a',
          modelLabel: 'Model A',
        },
      ],
    },
  } as never, [
    {
      taskId: 'task-a',
      promptNodeId: 'prompt-1',
      resultUrls: ['https://cdn.example.com/a-0.png'],
      completedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      taskId: 'task-b',
      promptNodeId: 'prompt-1',
      resultUrls: ['https://cdn.example.com/b-0.png'],
      resultStorageIds: { 0: 'stored-b-0' },
      completedAt: '2026-01-02T00:00:00.000Z',
      model: 'model-b',
    },
  ] as never);

  assert.deepEqual(entries.map((entry) => ({
    taskId: entry.taskId,
    resultIndex: entry.resultIndex,
    url: entry.url,
    storageId: entry.storageId,
    modelLabel: entry.modelLabel,
  })), [
    {
      taskId: 'task-a',
      resultIndex: 0,
      url: 'https://cdn.example.com/a-0.png',
      storageId: undefined,
      modelLabel: 'Model A',
    },
    {
      taskId: 'task-a',
      resultIndex: 1,
      url: 'https://cdn.example.com/a-1.png',
      storageId: 'stored-a-1',
      modelLabel: 'Model A',
    },
    {
      taskId: 'task-b',
      resultIndex: 0,
      url: 'https://cdn.example.com/b-0.png',
      storageId: 'stored-b-0',
      modelLabel: undefined,
    },
  ]);
});

test('persisted image recovery signature records only missing recovery work', () => {
  const { buildPersistedImageRecoverySignature } = loadPersistedImageRecoveryModuleForBehaviorTest();
  const signature = buildPersistedImageRecoverySignature([
    {
      id: 'canvas-1',
      promptNodes: [
        {
          id: 'prompt-complete',
          prompt: 'already restored',
          position: { x: 0, y: 0 },
          generationMetadata: {
            completedTasks: [{ taskId: 'task-a', resultUrls: ['https://cdn.example.com/a.png'] }],
          },
        },
        {
          id: 'prompt-missing',
          prompt: 'needs restore',
          position: { x: 0, y: 0 },
          generationMetadata: {
            completedTasks: [{ taskId: 'task-b', resultUrls: ['https://cdn.example.com/b.png'] }],
          },
        },
      ],
      imageNodes: [
        {
          id: 'image-missing-original',
          prompt: 'thumbnail only',
          url: 'https://cdn.example.com/thumb.png',
          position: { x: 0, y: 0 },
        },
        {
          id: 'image-task-a',
          prompt: 'already restored',
          url: 'https://cdn.example.com/a.png',
          originalUrl: 'https://cdn.example.com/a.png',
          apiResultUrl: 'https://cdn.example.com/a.png',
          parentPromptId: 'prompt-complete',
          sourceTaskId: 'task-a',
          sourceResultIndex: 0,
          position: { x: 0, y: 0 },
        },
      ],
      groups: [],
      drawings: [],
    },
  ] as never);

  assert.match(signature, /img:canvas-1:image-missing-original/);
  assert.match(signature, /prompt:canvas-1:prompt-missing/);
  assert.doesNotMatch(signature, /prompt:canvas-1:prompt-complete/);
});

test('persisted image recovery URL resolution prefers stored originals and rejects blob fallbacks', async () => {
  const {
    resolveImageRecoveryUrlFromMetadata,
    resolvePromptRecoveryEntrySource,
  } = loadPersistedImageRecoveryModuleForBehaviorTest({
    cachedImages: {
      'cached-only': 'https://cache.example.com/cached.png',
    },
    strictOriginals: {
      'stored-original': 'https://storage.example.com/original.png',
    },
  });

  assert.equal(
    await resolvePromptRecoveryEntrySource({
      taskId: 'task-a',
      resultIndex: 0,
      storageId: 'stored-original',
      url: 'https://cdn.example.com/fallback.png',
    }),
    'https://storage.example.com/original.png',
  );
  assert.equal(
    await resolvePromptRecoveryEntrySource({
      taskId: 'task-blob',
      resultIndex: 0,
      url: 'blob:stale-object-url',
    }),
    undefined,
  );
  assert.equal(
    await resolveImageRecoveryUrlFromMetadata({
      id: 'image-1',
      storageId: 'stored-original',
      apiResultUrl: 'https://cdn.example.com/direct.png',
      prompt: 'image',
      url: '',
      position: { x: 0, y: 0 },
    } as never, undefined),
    'https://storage.example.com/original.png',
  );
  assert.equal(
    await resolveImageRecoveryUrlFromMetadata({
      id: 'cached-only',
      apiResultUrl: 'blob:stale-object-url',
      prompt: 'image',
      url: '',
      position: { x: 0, y: 0 },
    } as never, undefined),
    'https://cache.example.com/cached.png',
  );
});
