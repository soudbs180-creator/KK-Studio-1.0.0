import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { AspectRatio, ImageSize, KnownModel, type Canvas, type GeneratedImage, type PromptNode, type WorkflowNode } from '../../src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasMovementModule = {
  moveSelectedCanvasNodes: (input: {
    canvas: Canvas;
    selectedNodeIds: string[];
    delta: { x: number; y: number };
    sourceNodeIdOrIds?: string | string[];
    snapToGrid?: boolean;
  }) => Canvas;
  resolveMoveSelectedCanvasNodeIds: (selectedNodeIds: string[], sourceNodeIdOrIds?: string | string[]) => string[];
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadCanvasMovementModule(): Promise<CanvasMovementModule> {
  const fullPath = path.join(ROOT_DIR, 'src/context/canvasMovement.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasMovement.ts must exist');
  return await import('../../src/context/canvasMovement.ts') as CanvasMovementModule;
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

function workflowNode(input: Partial<WorkflowNode> & Pick<WorkflowNode, 'id' | 'kind'>): WorkflowNode {
  return {
    id: input.id,
    kind: input.kind,
    position: input.position ?? { x: 0, y: 0 },
    data: input.data ?? {},
    ...input,
  } as WorkflowNode;
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

test('canvas movement boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasMovement.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-movement-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasMovement';/);
  assert.match(helperSource, /export function moveSelectedCanvasNodes/);
  assert.match(helperSource, /export function resolveMoveSelectedCanvasNodeIds/);

  const movementWrapperSource = contextSource.slice(
    contextSource.indexOf('const applyMoveSelectedNodes = useCallback'),
    contextSource.indexOf('const pendingMoveDeltaRef = useRef')
  );
  const batchingWrapperSource = contextSource.slice(
    contextSource.indexOf('const pendingMoveDeltaRef = useRef'),
    contextSource.indexOf('const getNextCardPosition = useCallback')
  );
  assert.match(movementWrapperSource, /moveSelectedCanvasNodes\(\{/);
  assert.doesNotMatch(movementWrapperSource, /const selectedSet = new Set/);
  assert.doesNotMatch(movementWrapperSource, /movedPromptIds/);
  assert.doesNotMatch(movementWrapperSource, /userMoved: selectedSet/);
  assert.match(batchingWrapperSource, /const pendingMoveDeltaRef = useRef/);
  assert.match(batchingWrapperSource, /const pendingMoveSourceRef = useRef/);
  assert.match(batchingWrapperSource, /const moveRafRef = useRef/);
  assert.match(batchingWrapperSource, /const batchedSource = sourceNodeIdOrIds \?\? pendingMoveSourceRef\.current/);
  assert.match(batchingWrapperSource, /if \(batchedDelta\.x !== 0 \|\| batchedDelta\.y !== 0\)/);
});

test('resolveMoveSelectedCanvasNodeIds preserves source override semantics', async () => {
  const { resolveMoveSelectedCanvasNodeIds } = await loadCanvasMovementModule();

  assert.deepEqual(resolveMoveSelectedCanvasNodeIds(['prompt-1', 'image-1'], undefined), ['prompt-1', 'image-1']);
  assert.deepEqual(resolveMoveSelectedCanvasNodeIds(['prompt-1', 'image-1'], 'prompt-1'), ['prompt-1', 'image-1']);
  assert.deepEqual(resolveMoveSelectedCanvasNodeIds(['prompt-1', 'image-1'], 'image-2'), ['image-2']);
  assert.deepEqual(resolveMoveSelectedCanvasNodeIds(['prompt-1'], ['image-1', 'save-1']), ['image-1', 'save-1']);
  assert.deepEqual(resolveMoveSelectedCanvasNodeIds(['prompt-1'], []), ['prompt-1']);
});

test('moving selected prompt nodes moves their child images without forcing child manual overrides', async () => {
  const { moveSelectedCanvasNodes } = await loadCanvasMovementModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', childImageIds: ['image-listed'], position: { x: 10, y: 20 } }),
      promptNode({ id: 'prompt-other', position: { x: 100, y: 200 } }),
    ],
    imageNodes: [
      imageNode({ id: 'image-listed', parentPromptId: 'prompt-1', position: { x: 15, y: 25 }, userMoved: false }),
      imageNode({ id: 'image-parent', parentPromptId: 'prompt-1', position: { x: 20, y: 30 }, userMoved: true }),
      imageNode({ id: 'image-other', parentPromptId: 'prompt-other', position: { x: 110, y: 210 } }),
    ],
  });

  const result = moveSelectedCanvasNodes({
    canvas: source,
    selectedNodeIds: ['prompt-1'],
    delta: { x: 5, y: -10 },
  });

  assert.deepEqual(result.promptNodes.find((node) => node.id === 'prompt-1')?.position, { x: 15, y: 10 });
  assert.equal(result.promptNodes.find((node) => node.id === 'prompt-1')?.userMoved, true);
  assert.deepEqual(result.imageNodes.find((node) => node.id === 'image-listed')?.position, { x: 20, y: 15 });
  assert.equal(result.imageNodes.find((node) => node.id === 'image-listed')?.userMoved, false);
  assert.deepEqual(result.imageNodes.find((node) => node.id === 'image-parent')?.position, { x: 25, y: 20 });
  assert.equal(result.imageNodes.find((node) => node.id === 'image-parent')?.userMoved, true);
  assert.deepEqual(result.promptNodes.find((node) => node.id === 'prompt-other')?.position, { x: 100, y: 200 });
  assert.deepEqual(result.imageNodes.find((node) => node.id === 'image-other')?.position, { x: 110, y: 210 });
  assert.equal(result.lastModified, source.lastModified);
});

test('moving selected image nodes marks direct image drags as manual overrides', async () => {
  const { moveSelectedCanvasNodes } = await loadCanvasMovementModule();
  const source = canvas({
    id: 'canvas-1',
    imageNodes: [
      imageNode({ id: 'image-1', position: { x: 0, y: 0 }, userMoved: false }),
      imageNode({ id: 'image-2', position: { x: 20, y: 20 }, userMoved: false }),
    ],
  });

  const result = moveSelectedCanvasNodes({
    canvas: source,
    selectedNodeIds: ['image-1', 'image-2'],
    delta: { x: -5, y: 8 },
    sourceNodeIdOrIds: 'image-1',
  });

  assert.deepEqual(result.imageNodes.find((node) => node.id === 'image-1')?.position, { x: -5, y: 8 });
  assert.equal(result.imageNodes.find((node) => node.id === 'image-1')?.userMoved, true);
  assert.deepEqual(result.imageNodes.find((node) => node.id === 'image-2')?.position, { x: 15, y: 28 });
  assert.equal(result.imageNodes.find((node) => node.id === 'image-2')?.userMoved, true);
});

test('unselected source strings move only the source node', async () => {
  const { moveSelectedCanvasNodes } = await loadCanvasMovementModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', position: { x: 0, y: 0 } })],
    imageNodes: [imageNode({ id: 'image-1', position: { x: 50, y: 50 } })],
  });

  const result = moveSelectedCanvasNodes({
    canvas: source,
    selectedNodeIds: ['prompt-1'],
    sourceNodeIdOrIds: 'image-1',
    delta: { x: 10, y: 10 },
  });

  assert.deepEqual(result.promptNodes[0].position, { x: 0, y: 0 });
  assert.deepEqual(result.imageNodes[0].position, { x: 60, y: 60 });
  assert.equal(result.imageNodes[0].userMoved, true);
});

test('movement only moves selected workflow utility nodes', async () => {
  const { moveSelectedCanvasNodes } = await loadCanvasMovementModule();
  const source = canvas({
    id: 'canvas-1',
    workflow: {
      version: 1,
      nodes: [
        workflowNode({ id: 'save-1', kind: 'save', position: { x: 10, y: 10 } }),
        workflowNode({ id: 'preview-1', kind: 'preview', position: { x: 20, y: 20 } }),
        workflowNode({ id: 'video-1', kind: 'video-input', position: { x: 30, y: 30 } }),
        workflowNode({ id: 'prompt-workflow', kind: 'prompt', position: { x: 40, y: 40 } }),
      ],
      edges: [],
    },
  });

  const result = moveSelectedCanvasNodes({
    canvas: source,
    selectedNodeIds: ['save-1', 'preview-1', 'video-1', 'prompt-workflow'],
    delta: { x: 2, y: 3 },
  });

  assert.deepEqual(result.workflow?.nodes.find((node) => node.id === 'save-1')?.position, { x: 12, y: 13 });
  assert.deepEqual(result.workflow?.nodes.find((node) => node.id === 'preview-1')?.position, { x: 22, y: 23 });
  assert.deepEqual(result.workflow?.nodes.find((node) => node.id === 'video-1')?.position, { x: 30, y: 30 });
  assert.deepEqual(result.workflow?.nodes.find((node) => node.id === 'prompt-workflow')?.position, { x: 40, y: 40 });
});

test('snap-enabled movement snaps every moved selected node to the canvas grid', async () => {
  const { moveSelectedCanvasNodes } = await loadCanvasMovementModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', position: { x: 3, y: 7 } }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', position: { x: 23, y: 41 }, userMoved: false }),
    ],
    workflow: {
      version: 1,
      nodes: [
        workflowNode({ id: 'save-1', kind: 'save', position: { x: 9, y: 25 } }),
      ],
      edges: [],
    },
  });

  const result = moveSelectedCanvasNodes({
    canvas: source,
    selectedNodeIds: ['prompt-1', 'image-1', 'save-1'],
    delta: { x: 10, y: 10 },
    snapToGrid: true,
  });

  assert.deepEqual(result.promptNodes.find((node) => node.id === 'prompt-1')?.position, { x: 16, y: 16 });
  assert.deepEqual(result.imageNodes.find((node) => node.id === 'image-1')?.position, { x: 32, y: 48 });
  assert.equal(result.imageNodes.find((node) => node.id === 'image-1')?.userMoved, true);
  assert.deepEqual(result.workflow?.nodes.find((node) => node.id === 'save-1')?.position, { x: 16, y: 32 });
});

test('movement with no effective selected ids is a no-op', async () => {
  const { moveSelectedCanvasNodes } = await loadCanvasMovementModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', position: { x: 0, y: 0 } })],
  });

  assert.equal(moveSelectedCanvasNodes({
    canvas: source,
    selectedNodeIds: [],
    delta: { x: 5, y: 5 },
  }), source);
});
