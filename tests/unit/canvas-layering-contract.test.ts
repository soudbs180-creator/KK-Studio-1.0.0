import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { bringCanvasNodesToFront } from '../../src/context/canvasLayering.ts';
import { AspectRatio, ImageSize, KnownModel, type Canvas, type CanvasGroup, type GeneratedImage, type PromptNode, type WorkflowNode } from '../../src/types.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
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

test('canvas layering boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasLayering.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-layering-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasLayering';/);
  assert.match(helperSource, /export function bringCanvasNodesToFront/);

  const layeringWrapperSource = contextSource.slice(
    contextSource.indexOf('// [Layering] Bring nodes to front'),
    contextSource.indexOf('// Layering is now driven by view-only group tiers')
  );
  assert.match(layeringWrapperSource, /bringCanvasNodesToFront\(currentCanvas, nodeIds\)/);
  assert.doesNotMatch(layeringWrapperSource, /const promptById = new Map/);
  assert.doesNotMatch(layeringWrapperSource, /const nextZIndexById = new Map/);
});

test('bringing a prompt to front promotes the prompt group and linked canvas group together', () => {
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', childImageIds: ['image-listed'], zIndex: 1 }),
      promptNode({ id: 'prompt-other', zIndex: 4 }),
    ],
    imageNodes: [
      imageNode({ id: 'image-listed', parentPromptId: 'prompt-1', zIndex: 2 }),
      imageNode({ id: 'image-parent', parentPromptId: 'prompt-1', zIndex: 3 }),
      imageNode({ id: 'image-other', parentPromptId: 'prompt-other', zIndex: 5 }),
    ],
    groups: [
      { id: 'group-1', nodeIds: ['prompt-1', 'save-1'], bounds: { x: 0, y: 0, width: 100, height: 100 }, type: 'custom', zIndex: 10 } as CanvasGroup,
      { id: 'group-other', nodeIds: ['prompt-other'], bounds: { x: 0, y: 0, width: 100, height: 100 }, type: 'custom', zIndex: 11 } as CanvasGroup,
    ],
    workflow: {
      version: 1,
      nodes: [
        workflowNode({ id: 'save-1', kind: 'save', zIndex: 20 }),
        workflowNode({ id: 'preview-other', kind: 'preview', zIndex: 30 }),
      ],
      edges: [],
    },
  });

  const result = bringCanvasNodesToFront(source, ['prompt-1']);

  assert.equal(result.promptNodes.find((node) => node.id === 'prompt-1')?.zIndex, 31);
  assert.equal(result.imageNodes.find((node) => node.id === 'image-listed')?.zIndex, 31);
  assert.equal(result.imageNodes.find((node) => node.id === 'image-parent')?.zIndex, 31);
  assert.equal(result.workflow?.nodes.find((node) => node.id === 'save-1')?.zIndex, 32);
  assert.equal(result.groups.find((group) => group.id === 'group-1')?.zIndex, 33);

  assert.equal(result.promptNodes.find((node) => node.id === 'prompt-other')?.zIndex, 4);
  assert.equal(result.imageNodes.find((node) => node.id === 'image-other')?.zIndex, 5);
  assert.equal(result.workflow?.nodes.find((node) => node.id === 'preview-other')?.zIndex, 30);
  assert.equal(result.groups.find((group) => group.id === 'group-other')?.zIndex, 11);
});

test('bringing a child image to front promotes its parent prompt group', () => {
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', childImageIds: ['image-listed'], zIndex: 1 }),
    ],
    imageNodes: [
      imageNode({ id: 'image-listed', parentPromptId: 'prompt-1', zIndex: 2 }),
      imageNode({ id: 'image-parent', parentPromptId: 'prompt-1', zIndex: 3 }),
    ],
  });

  const result = bringCanvasNodesToFront(source, ['image-parent']);

  assert.equal(result.promptNodes[0].zIndex, 4);
  assert.equal(result.imageNodes.find((node) => node.id === 'image-listed')?.zIndex, 4);
  assert.equal(result.imageNodes.find((node) => node.id === 'image-parent')?.zIndex, 4);
});

test('layering preserves multi-id order and standalone image promotion', () => {
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', childImageIds: ['image-1'], zIndex: 1 }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1', zIndex: 2 }),
      imageNode({ id: 'standalone-image', parentPromptId: '', zIndex: 3 }),
    ],
    workflow: {
      version: 1,
      nodes: [
        workflowNode({ id: 'save-1', kind: 'save', zIndex: 4 }),
        workflowNode({ id: 'video-high-risk', kind: 'video-input', zIndex: 5 }),
      ],
      edges: [],
    },
  });

  const result = bringCanvasNodesToFront(source, ['standalone-image', 'prompt-1', 'save-1', 'video-high-risk']);

  assert.equal(result.imageNodes.find((node) => node.id === 'standalone-image')?.zIndex, 6);
  assert.equal(result.promptNodes.find((node) => node.id === 'prompt-1')?.zIndex, 7);
  assert.equal(result.imageNodes.find((node) => node.id === 'image-1')?.zIndex, 7);
  assert.equal(result.workflow?.nodes.find((node) => node.id === 'save-1')?.zIndex, 8);
  assert.equal(result.workflow?.nodes.find((node) => node.id === 'video-high-risk')?.zIndex, 9);
});

test('empty layering requests are a no-op', () => {
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', zIndex: 1 }),
    ],
  });

  assert.equal(bringCanvasNodesToFront(source, []), source);
});
