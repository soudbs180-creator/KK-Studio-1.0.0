import test from 'node:test';
import assert from 'node:assert/strict';

import { zipOutputs } from '../../apps/web/src/features/assets/zipOutputs.ts';
import {
  resolveImageNodesForDownload,
  resolveOriginalSource,
  resolveOriginalSourceCandidates,
} from '../../apps/web/src/features/assets/resolveOriginalAssets.ts';

const makeImage = (patch: Record<string, unknown>) => ({
  id: 'img',
  url: '',
  prompt: 'test prompt',
  aspectRatio: '1:1',
  imageSize: '1K',
  timestamp: 100,
  model: 'test-model',
  canvasId: 'canvas-1',
  parentPromptId: 'prompt-1',
  position: { x: 0, y: 0 },
  ...patch,
} as any);

const makePrompt = (patch: Record<string, unknown>) => ({
  id: 'prompt-1',
  prompt: 'prompt text',
  position: { x: 0, y: 0 },
  aspectRatio: '1:1',
  imageSize: '1K',
  model: 'test-model',
  childImageIds: [],
  timestamp: 100,
  ...patch,
} as any);

test('selected ZIP packages only the selected image originalUrl', async () => {
  const fetchedUrls: string[] = [];
  const result = await zipOutputs('selected_cards', {
    projectName: 'Test',
    canvasId: 'canvas-1',
    batchId: 'batch-1',
    selectedNodeIds: ['img-1'],
    promptNodes: [],
    imageNodes: [
      makeImage({ id: 'img-1', originalUrl: 'https://cdn.example.com/original-a.png', url: 'https://cdn.example.com/preview-a.png' }),
      makeImage({ id: 'img-2', originalUrl: 'https://cdn.example.com/original-b.png', url: 'https://cdn.example.com/preview-b.png' }),
    ],
    skipSave: true,
    fetchBlob: async (url) => {
      fetchedUrls.push(url);
      return new Blob([url], { type: 'image/png' });
    },
  });

  assert.equal(result.count, 1);
  assert.equal(result.failedCount, 0);
  assert.ok(result.zipBlob);
  assert.equal(result.manifest.items[0].nodeId, 'img-1');
  assert.equal(result.manifest.items[0].sourceKind, 'originalUrl');
  assert.equal(result.manifest.items[0].originalUrlUsed, true);
  assert.deepEqual(fetchedUrls, ['https://cdn.example.com/original-a.png']);
});

test('selected ZIP resolves selected prompt child images', async () => {
  const result = await zipOutputs('selected_cards', {
    projectName: 'Test',
    canvasId: 'canvas-1',
    batchId: 'batch-1',
    selectedNodeIds: ['prompt-1'],
    promptNodes: [
      makePrompt({ id: 'prompt-1', prompt: 'parent prompt', childImageIds: ['img-1', 'img-2'] }),
    ],
    imageNodes: [
      makeImage({ id: 'img-1', parentPromptId: 'prompt-1', apiResultUrl: 'https://cdn.example.com/api-a.png' }),
      makeImage({ id: 'img-2', parentPromptId: 'prompt-1', url: 'https://cdn.example.com/preview-b.png' }),
      makeImage({ id: 'img-3', parentPromptId: 'other', url: 'https://cdn.example.com/preview-c.png' }),
    ],
    skipSave: true,
    fetchBlob: async (url) => new Blob([url], { type: 'image/png' }),
  });

  assert.equal(result.count, 2);
  assert.deepEqual(result.manifest.items.map(item => item.nodeId).sort(), ['img-1', 'img-2']);
  assert.equal(result.manifest.items[0].promptSummary, 'test prompt');
  assert.equal(result.manifest.items[0].model, 'test-model');
  assert.equal(result.manifest.items[0].createdAt, '1970-01-01T00:00:00.100Z');
});

test('selected ZIP dedupes prompt and child image selections', () => {
  const images = resolveImageNodesForDownload({
    scope: 'selected_cards',
    selectedNodeIds: ['prompt-1', 'img-1'],
    activeCanvas: {
      promptNodes: [
        makePrompt({ id: 'prompt-1', childImageIds: ['img-1', 'img-2'] }),
      ],
      imageNodes: [
        makeImage({ id: 'img-1' }),
        makeImage({ id: 'img-2' }),
      ],
    },
  });

  assert.deepEqual(images.map(image => image.id).sort(), ['img-1', 'img-2']);
});

test('original source resolution prefers originalUrl, apiResultUrl, url, then storageId', () => {
  assert.equal(resolveOriginalSource(makeImage({
    id: 'img-1',
    originalUrl: 'https://cdn.example.com/original.png',
    apiResultUrl: 'https://cdn.example.com/api.png',
    url: 'https://cdn.example.com/preview.png',
  })).sourceKind, 'originalUrl');

  assert.equal(resolveOriginalSource(makeImage({
    id: 'img-2',
    originalUrl: '',
    apiResultUrl: 'https://cdn.example.com/api.png',
    url: 'https://cdn.example.com/preview.png',
  })).sourceKind, 'apiResultUrl');

  assert.equal(resolveOriginalSource(makeImage({
    id: 'img-3',
    originalUrl: '',
    apiResultUrl: '',
    url: 'https://cdn.example.com/preview.png',
  })).sourceKind, 'url');

  assert.equal(resolveOriginalSource(makeImage({
    id: 'img-4',
    originalUrl: '',
    apiResultUrl: '',
    url: '',
    storageId: 'stored-img-4',
  })).sourceKind, 'storageId');

  assert.deepEqual(resolveOriginalSourceCandidates(makeImage({
    id: 'img-5',
    originalUrl: 'https://cdn.example.com/original.png',
    apiResultUrl: 'https://cdn.example.com/api.png',
    url: 'https://cdn.example.com/preview.png',
    storageId: 'stored-img-5',
  })).map(candidate => candidate.sourceKind), ['originalUrl', 'apiResultUrl', 'url', 'storageId']);
});

test('selected ZIP falls back from originalUrl to apiResultUrl when original fails', async () => {
  const fetchedUrls: string[] = [];
  const result = await zipOutputs('selected_cards', {
    projectName: 'Test',
    canvasId: 'canvas-1',
    batchId: 'batch-1',
    selectedNodeIds: ['img-1'],
    promptNodes: [],
    imageNodes: [
      makeImage({
        id: 'img-1',
        originalUrl: 'https://cdn.example.com/fail-original.png',
        apiResultUrl: 'https://cdn.example.com/api-result.png',
        url: 'https://cdn.example.com/preview.png',
      }),
    ],
    skipSave: true,
    fetchBlob: async (url) => {
      fetchedUrls.push(url);
      if (url.includes('fail-original')) throw new Error('network_down');
      return new Blob([url], { type: 'image/png' });
    },
  });

  assert.equal(result.count, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.manifest.items[0].sourceKind, 'apiResultUrl');
  assert.deepEqual(fetchedUrls, [
    'https://cdn.example.com/fail-original.png',
    'https://cdn.example.com/api-result.png',
  ]);
});

test('selected ZIP clearly errors with no selected downloadable cards', async () => {
  await assert.rejects(
    () => zipOutputs('selected_cards', {
      projectName: 'Test',
      canvasId: 'canvas-1',
      batchId: 'batch-1',
      selectedNodeIds: [],
      promptNodes: [],
      imageNodes: [makeImage({ id: 'img-1', url: 'https://cdn.example.com/a.png' })],
      skipSave: true,
      fetchBlob: async (url) => new Blob([url], { type: 'image/png' }),
    }),
    /No selected image cards/
  );
});

test('selected ZIP writes failedItems into manifest', async () => {
  const result = await zipOutputs('selected_cards', {
    projectName: 'Test',
    canvasId: 'canvas-1',
    batchId: 'batch-1',
    selectedNodeIds: ['img-1', 'img-2'],
    promptNodes: [],
    imageNodes: [
      makeImage({ id: 'img-1', url: 'https://cdn.example.com/success.png' }),
      makeImage({ id: 'img-2', url: 'https://cdn.example.com/fail.png' }),
    ],
    skipSave: true,
    fetchBlob: async (url) => {
      if (url.includes('fail')) throw new Error('network_down');
      return new Blob([url], { type: 'image/png' });
    },
  });

  assert.equal(result.count, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.manifest.failedItems[0].nodeId, 'img-2');
  assert.equal(result.manifest.failedItems[0].reason, 'network_down');
  assert.deepEqual(result.manifest.failedItems[0].attemptedSources, ['url']);
});

test('selected ZIP returns a manifest-only archive when every download fails', async () => {
  const result = await zipOutputs('selected_cards', {
    projectName: 'Test',
    canvasId: 'canvas-1',
    batchId: 'batch-1',
    selectedNodeIds: ['img-1'],
    promptNodes: [],
    imageNodes: [
      makeImage({ id: 'img-1', url: 'https://cdn.example.com/fail.png' }),
    ],
    skipSave: true,
    fetchBlob: async () => {
      throw new Error('network_down');
    },
  });

  assert.equal(result.count, 0);
  assert.equal(result.failedCount, 1);
  assert.ok(result.zipBlob);
  assert.equal(result.manifest.failedItems[0].reason, 'network_down');
});
