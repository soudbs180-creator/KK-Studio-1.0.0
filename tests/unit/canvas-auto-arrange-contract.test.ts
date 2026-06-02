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
const MAIN_SHEET = '\u4e3b\u56fe';

type CanvasAutoArrangeModule = {
  resolveCanvasAutoArrangePositions: (canvas: Canvas) => Record<string, { x: number; y: number }>;
};



async function loadCanvasAutoArrangeModule(): Promise<CanvasAutoArrangeModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/context/canvasAutoArrange.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/context/canvasAutoArrange.ts must exist');
  return await import('../../apps/web/src/context/canvasAutoArrange.ts') as CanvasAutoArrangeModule;
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
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasAutoArrange.ts');
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
  assert.deepEqual(positions['image-1'], { x: -1840, y: 819 });
  assert.deepEqual(positions['prompt-2'], { x: -1128, y: 400 });
  assert.deepEqual(positions['image-2'], { x: -1128, y: 819 });
  assert.deepEqual(positions['image-4'], { x: -1484, y: 819 });
  assert.deepEqual(positions['prompt-3'], { x: -1840, y: 1259 });
  assert.deepEqual(positions['image-3'], { x: -1840, y: 1678 });
});

test('resolveCanvasAutoArrangePositions places ecommerce framework workbench to the right of its card groups', async () => {
  const { resolveCanvasAutoArrangePositions } = await loadCanvasAutoArrangeModule();
  const framework = promptNode({
    id: 'framework-1',
    height: 560,
    mode: GenerationMode.ECOMMERCE,
    ecommerce: {
      kind: 'framework',
      sourceSheet: MAIN_SHEET,
      sourceRowKey: 'framework-root',
      displayLabel: 'Framework',
      frameworkMeta: {
        activeSheet: MAIN_SHEET,
        groupIds: {
          [MAIN_SHEET]: 'main-group',
          'A+': 'aplus-group',
        },
        taskNodeIds: ['main-task', 'aplus-task'],
      },
    },
  });
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      framework,
      promptNode({
        id: 'unrelated-root',
        height: 200,
        childImageIds: ['unrelated-image'],
      }),
      promptNode({
        id: 'main-task',
        mode: GenerationMode.ECOMMERCE,
        hiddenInCanvas: true,
        height: 200,
        childImageIds: ['main-image'],
        ecommerce: {
          kind: 'main-image',
          sourceSheet: MAIN_SHEET,
          sourceRowKey: 'main-1',
          frameworkId: framework.id,
          parentNodeId: 'main-group',
          groupId: 'main-group',
        },
      }),
      promptNode({
        id: 'aplus-task',
        mode: GenerationMode.ECOMMERCE,
        hiddenInCanvas: true,
        height: 200,
        childImageIds: ['aplus-image'],
        ecommerce: {
          kind: 'a-plus-module',
          sourceSheet: 'A+',
          sourceRowKey: 'aplus-1',
          frameworkId: framework.id,
          parentNodeId: 'aplus-group',
          groupId: 'aplus-group',
        },
      }),
      promptNode({
        id: 'main-group',
        mode: GenerationMode.ECOMMERCE,
        hiddenInCanvas: true,
        height: 200,
        ecommerce: {
          kind: 'a-plus-group',
          sourceSheet: MAIN_SHEET,
          sourceRowKey: 'main-group',
          frameworkId: framework.id,
          parentNodeId: framework.id,
        },
      }),
      promptNode({
        id: 'aplus-group',
        mode: GenerationMode.ECOMMERCE,
        hiddenInCanvas: true,
        height: 200,
        ecommerce: {
          kind: 'a-plus-group',
          sourceSheet: 'A+',
          sourceRowKey: 'aplus-group',
          frameworkId: framework.id,
          parentNodeId: framework.id,
        },
      }),
    ],
    imageNodes: [
      imageNode({ id: 'unrelated-image', parentPromptId: 'unrelated-root' }),
      imageNode({ id: 'main-image', parentPromptId: 'main-task' }),
      imageNode({ id: 'aplus-image', parentPromptId: 'aplus-task' }),
    ],
  });

  const positions = resolveCanvasAutoArrangePositions(source);

  assert.ok(positions['aplus-group'].x > positions['main-group'].x);
  assert.ok(positions['framework-1'].x < positions['aplus-group'].x);
  assert.ok(positions['framework-1'].x < positions['aplus-task'].x);
});

test('resolveCanvasAutoArrangePositions keeps framework cohorts ordered when unrelated roots are interleaved', async () => {
  const { resolveCanvasAutoArrangePositions } = await loadCanvasAutoArrangeModule();
  const framework = promptNode({
    id: 'framework-2',
    height: 560,
    mode: GenerationMode.ECOMMERCE,
    ecommerce: {
      kind: 'framework',
      sourceSheet: MAIN_SHEET,
      sourceRowKey: 'framework-root',
      displayLabel: 'Framework',
    },
  });
  const source = canvas({
    id: 'canvas-2',
    promptNodes: [
      framework,
      promptNode({
        id: 'unrelated-root-2',
        height: 200,
      }),
      promptNode({
        id: 'main-group-2',
        mode: GenerationMode.ECOMMERCE,
        hiddenInCanvas: true,
        height: 200,
        ecommerce: {
          kind: 'a-plus-group',
          sourceSheet: MAIN_SHEET,
          sourceRowKey: 'main-group',
          frameworkId: framework.id,
          parentNodeId: framework.id,
        },
      }),
      promptNode({
        id: 'aplus-group-2',
        mode: GenerationMode.ECOMMERCE,
        hiddenInCanvas: true,
        height: 200,
        ecommerce: {
          kind: 'a-plus-group',
          sourceSheet: 'A+',
          sourceRowKey: 'aplus-group',
          frameworkId: framework.id,
          parentNodeId: framework.id,
        },
      }),
    ],
    imageNodes: [],
  });

  const positions = resolveCanvasAutoArrangePositions(source);

  assert.ok(positions['aplus-group-2'].x > positions['main-group-2'].x);
  assert.ok(positions['framework-2'].x < positions['aplus-group-2'].x);
});
