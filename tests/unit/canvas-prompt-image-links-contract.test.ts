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
  type GeneratedImage,
  type PromptNode,
} from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasPromptImageLinksModule = {
  deleteCanvasImageNode: (canvas: Canvas, id: string) => Canvas;
  deleteCanvasPromptNode: (canvas: Canvas, id: string) => Canvas;
  linkCanvasPromptToImage: (canvas: Canvas, promptId: string, imageId: string) => Canvas;
  unlinkCanvasPromptFromImage: (canvas: Canvas, promptId: string, imageId: string) => Canvas;
};



async function loadPromptImageLinksModule(): Promise<CanvasPromptImageLinksModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/context/canvasPromptImageLinks.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasPromptImageLinks.ts must exist');
  return await import('../../apps/web/src/context/canvasPromptImageLinks.ts') as CanvasPromptImageLinksModule;
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

test('canvas prompt-image link boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasPromptImageLinks.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-prompt-image-links-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasPromptImageLinks';/);
  assert.match(helperSource, /export function deleteCanvasImageNode/);
  assert.match(helperSource, /export function deleteCanvasPromptNode/);
  assert.match(helperSource, /export function linkCanvasPromptToImage/);
  assert.match(helperSource, /export function unlinkCanvasPromptFromImage/);

  const imageDeleteWrapperSource = contextSource.slice(
    contextSource.indexOf('const deleteImageNode = useCallback'),
    contextSource.indexOf('const deletePromptNode = useCallback')
  );
  const relationshipWrapperSource = contextSource.slice(
    contextSource.indexOf('const deletePromptNode = useCallback'),
    contextSource.indexOf('const undo = useCallback')
  );
  assert.match(imageDeleteWrapperSource, /deleteCanvasImageNode\(c, id\)/);
  assert.doesNotMatch(imageDeleteWrapperSource, /imageNodes:\s*c\.imageNodes\.filter/);
  assert.doesNotMatch(imageDeleteWrapperSource, /childImageIds:\s*p\.childImageIds\.filter/);
  assert.doesNotMatch(imageDeleteWrapperSource, /sourceImageId:\s*p\.sourceImageId === id/);
  assert.match(relationshipWrapperSource, /deleteCanvasPromptNode\(canvas, id\)/);
  assert.match(relationshipWrapperSource, /linkCanvasPromptToImage\(canvas, promptId, imageId\)/);
  assert.match(relationshipWrapperSource, /unlinkCanvasPromptFromImage\(canvas, promptId, imageId\)/);
  assert.doesNotMatch(relationshipWrapperSource, /parentPromptId === id/);
  assert.doesNotMatch(relationshipWrapperSource, /childImageIds\.includes/);
  assert.doesNotMatch(relationshipWrapperSource, /childImageIds\.filter/);
});

test('deleteCanvasImageNode removes image references without changing persistence metadata', async () => {
  const { deleteCanvasImageNode } = await loadPromptImageLinksModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', childImageIds: ['image-1', 'image-2'], sourceImageId: 'image-1' }),
      promptNode({ id: 'prompt-2', childImageIds: ['image-3'], sourceImageId: 'image-2' }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1' }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-1' }),
      imageNode({ id: 'image-3', parentPromptId: 'prompt-2' }),
    ],
    drawings: [{ id: 'drawing-1', type: 'pen', points: [], color: '#000', width: 1 }],
    lastModified: 123,
  });

  const result = deleteCanvasImageNode(source, 'image-1');

  assert.deepEqual(result.imageNodes.map((node) => node.id), ['image-2', 'image-3']);
  assert.deepEqual(result.promptNodes.map((node) => [node.id, node.childImageIds, node.sourceImageId]), [
    ['prompt-1', ['image-2'], undefined],
    ['prompt-2', ['image-3'], 'image-2'],
  ]);
  assert.equal(result.drawings, source.drawings);
  assert.equal(result.lastModified, source.lastModified);
});

test('deleteCanvasPromptNode removes the prompt and orphans child images without deleting images', async () => {
  const { deleteCanvasPromptNode } = await loadPromptImageLinksModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', childImageIds: ['image-1'] }),
      promptNode({ id: 'prompt-2', childImageIds: ['image-2'] }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1' }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-2' }),
      imageNode({ id: 'image-3', parentPromptId: '' }),
    ],
    lastModified: 123,
  });

  const result = deleteCanvasPromptNode(source, 'prompt-1');

  assert.deepEqual(result.promptNodes.map((node) => node.id), ['prompt-2']);
  assert.deepEqual(result.imageNodes.map((node) => [node.id, node.parentPromptId]), [
    ['image-1', ''],
    ['image-2', 'prompt-2'],
    ['image-3', ''],
  ]);
  assert.equal(result.lastModified, source.lastModified);
});

test('linkCanvasPromptToImage appends child id and updates the image parent when present', async () => {
  const { linkCanvasPromptToImage } = await loadPromptImageLinksModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', childImageIds: ['image-0'] })],
    imageNodes: [imageNode({ id: 'image-1', parentPromptId: '' })],
    lastModified: 123,
  });

  const result = linkCanvasPromptToImage(source, 'prompt-1', 'image-1');
  const missingImage = linkCanvasPromptToImage(source, 'prompt-1', 'missing-image');
  const duplicate = linkCanvasPromptToImage(result, 'prompt-1', 'image-1');
  const missingPrompt = linkCanvasPromptToImage(source, 'missing-prompt', 'image-1');

  assert.deepEqual(result.promptNodes[0].childImageIds, ['image-0', 'image-1']);
  assert.equal(result.imageNodes[0].parentPromptId, 'prompt-1');
  assert.equal(result.lastModified, source.lastModified);
  assert.deepEqual(missingImage.promptNodes[0].childImageIds, ['image-0', 'missing-image']);
  assert.deepEqual(missingImage.imageNodes.map((node) => [node.id, node.parentPromptId]), [['image-1', '']]);
  assert.equal(duplicate, result);
  assert.equal(missingPrompt, source);
});

test('unlinkCanvasPromptFromImage removes the child id and can orphan the image without a prompt match', async () => {
  const { unlinkCanvasPromptFromImage } = await loadPromptImageLinksModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', childImageIds: ['image-1', 'image-2'] })],
    imageNodes: [
      imageNode({ id: 'image-1', parentPromptId: 'prompt-1' }),
      imageNode({ id: 'image-2', parentPromptId: 'prompt-1' }),
    ],
    lastModified: 123,
  });

  const result = unlinkCanvasPromptFromImage(source, 'prompt-1', 'image-1');
  const missingPrompt = unlinkCanvasPromptFromImage(source, 'missing-prompt', 'image-2');

  assert.deepEqual(result.promptNodes[0].childImageIds, ['image-2']);
  assert.deepEqual(result.imageNodes.map((node) => [node.id, node.parentPromptId]), [
    ['image-1', ''],
    ['image-2', 'prompt-1'],
  ]);
  assert.equal(result.lastModified, source.lastModified);
  assert.deepEqual(missingPrompt.promptNodes[0].childImageIds, ['image-1', 'image-2']);
  assert.equal(missingPrompt.imageNodes.find((node) => node.id === 'image-2')?.parentPromptId, '');
});
