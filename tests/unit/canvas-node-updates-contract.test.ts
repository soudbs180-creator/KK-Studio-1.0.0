import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { AspectRatio, ImageSize, KnownModel, type Canvas, type GeneratedImage, type PromptNode } from '../../src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasNodeUpdatesModule = {
  addCanvasPromptNode: (canvas: Canvas, node: PromptNode) => Canvas;
  updateCanvasPromptNode: (canvas: Canvas, node: PromptNode) => Canvas;
  updateCanvasImageNodeDimensions: (canvas: Canvas, id: string, dimensions: string) => Canvas;
  updateCanvasImageNode: (canvas: Canvas, id: string, updates: Partial<GeneratedImage>) => Canvas;
  applyCanvasNodeBatchUpdates: (
    canvas: Canvas,
    batch: {
      promptNodes?: Array<{ id: string; updates: Partial<PromptNode> }>;
      imageNodes?: Array<{ id: string; updates: Partial<GeneratedImage> }>;
    },
  ) => Canvas;
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadCanvasNodeUpdatesModule(): Promise<CanvasNodeUpdatesModule> {
  const fullPath = path.join(ROOT_DIR, 'src/context/canvasNodeUpdates.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasNodeUpdates.ts must exist');
  return await import('../../src/context/canvasNodeUpdates.ts') as CanvasNodeUpdatesModule;
}

function promptNode(input: Partial<PromptNode> & Pick<PromptNode, 'id'>): PromptNode {
  return {
    id: input.id,
    prompt: input.prompt ?? input.id,
    position: input.position ?? { x: 0, y: 0 },
    aspectRatio: input.aspectRatio ?? AspectRatio.SQUARE,
    imageSize: input.imageSize ?? ImageSize.SIZE_1K,
    model: input.model ?? KnownModel.IMAGEN_4,
    childImageIds: input.childImageIds ?? [],
    timestamp: input.timestamp ?? 1,
    ...input,
  };
}

function imageNode(input: Partial<GeneratedImage> & Pick<GeneratedImage, 'id'>): GeneratedImage {
  return {
    id: input.id,
    url: input.url ?? `https://cdn.example.com/${input.id}.png`,
    prompt: input.prompt ?? input.id,
    aspectRatio: input.aspectRatio ?? AspectRatio.SQUARE,
    timestamp: input.timestamp ?? 1,
    model: input.model ?? KnownModel.IMAGEN_4,
    canvasId: input.canvasId ?? 'canvas-1',
    parentPromptId: input.parentPromptId ?? '',
    position: input.position ?? { x: 0, y: 0 },
    ...input,
  };
}

function canvas(input: Partial<Canvas> & Pick<Canvas, 'id'>): Canvas {
  return {
    id: input.id,
    name: input.name ?? input.id,
    promptNodes: input.promptNodes ?? [],
    imageNodes: input.imageNodes ?? [],
    groups: input.groups ?? [],
    drawings: input.drawings ?? [],
    lastModified: input.lastModified ?? 0,
    ...input,
  };
}

test('canvas node update boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasNodeUpdates.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-node-updates-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasNodeUpdates';/);
  assert.match(helperSource, /export function addCanvasPromptNode/);
  assert.match(helperSource, /export function updateCanvasPromptNode/);
  assert.match(helperSource, /export function updateCanvasImageNodeDimensions/);
  assert.match(helperSource, /export function updateCanvasImageNode/);
  assert.match(helperSource, /export function applyCanvasNodeBatchUpdates/);

  const promptUpdateWrapperSource = contextSource.slice(
    contextSource.indexOf('const addPromptNode = useCallback'),
    contextSource.indexOf('const urgentUpdatePromptNode = useCallback')
  );
  const nodeUpdateWrapperSource = contextSource.slice(
    contextSource.indexOf('const updateImageNodeDimensions = useCallback'),
    contextSource.indexOf('const persistedImageRecoverySignature = useMemo')
  );
  assert.match(promptUpdateWrapperSource, /addCanvasPromptNode\(canvas, node\)/);
  assert.match(promptUpdateWrapperSource, /updateCanvasPromptNode\(canvas, node\)/);
  assert.doesNotMatch(promptUpdateWrapperSource, /const allZIndices = \[/);
  assert.doesNotMatch(promptUpdateWrapperSource, /promptNodes: c\.promptNodes\.map\(n => \{/);

  assert.match(nodeUpdateWrapperSource, /updateCanvasImageNodeDimensions\(canvas, id, dimensions\)/);
  assert.match(nodeUpdateWrapperSource, /updateCanvasImageNode\(canvas, id, updates\)/);
  assert.match(nodeUpdateWrapperSource, /applyCanvasNodeBatchUpdates\(canvas, batch\)/);
  assert.doesNotMatch(nodeUpdateWrapperSource, /new Map\(batch\.promptNodes/);
  assert.doesNotMatch(nodeUpdateWrapperSource, /new Map\(batch\.imageNodes/);
  assert.doesNotMatch(nodeUpdateWrapperSource, /imageNodes: c\.imageNodes\.map/);
});

test('addCanvasPromptNode appends a prompt above existing canvas nodes and skips duplicate ids', async () => {
  const { addCanvasPromptNode } = await loadCanvasNodeUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', zIndex: 2 }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', zIndex: 9 }),
    ],
    groups: [
      { id: 'group-1', nodeIds: ['prompt-1'], bounds: { x: 0, y: 0, width: 100, height: 100 }, type: 'custom', zIndex: 4 },
    ],
  });

  const added = addCanvasPromptNode(source, promptNode({ id: 'prompt-2', zIndex: 1 }));
  const duplicate = addCanvasPromptNode(source, promptNode({ id: 'prompt-1', zIndex: 99 }));

  assert.notEqual(added, source);
  assert.deepEqual(added.promptNodes.map((node) => [node.id, node.zIndex]), [
    ['prompt-1', 2],
    ['prompt-2', 10],
  ]);
  assert.equal(added.imageNodes, source.imageNodes);
  assert.equal(added.groups, source.groups);
  assert.equal(added.lastModified, source.lastModified);
  assert.equal(duplicate, source);
});

test('updateCanvasPromptNode defensively preserves prompt/reference data from empty updates', async () => {
  const { updateCanvasPromptNode } = await loadCanvasNodeUpdatesModule();
  const existingReference = { id: 'ref-1', data: 'base64-data', mimeType: 'image/png' };
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', prompt: 'keep prompt', referenceImages: [existingReference] }),
    ],
  });

  const result = updateCanvasPromptNode(source, promptNode({
    id: 'prompt-1',
    prompt: '',
    referenceImages: [],
    isGenerating: true,
  }));

  assert.notEqual(result, source);
  assert.equal(result.promptNodes[0].prompt, 'keep prompt');
  assert.equal(result.promptNodes[0].referenceImages, source.promptNodes[0].referenceImages);
  assert.equal(result.promptNodes[0].isGenerating, true);
  assert.equal(result.lastModified, source.lastModified);
});

test('updateCanvasPromptNode blocks stale generating updates after success or failure', async () => {
  const { updateCanvasPromptNode } = await loadCanvasNodeUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({
        id: 'completed-prompt',
        childImageIds: ['image-1'],
        isGenerating: false,
      }),
      promptNode({
        id: 'failed-prompt',
        error: 'provider failed',
        errorDetails: { code: 'provider_error' },
        isGenerating: false,
      }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'completed-prompt' }),
    ],
  });

  const completedResult = updateCanvasPromptNode(source, promptNode({
    id: 'completed-prompt',
    prompt: 'completed-prompt',
    isGenerating: true,
  }));
  const failedResult = updateCanvasPromptNode(source, promptNode({
    id: 'failed-prompt',
    prompt: 'failed-prompt',
    isGenerating: true,
  }));

  assert.equal(completedResult.promptNodes[0].isGenerating, false);
  assert.equal(failedResult.promptNodes[1].isGenerating, false);
  assert.equal(failedResult.promptNodes[1].error, 'provider failed');
  assert.deepEqual(failedResult.promptNodes[1].errorDetails, { code: 'provider_error' });
});

test('updateCanvasImageNodeDimensions changes only the matching image dimensions', async () => {
  const { updateCanvasImageNodeDimensions } = await loadCanvasNodeUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1' })],
    imageNodes: [
      imageNode({ id: 'image-1', dimensions: '1024x1024' }),
      imageNode({ id: 'image-2', dimensions: '512x512' }),
    ],
  });

  const result = updateCanvasImageNodeDimensions(source, 'image-1', '2048x2048');

  assert.notEqual(result, source);
  assert.equal(result.promptNodes, source.promptNodes);
  assert.deepEqual(result.imageNodes.map((node) => [node.id, node.dimensions]), [
    ['image-1', '2048x2048'],
    ['image-2', '512x512'],
  ]);
  assert.notEqual(result.imageNodes[0], source.imageNodes[0]);
  assert.equal(result.imageNodes[1], source.imageNodes[1]);
  assert.equal(result.lastModified, source.lastModified);
});

test('updateCanvasImageNode shallow-merges updates and preserves nonmatching images', async () => {
  const { updateCanvasImageNode } = await loadCanvasNodeUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    imageNodes: [
      imageNode({ id: 'image-1', alias: 'old', tags: ['keep'] }),
      imageNode({ id: 'image-2', alias: 'other' }),
    ],
  });

  const result = updateCanvasImageNode(source, 'image-1', { alias: 'new', dimensions: 'wide' });
  const emptyUpdate = updateCanvasImageNode(source, 'image-1', {});

  assert.deepEqual(result.imageNodes[0], { ...source.imageNodes[0], alias: 'new', dimensions: 'wide' });
  assert.equal(result.imageNodes[1], source.imageNodes[1]);
  assert.notEqual(emptyUpdate, source);
  assert.notEqual(emptyUpdate.imageNodes[0], source.imageNodes[0]);
  assert.deepEqual(emptyUpdate.imageNodes[0], source.imageNodes[0]);
});

test('applyCanvasNodeBatchUpdates updates prompt and image batches with last duplicate id winning', async () => {
  const { applyCanvasNodeBatchUpdates } = await loadCanvasNodeUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', prompt: 'old' }),
      promptNode({ id: 'prompt-2', prompt: 'keep' }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', alias: 'old-image' }),
      imageNode({ id: 'image-2', alias: 'keep-image' }),
    ],
  });

  const result = applyCanvasNodeBatchUpdates(source, {
    promptNodes: [
      { id: 'prompt-1', updates: { prompt: 'first' } },
      { id: 'prompt-1', updates: { prompt: 'second', tags: ['winner'] } },
    ],
    imageNodes: [{ id: 'image-1', updates: { alias: 'updated-image' } }],
  });

  assert.notEqual(result, source);
  assert.deepEqual(result.promptNodes.map((node) => [node.id, node.prompt, node.tags]), [
    ['prompt-1', 'second', ['winner']],
    ['prompt-2', 'keep', undefined],
  ]);
  assert.deepEqual(result.imageNodes.map((node) => [node.id, node.alias]), [
    ['image-1', 'updated-image'],
    ['image-2', 'keep-image'],
  ]);
  assert.notEqual(result.promptNodes[0], source.promptNodes[0]);
  assert.equal(result.promptNodes[1], source.promptNodes[1]);
  assert.notEqual(result.imageNodes[0], source.imageNodes[0]);
  assert.equal(result.imageNodes[1], source.imageNodes[1]);
  assert.equal(result.lastModified, source.lastModified);
});

test('applyCanvasNodeBatchUpdates returns the original canvas for empty or unmatched batches', async () => {
  const { applyCanvasNodeBatchUpdates } = await loadCanvasNodeUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1' })],
    imageNodes: [imageNode({ id: 'image-1' })],
  });

  assert.equal(applyCanvasNodeBatchUpdates(source, {}), source);
  assert.equal(applyCanvasNodeBatchUpdates(source, { promptNodes: [], imageNodes: [] }), source);
  assert.equal(
    applyCanvasNodeBatchUpdates(source, {
      promptNodes: [{ id: 'missing-prompt', updates: { prompt: 'unused' } }],
      imageNodes: [{ id: 'missing-image', updates: { alias: 'unused' } }],
    }),
    source,
  );
});
