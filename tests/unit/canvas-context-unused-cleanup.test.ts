import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('CanvasContext does not retain proven unused imports or local layout writes', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-context-unused-cleanup\.test\.ts/);
  assert.match(contextSource, /export type \{ ArrangeMode, CanvasContextType, CanvasState, SubCardLayout \} from '\.\/canvasContextState';/);
  assert.doesNotMatch(
    contextSource,
    /import\s+\{[\s\S]*\btype CanvasContextType\b[\s\S]*\}\s+from '\.\/canvasContextState';/,
  );
  assert.doesNotMatch(
    contextSource,
    /import\s+\{[\s\S]*\btype SubCardLayout\b[\s\S]*\}\s+from '\.\/canvasContextState';/,
  );
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
  assert.doesNotMatch(contextSource, /Selection arrange: process the selection as card groups/);
  assert.doesNotMatch(contextSource, /type SelectionGroup =/);
  assert.doesNotMatch(contextSource, /\bprocessedImageIds\b/);
  assert.doesNotMatch(contextSource, /Reserve prompt height for standalone images/);
});
