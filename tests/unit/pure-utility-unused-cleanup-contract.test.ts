import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('pure utility modules do not retain source-proven unused locals', () => {
  const promptGroupLayoutSource = readSource('src/app/promptGroupRenderLayout.ts');
  const modelSortingSource = readSource('src/utils/modelSorting.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/pure-utility-unused-cleanup-contract\.test\.ts/);
  assert.match(promptGroupLayoutSource, /buildPromptGroupRenderLayout/);
  assert.match(modelSortingSource, /filterAndSortModels/);
  assert.match(modelSortingSource, /sortModels/);

  assert.doesNotMatch(promptGroupLayoutSource, /promptCardHeight/);
  assert.doesNotMatch(promptGroupLayoutSource, /promptCardWidth/);
  assert.doesNotMatch(modelSortingSource, /NANO_BANANA_KEYWORDS/);
  assert.doesNotMatch(modelSortingSource, /SUFFIX_WEIGHTS/);
  assert.doesNotMatch(modelSortingSource, /getModelWeight/);
  assert.doesNotMatch(modelSortingSource, /extractVersionNumber/);
  assert.doesNotMatch(modelSortingSource, /getSuffixWeight/);
});
