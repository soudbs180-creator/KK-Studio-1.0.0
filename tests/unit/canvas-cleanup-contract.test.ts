import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { cleanupInvalidCanvasCardsForCanvas } from '../../apps/web/src/context/canvasCleanup.ts';
import type { Canvas, WorkflowNode } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();



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

function workflowNode(input: {
  id: string;
  kind: WorkflowNode['kind'];
  data?: unknown;
}): WorkflowNode {
  return {
    id: input.id,
    kind: input.kind,
    position: { x: 0, y: 0 },
    data: input.data ?? {},
  } as WorkflowNode;
}

test('canvas cleanup boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasCleanup.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-cleanup-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasCleanup';/);
  assert.match(helperSource, /export function cleanupInvalidCanvasCardsForCanvas/);
  assert.doesNotMatch(contextSource, /const promptIdsToRemove = new Set/);
  assert.doesNotMatch(contextSource, /const imageIdsToRemove = new Set/);
});

test('canvas cleanup removes invalid cards and prunes workflow links, groups, and selection', () => {
  const sourceCanvas = canvas({
    id: 'canvas-1',
    promptNodes: [
      { id: 'prompt-ok', prompt: 'ok', position: { x: 0, y: 0 }, childImageIds: ['image-ok', 'image-empty'] } as never,
      { id: 'prompt-error', prompt: 'bad', position: { x: 10, y: 0 }, error: 'failed' } as never,
    ],
    imageNodes: [
      { id: 'image-ok', parentPromptId: 'prompt-ok', prompt: 'ok', url: 'https://cdn.example.com/ok.png', position: { x: 0, y: 0 } } as never,
      { id: 'image-empty', parentPromptId: 'prompt-ok', prompt: 'empty', position: { x: 5, y: 0 } } as never,
      { id: 'image-error', prompt: 'error', error: 'failed', position: { x: 10, y: 0 } } as never,
      { id: 'image-broken-parent', parentPromptId: 'missing-prompt', prompt: 'bad parent', url: 'https://cdn.example.com/bad.png', position: { x: 15, y: 0 } } as never,
    ],
    groups: [
      { id: 'group-keep', nodeIds: ['prompt-ok', 'save-1'], bounds: { x: 0, y: 0, width: 100, height: 100 } } as never,
      { id: 'group-drop', nodeIds: ['image-empty', 'missing-node'], bounds: { x: 0, y: 0, width: 100, height: 100 } } as never,
    ],
    workflow: {
      version: 1,
      nodes: [
        workflowNode({ id: 'prompt-ok', kind: 'prompt' }),
        workflowNode({ id: 'image-ok', kind: 'image' }),
        workflowNode({ id: 'save-1', kind: 'save', data: { sourceNodeIds: ['image-ok', 'image-empty', 'missing-node'], outputNodeIds: ['image-ok', 'image-error'] } }),
      ],
      edges: [
        { id: 'edge:prompt-ok:result:image-ok:0', from: 'prompt-ok', to: 'image-ok', role: 'result' },
        { id: 'edge:prompt-ok:result:image-empty:1', from: 'prompt-ok', to: 'image-empty', role: 'result' },
        { id: 'edge:image-empty:control:save-1', from: 'image-empty', to: 'save-1', role: 'control' },
        { id: 'edge:image-ok:control:save-1', from: 'image-ok', to: 'save-1', role: 'control' },
      ],
    },
  });

  const result = cleanupInvalidCanvasCardsForCanvas({
    canvas: sourceCanvas,
    selectedNodeIds: ['prompt-ok', 'image-empty', 'save-1', 'missing-node'],
    now: () => 12345,
    toWorkflow: (value) => value.workflow!,
    syncCompatibility: (value) => value,
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.summary, { removedPrompts: 1, removedImages: 3, removedGroups: 1 });
  assert.deepEqual(result.canvas.promptNodes.map((node) => node.id), ['prompt-ok']);
  assert.deepEqual(result.canvas.promptNodes[0].childImageIds, ['image-ok']);
  assert.deepEqual(result.canvas.imageNodes.map((node) => node.id), ['image-ok']);
  assert.deepEqual(result.canvas.groups.map((group) => group.id), ['group-keep']);
  assert.deepEqual(result.selectedNodeIds, ['prompt-ok', 'save-1']);
  assert.equal(result.canvas.lastModified, 12345);

  const saveNode = result.canvas.workflow?.nodes.find((node) => node.id === 'save-1');
  assert.deepEqual((saveNode?.data as { sourceNodeIds?: string[] }).sourceNodeIds, ['image-ok']);
  assert.deepEqual((saveNode?.data as { outputNodeIds?: string[] }).outputNodeIds, ['image-ok']);
  assert.deepEqual(result.canvas.workflow?.edges.map((edge) => edge.id), [
    'edge:prompt-ok:result:image-ok:0',
    'edge:image-ok:control:save-1',
  ]);
});

test('canvas cleanup leaves clean canvases unchanged', () => {
  const cleanCanvas = canvas({
    id: 'clean',
    promptNodes: [{ id: 'prompt-ok', prompt: 'ok', position: { x: 0, y: 0 } } as never],
  });

  const result = cleanupInvalidCanvasCardsForCanvas({
    canvas: cleanCanvas,
    selectedNodeIds: ['prompt-ok'],
    now: () => 999,
    toWorkflow: () => ({ version: 1, nodes: [workflowNode({ id: 'prompt-ok', kind: 'prompt' })], edges: [] }),
    syncCompatibility: (value) => ({ ...value, name: 'should-not-apply' }),
  });

  assert.equal(result.changed, false);
  assert.equal(result.canvas, cleanCanvas);
  assert.deepEqual(result.summary, { removedPrompts: 0, removedImages: 0, removedGroups: 0 });
  assert.deepEqual(result.selectedNodeIds, ['prompt-ok']);
});
