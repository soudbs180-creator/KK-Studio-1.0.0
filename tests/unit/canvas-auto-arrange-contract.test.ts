import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  AspectRatio,
  ImageSize,
  KnownModel,
  type Canvas,
  type GeneratedImage,
  type PromptNode,
} from '../../src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasAutoArrangeModule = {
  resolveCanvasAutoArrangePositions: (canvas: Canvas) => Record<string, { x: number; y: number }>;
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadCanvasAutoArrangeModule(): Promise<CanvasAutoArrangeModule> {
  const fullPath = path.join(ROOT_DIR, 'src/context/canvasAutoArrange.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasAutoArrange.ts must exist');
  return await import('../../src/context/canvasAutoArrange.ts') as CanvasAutoArrangeModule;
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

test('full canvas auto-arrange position calculation lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasAutoArrange.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-auto-arrange-contract\.test\.ts/);
  assert.match(helperSource, /export function resolveCanvasAutoArrangePositions/);
  assert.match(contextSource, /resolveCanvasAutoArrangePositions\(currentCanvas\)/);
  assert.doesNotMatch(contextSource, /type LayoutGroup =/);
  assert.doesNotMatch(contextSource, /followUpChildrenMap/);
  assert.doesNotMatch(contextSource, /const placeGroup =/);
});

test('resolveCanvasAutoArrangePositions preserves normal, follow-up, orphan, and error layouts', async () => {
  const { resolveCanvasAutoArrangePositions } = await loadCanvasAutoArrangeModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', height: 200, timestamp: 1, childImageIds: ['image-1'] }),
      promptNode({ id: 'prompt-2', height: 200, timestamp: 2, childImageIds: ['image-2'], sourceImageId: 'image-1' }),
      promptNode({ id: 'prompt-3', height: 200, timestamp: 3, error: 'failed', childImageIds: ['image-3'] }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1' }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-2' }),
      imageNode({ id: 'image-3', parentPromptId: 'prompt-3' }),
      imageNode({ id: 'image-4', parentPromptId: '' }),
    ],
  });

  const positions = resolveCanvasAutoArrangePositions(source);

  assert.deepEqual(positions['prompt-1'], { x: -1840, y: 400 });
  assert.deepEqual(positions['image-1'], { x: -1840, y: 776 });
  assert.deepEqual(positions['prompt-2'], { x: -1464, y: 400 });
  assert.deepEqual(positions['image-2'], { x: -1464, y: 776 });
  assert.deepEqual(positions['image-4'], { x: -1484, y: 776 });
  assert.deepEqual(positions['prompt-3'], { x: -1840, y: 1266 });
  assert.deepEqual(positions['image-3'], { x: -1840, y: 1642 });
});
