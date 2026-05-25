import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { AspectRatio, ImageSize, KnownModel, type Canvas, type GeneratedImage, type PromptNode } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasPositionUpdatesModule = {
  updateCanvasPromptNodePosition: (
    canvas: Canvas,
    selectedNodeIds: string[],
    id: string,
    position: { x: number; y: number },
    options?: { moveChildren?: boolean; ignoreSelection?: boolean },
  ) => Canvas;
  updateCanvasImageNodePosition: (
    canvas: Canvas,
    selectedNodeIds: string[],
    id: string,
    position: { x: number; y: number },
    options?: { ignoreSelection?: boolean },
  ) => Canvas;
};



async function loadCanvasPositionUpdatesModule(): Promise<CanvasPositionUpdatesModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/context/canvasPositionUpdates.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasPositionUpdates.ts must exist');
  return await import('../../apps/web/src/context/canvasPositionUpdates.ts') as CanvasPositionUpdatesModule;
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

test('canvas position update boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasPositionUpdates.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-position-updates-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasPositionUpdates';/);
  assert.match(helperSource, /export function updateCanvasPromptNodePosition/);
  assert.match(helperSource, /export function updateCanvasImageNodePosition/);

  const positionWrapperSource = contextSource.slice(
    contextSource.indexOf('const updatePromptNodePosition = useCallback'),
    contextSource.indexOf('const updateImageNodeDimensions = useCallback')
  );
  assert.match(positionWrapperSource, /updateCanvasPromptNodePosition\(canvas, state\.selectedNodeIds \|\| \[\], id, pos, options\)/);
  assert.match(positionWrapperSource, /updateCanvasImageNodePosition\(canvas, state\.selectedNodeIds \|\| \[\], id, pos, options\)/);
  assert.doesNotMatch(positionWrapperSource, /selectedIds\.has/);
  assert.doesNotMatch(positionWrapperSource, /movedPromptIds/);
  assert.doesNotMatch(positionWrapperSource, /parentPromptId === id/);
});

test('updateCanvasPromptNodePosition moves prompt children by default and can suppress child movement', async () => {
  const { updateCanvasPromptNodePosition } = await loadCanvasPositionUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', position: { x: 10, y: 20 } })],
    imageNodes: [
      imageNode({ id: 'child-1', parentPromptId: 'prompt-1', position: { x: 30, y: 40 } }),
      imageNode({ id: 'orphan-1', position: { x: 50, y: 60 } }),
    ],
    lastModified: 123,
  });

  const moved = updateCanvasPromptNodePosition(source, [], 'prompt-1', { x: 15, y: 10 });
  const promptOnly = updateCanvasPromptNodePosition(source, [], 'prompt-1', { x: 15, y: 10 }, { moveChildren: false });

  assert.deepEqual(moved.promptNodes[0].position, { x: 15, y: 10 });
  assert.deepEqual(moved.imageNodes[0].position, { x: 35, y: 30 });
  assert.equal(moved.imageNodes[1], source.imageNodes[1]);
  assert.equal(moved.lastModified, source.lastModified);

  assert.deepEqual(promptOnly.promptNodes[0].position, { x: 15, y: 10 });
  assert.equal(promptOnly.imageNodes, source.imageNodes);
});

test('updateCanvasPromptNodePosition moves selected prompts and selected prompt children as one group', async () => {
  const { updateCanvasPromptNodePosition } = await loadCanvasPositionUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', position: { x: 10, y: 20 } }),
      promptNode({ id: 'prompt-2', position: { x: 100, y: 200 } }),
      promptNode({ id: 'prompt-3', position: { x: 300, y: 400 } }),
    ],
    imageNodes: [
      imageNode({ id: 'child-1', parentPromptId: 'prompt-1', position: { x: 30, y: 40 } }),
      imageNode({ id: 'child-2', parentPromptId: 'prompt-2', position: { x: 120, y: 220 } }),
      imageNode({ id: 'image-3', position: { x: 500, y: 600 } }),
    ],
  });

  const result = updateCanvasPromptNodePosition(source, ['prompt-1', 'prompt-2', 'image-3'], 'prompt-1', { x: 15, y: 10 });

  assert.deepEqual(result.promptNodes.map((node) => [node.id, node.position]), [
    ['prompt-1', { x: 15, y: 10 }],
    ['prompt-2', { x: 105, y: 190 }],
    ['prompt-3', { x: 300, y: 400 }],
  ]);
  assert.deepEqual(result.imageNodes.map((node) => [node.id, node.position]), [
    ['child-1', { x: 35, y: 30 }],
    ['child-2', { x: 125, y: 210 }],
    ['image-3', { x: 505, y: 590 }],
  ]);
});

test('updateCanvasImageNodePosition moves a selected image group or one image with ignoreSelection', async () => {
  const { updateCanvasImageNodePosition } = await loadCanvasPositionUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', position: { x: 10, y: 20 } }),
      promptNode({ id: 'prompt-2', position: { x: 100, y: 200 } }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1', position: { x: 30, y: 40 } }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-2', position: { x: 120, y: 220 } }),
      imageNode({ id: 'image-3', position: { x: 300, y: 400 } }),
    ],
  });

  const grouped = updateCanvasImageNodePosition(source, ['prompt-1', 'image-3'], 'image-3', { x: 305, y: 390 });
  const ignored = updateCanvasImageNodePosition(source, ['prompt-1', 'image-3'], 'image-3', { x: 305, y: 390 }, { ignoreSelection: true });

  assert.deepEqual(grouped.promptNodes.map((node) => [node.id, node.position]), [
    ['prompt-1', { x: 15, y: 10 }],
    ['prompt-2', { x: 100, y: 200 }],
  ]);
  assert.deepEqual(grouped.imageNodes.map((node) => [node.id, node.position]), [
    ['image-1', { x: 35, y: 30 }],
    ['image-2', { x: 120, y: 220 }],
    ['image-3', { x: 305, y: 390 }],
  ]);

  assert.equal(ignored.promptNodes, source.promptNodes);
  assert.deepEqual(ignored.imageNodes.map((node) => [node.id, node.position]), [
    ['image-1', { x: 30, y: 40 }],
    ['image-2', { x: 120, y: 220 }],
    ['image-3', { x: 305, y: 390 }],
  ]);
});

test('position update helpers return the original canvas when the target is missing', async () => {
  const { updateCanvasPromptNodePosition, updateCanvasImageNodePosition } = await loadCanvasPositionUpdatesModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1' })],
    imageNodes: [imageNode({ id: 'image-1' })],
  });

  assert.equal(updateCanvasPromptNodePosition(source, [], 'missing-prompt', { x: 1, y: 2 }), source);
  assert.equal(updateCanvasImageNodePosition(source, [], 'missing-image', { x: 1, y: 2 }), source);
});
