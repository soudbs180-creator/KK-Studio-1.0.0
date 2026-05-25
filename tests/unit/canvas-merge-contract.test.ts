import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  getCanvasCardCount,
  isCanvasEffectivelyEmpty,
  mergeCanvases,
  mergeSingleCanvas,
  resolvePreferredActiveCanvasId,
} from '../../apps/web/src/context/canvasMerge.ts';
import type { Canvas } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
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

test('canvas merge boundary lives outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const helperSource = readSource('src/context/canvasMerge.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-merge-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasMerge';/);
  assert.match(helperSource, /export const mergeCanvases/);
  assert.match(helperSource, /export const resolvePreferredActiveCanvasId/);
  assert.doesNotMatch(contextSource, /const mergeSingleCanvas =/);
  assert.doesNotMatch(contextSource, /const mergeCanvases =/);
  assert.doesNotMatch(contextSource, /const resolvePreferredActiveCanvasId =/);
});

test('canvas merge counts cards and prefers non-empty snapshots', () => {
  const normalizeCalls: string[] = [];
  const normalize = (value: Canvas): Canvas => {
    normalizeCalls.push(value.id);
    return { ...value, name: `${value.name}:normalized` };
  };
  const localEmpty = canvas({ id: 'canvas-1', name: 'local', lastModified: 10 });
  const diskWithCards = canvas({
    id: 'canvas-1',
    name: 'disk',
    lastModified: 5,
    promptNodes: [{ id: 'prompt-1', prompt: 'x', position: { x: 0, y: 0 } } as never],
  });

  assert.equal(getCanvasCardCount(diskWithCards), 1);
  assert.equal(isCanvasEffectivelyEmpty(localEmpty), true);

  const merged = mergeSingleCanvas(localEmpty, diskWithCards, normalize);

  assert.equal(merged.name, 'disk:normalized');
  assert.deepEqual(merged.promptNodes.map((node) => node.id), ['prompt-1']);
  assert.equal(merged.lastModified, 10);
  assert.deepEqual(normalizeCalls, ['canvas-1']);
});

test('canvas merge combines matching canvases by id with local item fields winning', () => {
  const normalize = (value: Canvas): Canvas => value;
  const merged = mergeCanvases([
    canvas({
      id: 'shared',
      name: 'local',
      lastModified: 20,
      promptNodes: [{ id: 'prompt-1', prompt: 'local prompt', position: { x: 0, y: 0 } } as never],
    }),
    canvas({ id: 'local-only', name: 'local only' }),
  ], [
    canvas({
      id: 'shared',
      name: 'disk',
      lastModified: 10,
      promptNodes: [{ id: 'prompt-1', prompt: 'disk prompt', position: { x: 5, y: 5 } } as never],
      imageNodes: [{ id: 'image-1', prompt: 'disk image', url: 'https://cdn.example.com/image.png', position: { x: 0, y: 0 } } as never],
    }),
    canvas({ id: 'disk-only', name: 'disk only' }),
  ], normalize);

  const shared = merged.find((item) => item.id === 'shared');

  assert.deepEqual(merged.map((item) => item.id), ['shared', 'disk-only', 'local-only']);
  assert.equal(shared?.name, 'local');
  assert.equal(shared?.lastModified, 20);
  assert.equal(shared?.promptNodes[0].prompt, 'local prompt');
  assert.deepEqual(shared?.imageNodes.map((node) => node.id), ['image-1']);
});

test('preferred active canvas keeps non-empty local active before disk fallback', () => {
  const canvases = [
    canvas({ id: 'local-empty' }),
    canvas({
      id: 'disk-filled',
      promptNodes: [{ id: 'prompt-1', prompt: 'x', position: { x: 0, y: 0 } } as never],
    }),
    canvas({
      id: 'local-filled',
      imageNodes: [{ id: 'image-1', prompt: 'x', url: 'https://cdn.example.com/image.png', position: { x: 0, y: 0 } } as never],
    }),
  ];

  assert.equal(resolvePreferredActiveCanvasId('local-filled', 'disk-filled', canvases), 'local-filled');
  assert.equal(resolvePreferredActiveCanvasId('local-empty', 'disk-filled', canvases), 'disk-filled');
  assert.equal(resolvePreferredActiveCanvasId('local-empty', undefined, canvases), 'disk-filled');
  assert.equal(resolvePreferredActiveCanvasId(undefined, undefined, [canvas({ id: 'empty' })]), 'empty');
});
