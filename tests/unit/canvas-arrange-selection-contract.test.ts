import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  KnownModel,
  type Canvas,
  type GeneratedImage,
  type PromptNode,
} from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasArrangeSelectionModule = {
  arrangeSingleSelectedPromptChildren: (
    canvas: Canvas,
    selectedIds: string[],
    mode: 'row' | 'grid' | 'column',
    options?: { now?: () => number }
  ) => { canvas: Canvas; subCardLayoutMode: 'row' | 'grid' | 'column' } | null;
  arrangeSelectedRootNodes: (
    canvas: Canvas,
    selectedIds: string[],
    mode: 'row' | 'grid' | 'column',
    options?: { now?: () => number }
  ) => { canvas: Canvas } | null;
  arrangeSelectedGroupedNodes: (
    canvas: Canvas,
    selectedIds: string[],
    mode: 'row' | 'grid' | 'column',
    options?: { now?: () => number }
  ) => { canvas: Canvas; subCardLayoutMode: 'row' | 'grid' | 'column' } | null;
};



async function loadCanvasArrangeSelectionModule(): Promise<CanvasArrangeSelectionModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/context/canvasArrangeSelection.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/context/canvasArrangeSelection.ts must exist');
  return await import('../../apps/web/src/context/canvasArrangeSelection.ts') as CanvasArrangeSelectionModule;
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

test('single prompt child arrange boundary lives outside CanvasContext', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasArrangeSelection.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-arrange-selection-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasArrangeSelection';/);
  assert.match(helperSource, /export function arrangeSingleSelectedPromptChildren/);

  const wrapperSource = contextSource.slice(
    contextSource.indexOf('const arrangeAllNodes = useCallback'),
    contextSource.indexOf('const selectedRootArrange = arrangeSelectedRootNodes')
  );
  assert.match(wrapperSource, /arrangeSingleSelectedPromptChildren\(currentCanvas, selectedIds, mode\)/);
  assert.doesNotMatch(wrapperSource, /const childImages = currentCanvas\.imageNodes\.filter\(img => img\.parentPromptId === prompt\.id\)/);
  assert.doesNotMatch(wrapperSource, /newImagePositions/);
});

test('selected root arrange boundary lives outside CanvasContext without any roots', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasArrangeSelection.ts');

  assert.match(helperSource, /export function arrangeSelectedRootNodes/);
  assert.match(contextSource, /arrangeSelectedRootNodes\(currentCanvas, selectedIds, mode\)/);
  assert.doesNotMatch(contextSource, /let roots: any\[\] = \[\]/);
  assert.doesNotMatch(contextSource, /uniqueRootsMap = new Map/);
});

test('selected grouped arrange boundary lives outside CanvasContext', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasArrangeSelection.ts');

  assert.match(helperSource, /export function arrangeSelectedGroupedNodes/);
  assert.match(contextSource, /arrangeSelectedGroupedNodes\(currentCanvas, selectedIds, mode\)/);

  const wrapperSource = contextSource.slice(
    contextSource.indexOf('const selectedRootArrange = arrangeSelectedRootNodes'),
    contextSource.indexOf('// --- New layout logic: start from the upper-left')
  );
  assert.doesNotMatch(wrapperSource, /type SelectedGroup =/);
  assert.doesNotMatch(wrapperSource, /buildSelectionImageLayout/);
  assert.doesNotMatch(wrapperSource, /selectedGroupsForArrange/);
});

test('arrangeSingleSelectedPromptChildren lays out one selected prompt children in a row', async () => {
  const { arrangeSingleSelectedPromptChildren } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', position: { x: 500, y: 100 }, childImageIds: ['image-1', 'image-2'] })],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1', position: { x: 0, y: 0 } }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-1', position: { x: 0, y: 0 } }),
      imageNode({ id: 'image-3', parentPromptId: '', position: { x: 1, y: 2 } }),
    ],
    lastModified: 10,
  });

  const result = arrangeSingleSelectedPromptChildren(source, ['prompt-1'], 'row', { now: () => 123 });

  assert.equal(result?.subCardLayoutMode, 'row');
  assert.equal(result?.canvas.lastModified, 123);
  assert.deepEqual(result?.canvas.imageNodes.map((image) => [image.id, image.position]), [
    ['image-1', { x: 344, y: 519 }],
    ['image-2', { x: 656, y: 519 }],
    ['image-3', { x: 1, y: 2 }],
  ]);
});

test('arrangeSingleSelectedPromptChildren forces PPT prompts into column layout', async () => {
  const { arrangeSingleSelectedPromptChildren } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({
        id: 'prompt-1',
        mode: GenerationMode.PPT,
        position: { x: 500, y: 100 },
        childImageIds: ['image-1', 'image-2'],
      }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1', position: { x: 0, y: 0 } }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-1', position: { x: 0, y: 0 } }),
    ],
    lastModified: 10,
  });

  const result = arrangeSingleSelectedPromptChildren(source, ['prompt-1'], 'row', { now: () => 124 });

  assert.equal(result?.subCardLayoutMode, 'column');
  assert.deepEqual(result?.canvas.imageNodes.map((image) => [image.id, image.position]), [
    ['image-1', { x: 500, y: 519 }],
    ['image-2', { x: 500, y: 914 }],
  ]);
});

test('arrangeSingleSelectedPromptChildren returns null outside the single-prompt child case', async () => {
  const { arrangeSingleSelectedPromptChildren } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', position: { x: 0, y: 0 } }),
      promptNode({ id: 'prompt-2', position: { x: 10, y: 10 } }),
    ],
    imageNodes: [imageNode({ id: 'image-1', parentPromptId: 'prompt-1' })],
    lastModified: 10,
  });

  assert.equal(arrangeSingleSelectedPromptChildren(source, ['image-1'], 'grid'), null);
  assert.equal(arrangeSingleSelectedPromptChildren(source, ['prompt-1', 'prompt-2'], 'grid'), null);
  assert.equal(arrangeSingleSelectedPromptChildren(source, ['prompt-2'], 'grid'), null);
});

test('arrangeSelectedRootNodes lays out selected standalone images in a row', async () => {
  const { arrangeSelectedRootNodes } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    imageNodes: [
      imageNode({ id: 'image-1', position: { x: 0, y: 320 } }),
      imageNode({ id: 'image-2', position: { x: 500, y: 320 } }),
      imageNode({ id: 'image-3', position: { x: 900, y: 100 } }),
    ],
    lastModified: 10,
  });

  const result = arrangeSelectedRootNodes(source, ['image-1', 'image-2'], 'row', { now: () => 125 });

  assert.equal(result?.canvas.lastModified, 125);
  assert.deepEqual(result?.canvas.imageNodes.map((image) => [image.id, image.position]), [
    ['image-1', { x: 0, y: 320 }],
    ['image-2', { x: 400, y: 320 }],
    ['image-3', { x: 900, y: 100 }],
  ]);
});

test('arrangeSelectedRootNodes moves child images with selected prompt roots', async () => {
  const { arrangeSelectedRootNodes } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', position: { x: 0, y: 200 }, height: 200 }),
      promptNode({ id: 'prompt-2', position: { x: 600, y: 200 }, height: 200, childImageIds: ['image-1'] }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-2', position: { x: 600, y: 600 } }),
      imageNode({ id: 'image-2', position: { x: 1000, y: 600 } }),
    ],
    lastModified: 10,
  });

  const result = arrangeSelectedRootNodes(source, ['prompt-1', 'prompt-2'], 'row', { now: () => 126 });

  assert.deepEqual(result?.canvas.promptNodes.map((prompt) => [prompt.id, prompt.position]), [
    ['prompt-1', { x: 0, y: 200 }],
    ['prompt-2', { x: 440, y: 200 }],
  ]);
  assert.deepEqual(result?.canvas.imageNodes.map((image) => [image.id, image.position]), [
    ['image-1', { x: 440, y: 600 }],
    ['image-2', { x: 1000, y: 600 }],
  ]);
});

test('arrangeSelectedRootNodes returns null when selection collapses to one root', async () => {
  const { arrangeSelectedRootNodes } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', position: { x: 0, y: 200 }, childImageIds: ['image-1'] })],
    imageNodes: [imageNode({ id: 'image-1', parentPromptId: 'prompt-1', position: { x: 0, y: 600 } })],
  });

  assert.equal(arrangeSelectedRootNodes(source, ['prompt-1', 'image-1'], 'grid'), null);
});

test('arrangeSelectedGroupedNodes lays out a selected prompt child group', async () => {
  const { arrangeSelectedGroupedNodes } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', position: { x: 500, y: 200 }, height: 200, childImageIds: ['image-1', 'image-2'] }),
      promptNode({ id: 'prompt-2', position: { x: 900, y: 200 }, height: 200 }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1', position: { x: 500, y: 600 } }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-1', position: { x: 600, y: 600 } }),
      imageNode({ id: 'image-3', parentPromptId: '', position: { x: 1000, y: 600 } }),
    ],
    lastModified: 10,
  });

  const result = arrangeSelectedGroupedNodes(source, ['prompt-1', 'image-1'], 'row', { now: () => 127 });

  assert.equal(result?.subCardLayoutMode, 'row');
  assert.equal(result?.canvas.lastModified, 127);
  assert.deepEqual(result?.canvas.promptNodes.map((prompt) => [prompt.id, prompt.position]), [
    ['prompt-1', { x: 500, y: 90.5 }],
    ['prompt-2', { x: 900, y: 200 }],
  ]);
  assert.deepEqual(result?.canvas.imageNodes.map((image) => [image.id, image.position]), [
    ['image-1', { x: 344, y: 509.5 }],
    ['image-2', { x: 656, y: 509.5 }],
    ['image-3', { x: 1000, y: 600 }],
  ]);
});

test('arrangeSelectedGroupedNodes returns null for single selected nodes', async () => {
  const { arrangeSelectedGroupedNodes } = await loadCanvasArrangeSelectionModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', position: { x: 500, y: 200 }, childImageIds: ['image-1'] })],
    imageNodes: [imageNode({ id: 'image-1', parentPromptId: 'prompt-1', position: { x: 500, y: 600 } })],
  });

  assert.equal(arrangeSelectedGroupedNodes(source, ['prompt-1'], 'grid'), null);
  assert.equal(arrangeSelectedGroupedNodes(source, ['image-1'], 'grid'), null);
});
