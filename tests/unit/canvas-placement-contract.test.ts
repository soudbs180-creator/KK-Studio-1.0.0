import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  resolveNextCardPosition,
  resolveNextGroupPosition,
  resolveSmartCanvasPosition,
} from '../../apps/web/src/context/canvasPlacement.ts';
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
  width?: number;
  height?: number;
  position?: { x: number; y: number };
}): WorkflowNode {
  return {
    id: input.id,
    kind: input.kind,
    width: input.width,
    height: input.height,
    position: input.position ?? { x: 0, y: 0 },
    data: {},
  } as WorkflowNode;
}

test('canvas placement boundary lives outside CanvasContext', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasPlacement.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-placement-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasPlacement';/);
  assert.match(helperSource, /export function resolveNextCardPosition/);
  assert.match(helperSource, /export function resolveSmartCanvasPosition/);
  assert.match(helperSource, /export function resolveNextGroupPosition/);
  assert.doesNotMatch(contextSource, /const shifts = \[/);
  assert.doesNotMatch(contextSource, /const GROUPS_PER_ROW = 30;/);
});

test('next card position preserves the fixed five-column slot grid', () => {
  const cardCanvas = canvas({
    id: 'cards',
    promptNodes: Array.from({ length: 4 }, (_, index) => ({ id: `prompt-${index}`, prompt: 'x', position: { x: 0, y: 0 } } as never)),
    imageNodes: Array.from({ length: 2 }, (_, index) => ({ id: `image-${index}`, prompt: 'x', url: 'https://cdn.example.com/x.png', position: { x: 0, y: 0 } } as never)),
  });

  assert.deepEqual(resolveNextCardPosition(cardCanvas), { x: 300, y: 340 });
  assert.deepEqual(resolveNextCardPosition(undefined), { x: 0, y: 0 });
});

test('smart canvas position shifts away from prompt and workflow utility collisions', () => {
  const promptCollisionCanvas = canvas({
    id: 'prompt-collision',
    promptNodes: [{ id: 'prompt-1', prompt: 'x', position: { x: 0, y: 0 } } as never],
  });

  assert.deepEqual(resolveSmartCanvasPosition(promptCollisionCanvas, 0, 0, 100, 100, 0), { x: 0, y: 100 });

  const workflowCollisionCanvas = canvas({
    id: 'workflow-collision',
    workflow: {
      version: 1,
      nodes: [workflowNode({ id: 'save-1', kind: 'save', width: 100, height: 100 })],
      edges: [],
    },
  });

  assert.deepEqual(resolveSmartCanvasPosition(workflowCollisionCanvas, 0, 0, 100, 100, 0), { x: 0, y: 100 });
  assert.deepEqual(resolveSmartCanvasPosition(undefined, 10, 20, 100, 100), { x: 10, y: 20 });
});

test('next group position preserves dynamic child-card width accumulation', () => {
  const groupedCanvas = canvas({
    id: 'groups',
    promptNodes: [
      { id: 'prompt-1', prompt: 'one', position: { x: 0, y: 0 } } as never,
      { id: 'prompt-2', prompt: 'two', position: { x: 0, y: 0 } } as never,
    ],
    imageNodes: [
      { id: 'image-1', parentPromptId: 'prompt-2', prompt: 'x', url: 'https://cdn.example.com/1.png', position: { x: 0, y: 0 } } as never,
      { id: 'image-2', parentPromptId: 'prompt-2', prompt: 'x', url: 'https://cdn.example.com/2.png', position: { x: 0, y: 0 } } as never,
      { id: 'image-3', parentPromptId: 'prompt-2', prompt: 'x', url: 'https://cdn.example.com/3.png', position: { x: 0, y: 0 } } as never,
    ],
  });

  assert.deepEqual(resolveNextGroupPosition(undefined), { x: 0, y: 200 });
  assert.deepEqual(resolveNextGroupPosition(canvas({ id: 'empty' })), { x: 0, y: 200 });
  assert.deepEqual(resolveNextGroupPosition(groupedCanvas), { x: 1266, y: 200 });
});
