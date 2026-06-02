import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  AspectRatio,
  ImageSize,
  KnownModel,
  type Canvas,
  type CanvasGroup,
  type GeneratedImage,
  type PromptNode,
} from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

type MergeCanvasIntoState = {
  canvases: Canvas[];
  activeCanvasId: string;
  selectedNodeIds: string[];
  history: Record<string, { past: Canvas[]; future: Canvas[] }>;
};

type CanvasMergeIntoModule = {
  mergeCanvasIntoState: (
    state: MergeCanvasIntoState,
    sourceCanvasId: string,
    targetCanvasId: string,
    options?: { deleteSource?: boolean; now?: () => number }
  ) => { state: MergeCanvasIntoState; summary: { movedPrompts: number; movedImages: number; deletedSource: boolean } };
};



async function loadCanvasMergeIntoModule(): Promise<CanvasMergeIntoModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/context/canvasMergeInto.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/context/canvasMergeInto.ts must exist');
  return await import('../../apps/web/src/context/canvasMergeInto.ts') as CanvasMergeIntoModule;
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

function group(input: Partial<CanvasGroup> & Pick<CanvasGroup, 'id'>): CanvasGroup {
  return {
    id: input.id,
    nodeIds: input.nodeIds ?? [],
    bounds: input.bounds ?? { x: 0, y: 0, width: 100, height: 100 },
    type: 'custom',
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

function state(input: Partial<MergeCanvasIntoState> & Pick<MergeCanvasIntoState, 'canvases' | 'activeCanvasId'>): MergeCanvasIntoState {
  return {
    canvases: input.canvases,
    activeCanvasId: input.activeCanvasId,
    selectedNodeIds: input.selectedNodeIds ?? [],
    history: input.history ?? {},
  };
}

test('canvas merge-into boundary lives outside CanvasContext', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasMergeInto.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-merge-into-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasMergeInto';/);
  assert.match(helperSource, /export function mergeCanvasIntoState/);

  const wrapperSource = contextSource.slice(
    contextSource.indexOf('const mergeCanvasInto = useCallback'),
    contextSource.indexOf('const cleanupInvalidCards = useCallback')
  );
  assert.match(wrapperSource, /mergeCanvasIntoState\(prev, sourceCanvasId, targetCanvasId, options\)/);
  assert.doesNotMatch(wrapperSource, /targetPromptIds/);
  assert.doesNotMatch(wrapperSource, /targetMaxX/);
  assert.doesNotMatch(wrapperSource, /movedGroups/);
});

test('mergeCanvasIntoState moves unique nodes, offsets positions, and deletes the active source by default', async () => {
  const { mergeCanvasIntoState } = await loadCanvasMergeIntoModule();
  const source = state({
    activeCanvasId: 'source',
    selectedNodeIds: ['prompt-1', 'image-1'],
    canvases: [
      canvas({
        id: 'source',
        promptNodes: [
          promptNode({ id: 'prompt-1', position: { x: 10, y: 20 } }),
          promptNode({ id: 'dup-prompt', position: { x: 30, y: 40 } }),
        ],
        imageNodes: [
          imageNode({ id: 'image-1', canvasId: 'source', position: { x: 15, y: 25 } }),
          imageNode({ id: 'dup-image', canvasId: 'source', position: { x: 35, y: 45 } }),
        ],
        groups: [
          group({ id: 'group-1', nodeIds: ['prompt-1', 'image-1', 'dup-prompt'] }),
          group({ id: 'dup-group', nodeIds: ['prompt-1'] }),
        ],
      }),
      canvas({
        id: 'target',
        promptNodes: [promptNode({ id: 'dup-prompt', position: { x: 100, y: 5 } })],
        imageNodes: [imageNode({ id: 'dup-image', canvasId: 'target', position: { x: 200, y: 6 } })],
        groups: [group({ id: 'dup-group', nodeIds: ['dup-prompt'] })],
        lastModified: 10,
      }),
    ],
  });

  const result = mergeCanvasIntoState(source, 'source', 'target', { now: () => 999 });
  const target = result.state.canvases.find((item) => item.id === 'target');

  assert.deepEqual(result.summary, { movedPrompts: 1, movedImages: 1, deletedSource: true });
  assert.deepEqual(result.state.canvases.map((item) => item.id), ['target']);
  assert.equal(result.state.activeCanvasId, 'target');
  assert.deepEqual(result.state.selectedNodeIds, []);
  assert.deepEqual(target?.promptNodes.map((node) => [node.id, node.position]), [
    ['dup-prompt', { x: 100, y: 5 }],
    ['prompt-1', { x: 710, y: 20 }],
  ]);
  assert.deepEqual(target?.imageNodes.map((node) => [node.id, node.canvasId, node.position]), [
    ['dup-image', 'target', { x: 200, y: 6 }],
    ['image-1', 'target', { x: 715, y: 25 }],
  ]);
  assert.deepEqual(target?.groups.map((item) => [item.id, item.nodeIds]), [
    ['dup-group', ['dup-prompt']],
    ['group-1', ['prompt-1', 'image-1']],
  ]);
  assert.equal(target?.lastModified, 999);
});

test('mergeCanvasIntoState can empty the source canvas instead of deleting it', async () => {
  const { mergeCanvasIntoState } = await loadCanvasMergeIntoModule();
  const source = state({
    activeCanvasId: 'source',
    selectedNodeIds: ['prompt-1'],
    canvases: [
      canvas({
        id: 'source',
        promptNodes: [promptNode({ id: 'prompt-1', position: { x: 1, y: 2 } })],
        imageNodes: [imageNode({ id: 'image-1', canvasId: 'source', position: { x: 3, y: 4 } })],
        groups: [group({ id: 'group-1', nodeIds: ['prompt-1', 'image-1'] })],
      }),
      canvas({ id: 'target' }),
    ],
  });

  const result = mergeCanvasIntoState(source, 'source', 'target', { deleteSource: false, now: () => 111 });
  const emptiedSource = result.state.canvases.find((item) => item.id === 'source');
  const target = result.state.canvases.find((item) => item.id === 'target');

  assert.deepEqual(result.summary, { movedPrompts: 1, movedImages: 1, deletedSource: false });
  assert.equal(result.state.activeCanvasId, 'source');
  assert.deepEqual(emptiedSource?.promptNodes, []);
  assert.deepEqual(emptiedSource?.imageNodes, []);
  assert.deepEqual(emptiedSource?.groups, []);
  assert.equal(emptiedSource?.lastModified, 111);
  assert.deepEqual(target?.promptNodes.map((node) => node.position), [{ x: 1, y: 2 }]);
  assert.deepEqual(target?.imageNodes.map((node) => [node.canvasId, node.position]), [['target', { x: 3, y: 4 }]]);
  assert.equal(target?.lastModified, 111);
  assert.deepEqual(result.state.selectedNodeIds, []);
});

test('mergeCanvasIntoState keeps state unchanged for invalid merge requests', async () => {
  const { mergeCanvasIntoState } = await loadCanvasMergeIntoModule();
  const source = state({
    activeCanvasId: 'source',
    selectedNodeIds: ['prompt-1'],
    canvases: [canvas({ id: 'source' }), canvas({ id: 'target' })],
  });

  const sameCanvas = mergeCanvasIntoState(source, 'source', 'source');
  const missingSource = mergeCanvasIntoState(source, 'missing', 'target');
  const missingTarget = mergeCanvasIntoState(source, 'source', 'missing');

  assert.equal(sameCanvas.state, source);
  assert.equal(missingSource.state, source);
  assert.equal(missingTarget.state, source);
  assert.deepEqual(sameCanvas.summary, { movedPrompts: 0, movedImages: 0, deletedSource: false });
  assert.deepEqual(missingSource.summary, { movedPrompts: 0, movedImages: 0, deletedSource: false });
  assert.deepEqual(missingTarget.summary, { movedPrompts: 0, movedImages: 0, deletedSource: false });
});
