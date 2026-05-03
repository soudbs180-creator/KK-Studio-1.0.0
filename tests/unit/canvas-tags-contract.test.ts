import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { AspectRatio, ImageSize, KnownModel, type Canvas, type GeneratedImage, type PromptNode } from '../../src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasTagsModule = {
  setCanvasNodeTags: (canvas: Canvas, ids: string[], tags: string[]) => Canvas;
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadCanvasTagsModule(): Promise<CanvasTagsModule> {
  const fullPath = path.join(ROOT_DIR, 'src/context/canvasTags.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasTags.ts must exist');
  return await import('../../src/context/canvasTags.ts') as CanvasTagsModule;
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

test('canvas tags boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasTags.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-tags-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasTags';/);
  assert.match(helperSource, /export function setCanvasNodeTags/);

  const tagsWrapperSource = contextSource.slice(
    contextSource.indexOf('const setNodeTags = useCallback'),
    contextSource.indexOf('// Track viewport-center updates')
  );
  assert.match(tagsWrapperSource, /setCanvasNodeTags\(canvas, ids, tags\)/);
  assert.doesNotMatch(tagsWrapperSource, /promptNodes: canvas\.promptNodes\.map/);
  assert.doesNotMatch(tagsWrapperSource, /imageNodes: canvas\.imageNodes\.map/);
});

test('setCanvasNodeTags replaces tags on matching prompt and image nodes only', async () => {
  const { setCanvasNodeTags } = await loadCanvasTagsModule();
  const tagList = ['featured', 'reviewed'];
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [
      promptNode({ id: 'prompt-1', tags: ['old'] }),
      promptNode({ id: 'prompt-2', tags: ['keep'] }),
    ],
    imageNodes: [
      imageNode({ id: 'image-1', tags: ['old-image'] }),
      imageNode({ id: 'image-2', tags: ['keep-image'] }),
    ],
    groups: [{ id: 'group-1', nodeIds: ['prompt-1'], bounds: { x: 0, y: 0, width: 10, height: 10 } } as never],
    drawings: [{ id: 'drawing-1' } as never],
  });

  const result = setCanvasNodeTags(source, ['prompt-1', 'image-1', 'missing-node'], tagList);

  assert.notEqual(result, source);
  assert.deepEqual(result.promptNodes.map((node) => [node.id, node.tags]), [
    ['prompt-1', tagList],
    ['prompt-2', ['keep']],
  ]);
  assert.deepEqual(result.imageNodes.map((node) => [node.id, node.tags]), [
    ['image-1', tagList],
    ['image-2', ['keep-image']],
  ]);
  assert.equal(result.groups, source.groups);
  assert.equal(result.drawings, source.drawings);
  assert.equal(result.lastModified, source.lastModified);
});

test('setCanvasNodeTags can clear tags and leaves unmatched canvases structurally stable', async () => {
  const { setCanvasNodeTags } = await loadCanvasTagsModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', tags: ['old'] })],
    imageNodes: [imageNode({ id: 'image-1', tags: ['old-image'] })],
  });

  const cleared = setCanvasNodeTags(source, ['prompt-1', 'image-1'], []);
  const unmatched = setCanvasNodeTags(source, ['missing'], ['new']);

  assert.deepEqual(cleared.promptNodes[0].tags, []);
  assert.deepEqual(cleared.imageNodes[0].tags, []);
  assert.deepEqual(unmatched.promptNodes, source.promptNodes);
  assert.deepEqual(unmatched.imageNodes, source.imageNodes);
});
