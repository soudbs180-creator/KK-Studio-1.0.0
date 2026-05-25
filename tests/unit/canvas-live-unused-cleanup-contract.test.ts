import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('InfiniteCanvas keeps public optional props without retaining unused destructures', () => {
  const source = readSource('src/components/canvas/InfiniteCanvas.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-live-unused-cleanup-contract\.test\.ts/);
  assert.match(source, /onAutoArrange\?: \(\) => void;/);
  assert.match(source, /id\?: string;/);
  assert.doesNotMatch(source, /onCanvasDoubleClick,\s*onAutoArrange,\s*onResetView/);
  assert.match(source, /onContextMenu,\s*id,\s*onImageDrop/);
  assert.match(source, /id=\{id\}/);
  assert.match(source, /onResetView,/);
  assert.match(source, /onImageDrop,/);
});
