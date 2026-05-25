import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  resolveCanvasSelectionIds,
  type CanvasSelectionMode,
} from '../../apps/web/src/context/canvasSelection.ts';

const ROOT_DIR = process.cwd();

type CanvasSelectionPublicBoundary = {
  mode: CanvasSelectionMode;
  resolve: typeof resolveCanvasSelectionIds;
};



test('canvas selection reducer owns selection mode semantics outside CanvasContext', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const selectionSource = readSource('src/context/canvasSelection.ts');
  const testConfigSource = readSource('tsconfig.tests.json');
  const boundaryIsTypechecked: CanvasSelectionPublicBoundary | null = null;

  assert.equal(boundaryIsTypechecked, null);
  assert.match(testConfigSource, /tests\/unit\/canvas-selection-runtime-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasSelection';/);
  assert.match(selectionSource, /export type CanvasSelectionMode = 'replace' \| 'add' \| 'remove' \| 'toggle';/);
  assert.match(selectionSource, /export function resolveCanvasSelectionIds/);
  assert.doesNotMatch(contextSource, /switch \(mode\)/);
  assert.doesNotMatch(contextSource, /case 'toggle'/);
});

test('resolveCanvasSelectionIds preserves existing CanvasContext selection behavior', () => {
  assert.deepEqual(resolveCanvasSelectionIds(['a', 'b'], ['c', 'c'], 'replace'), ['c', 'c']);
  assert.deepEqual(resolveCanvasSelectionIds(['a', 'b'], ['b', 'c'], 'add'), ['a', 'b', 'c']);
  assert.deepEqual(resolveCanvasSelectionIds(['a', 'b', 'c'], ['b', 'x'], 'remove'), ['a', 'c']);
  assert.deepEqual(resolveCanvasSelectionIds(['a', 'b'], ['b', 'c'], 'toggle'), ['a', 'c']);
  assert.deepEqual(resolveCanvasSelectionIds(['a', 'a', 'b'], ['c'], 'add'), ['a', 'b', 'c']);
  assert.deepEqual(resolveCanvasSelectionIds(['a', 'a', 'b'], ['a'], 'remove'), ['b']);
  assert.deepEqual(resolveCanvasSelectionIds(['a', 'a', 'b'], ['a', 'c'], 'toggle'), ['b', 'c']);
  assert.deepEqual(resolveCanvasSelectionIds(undefined, ['a'], 'add'), ['a']);
  assert.deepEqual(resolveCanvasSelectionIds(['a'], ['b']), ['b']);
});
