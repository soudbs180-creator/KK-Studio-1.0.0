import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { AspectRatio, ImageSize, KnownModel, type Canvas, type CanvasGroup, type GeneratedImage, type PromptNode } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

type CanvasGroupsModule = {
  addCanvasGroupToCanvas: (canvas: Canvas, group: CanvasGroup) => Canvas;
  removeCanvasGroupFromCanvas: (canvas: Canvas, id: string) => Canvas;
  updateCanvasGroupInCanvas: (canvas: Canvas, group: CanvasGroup) => Canvas;
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadCanvasGroupsModule(): Promise<CanvasGroupsModule> {
  const fullPath = path.join(ROOT_DIR, 'src/context/canvasGroups.ts');
  assert.equal(existsSync(fullPath), true, 'src/context/canvasGroups.ts must exist');
  return await import('../../apps/web/src/context/canvasGroups.ts') as CanvasGroupsModule;
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

test('canvas group management boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasGroups.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-groups-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasGroups';/);
  assert.match(helperSource, /export function addCanvasGroupToCanvas/);
  assert.match(helperSource, /export function removeCanvasGroupFromCanvas/);
  assert.match(helperSource, /export function updateCanvasGroupInCanvas/);

  const groupWrapperSource = contextSource.slice(
    contextSource.indexOf('/** Group Management */'),
    contextSource.indexOf('const setNodeTags = useCallback')
  );
  assert.match(groupWrapperSource, /addCanvasGroupToCanvas\(canvas, group\)/);
  assert.match(groupWrapperSource, /removeCanvasGroupFromCanvas\(canvas, id\)/);
  assert.match(groupWrapperSource, /updateCanvasGroupInCanvas\(canvas, group\)/);
  assert.doesNotMatch(groupWrapperSource, /Math\.max\(/);
  assert.doesNotMatch(groupWrapperSource, /canvas\.promptNodes\.map/);
  assert.doesNotMatch(groupWrapperSource, /canvas\.imageNodes\.map/);
});

test('adding a group assigns the next zIndex from prompts, images, and existing groups only', async () => {
  const { addCanvasGroupToCanvas } = await loadCanvasGroupsModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1', zIndex: 3 })],
    imageNodes: [imageNode({ id: 'image-1', zIndex: 8 })],
    groups: [
      { id: 'group-1', nodeIds: ['prompt-1'], bounds: { x: 0, y: 0, width: 100, height: 100 }, type: 'custom', zIndex: 5 } as CanvasGroup,
    ],
    workflow: {
      version: 1,
      nodes: [{ id: 'save-1', kind: 'save', position: { x: 0, y: 0 }, data: {}, zIndex: 50 } as never],
      edges: [],
    },
  });

  const result = addCanvasGroupToCanvas(source, {
    id: 'group-2',
    nodeIds: ['image-1'],
    bounds: { x: 10, y: 10, width: 120, height: 80 },
    type: 'custom',
  } as CanvasGroup);

  assert.notEqual(result, source);
  assert.deepEqual(result.groups.map((group) => [group.id, group.zIndex]), [
    ['group-1', 5],
    ['group-2', 9],
  ]);
});

test('adding a group preserves an explicit zIndex and appends to missing group arrays', async () => {
  const { addCanvasGroupToCanvas } = await loadCanvasGroupsModule();
  const explicitGroup = {
    id: 'group-explicit',
    nodeIds: ['prompt-1'],
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    type: 'custom',
    zIndex: 0,
  } as CanvasGroup;
  const source = canvas({ id: 'canvas-1', groups: undefined as never });

  const result = addCanvasGroupToCanvas(source, explicitGroup);

  assert.deepEqual(result.groups, [explicitGroup]);
});

test('removing a group drops every matching id without touching unrelated canvas data', async () => {
  const { removeCanvasGroupFromCanvas } = await loadCanvasGroupsModule();
  const source = canvas({
    id: 'canvas-1',
    promptNodes: [promptNode({ id: 'prompt-1' })],
    imageNodes: [imageNode({ id: 'image-1' })],
    groups: [
      { id: 'group-remove', nodeIds: ['prompt-1'], bounds: { x: 0, y: 0, width: 10, height: 10 } } as CanvasGroup,
      { id: 'group-keep', nodeIds: ['image-1'], bounds: { x: 0, y: 0, width: 20, height: 20 } } as CanvasGroup,
      { id: 'group-remove', nodeIds: ['image-1'], bounds: { x: 0, y: 0, width: 30, height: 30 } } as CanvasGroup,
    ],
    drawings: [{ id: 'drawing-1' } as never],
  });

  const result = removeCanvasGroupFromCanvas(source, 'group-remove');

  assert.deepEqual(result.groups.map((group) => group.id), ['group-keep']);
  assert.equal(result.promptNodes, source.promptNodes);
  assert.equal(result.imageNodes, source.imageNodes);
  assert.equal(result.drawings, source.drawings);
});

test('updating a group replaces the whole matching object and does not append missing ids', async () => {
  const { updateCanvasGroupInCanvas } = await loadCanvasGroupsModule();
  const replacement = {
    id: 'group-1',
    nodeIds: ['image-1'],
    bounds: { x: 20, y: 30, width: 40, height: 50 },
    type: 'custom',
  } as CanvasGroup;
  const source = canvas({
    id: 'canvas-1',
    groups: [
      { id: 'group-1', nodeIds: ['prompt-1'], bounds: { x: 0, y: 0, width: 10, height: 10 }, zIndex: 7 } as CanvasGroup,
      { id: 'group-2', nodeIds: ['prompt-2'], bounds: { x: 0, y: 0, width: 10, height: 10 }, zIndex: 8 } as CanvasGroup,
    ],
  });

  const updated = updateCanvasGroupInCanvas(source, replacement);
  const missing = updateCanvasGroupInCanvas(source, { ...replacement, id: 'missing-group' });

  assert.deepEqual(updated.groups, [replacement, source.groups[1]]);
  assert.deepEqual(missing.groups, source.groups);
});
