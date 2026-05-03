import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

test('CanvasContext does not retain proven unused imports or local layout writes', () => {
  const contextSource = readSource('src/context/CanvasContext.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-context-unused-cleanup\.test\.ts/);
  assert.doesNotMatch(contextSource, /\bgetAllImages\b/);
  assert.doesNotMatch(contextSource, /\bgetImagesPage\b/);
  assert.doesNotMatch(contextSource, /\bgetCachedStrippedCanvases\b/);
  assert.doesNotMatch(contextSource, /const PROMPT_HEIGHT =/);
  assert.doesNotMatch(contextSource, /const GAP_X =/);
  assert.doesNotMatch(contextSource, /const GAP_Y =/);
  assert.doesNotMatch(contextSource, /const IMAGE_GAP =/);
  assert.doesNotMatch(contextSource, /let currentX = START_X/);
  assert.doesNotMatch(contextSource, /currentX = START_X/);
  assert.doesNotMatch(contextSource, /currentX \+= group\.width \+ GROUP_GAP_X/);
});
