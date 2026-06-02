import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



function listSourceFiles(relativeDirectory: string): string[] {
  const directory = path.join(ROOT_DIR, relativeDirectory);
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path.relative(ROOT_DIR, absolutePath)));
      continue;
    }

    if (/\.[cm]?[tj]sx?$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

test('pure utility modules do not retain source-proven unused locals', () => {
  const promptGroupLayoutSource = readSource('apps/web/src/app/promptGroupRenderLayout.ts');
  const modelSortingSource = readSource('apps/web/src/utils/modelSorting.ts');
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

test('pure image utilities do not retain orphaned imageCompression module imports', () => {
  const removedServicePath = path.join(ROOT_DIR, 'apps/web/src/services/image/imageCompression.ts');
  assert.equal(existsSync(removedServicePath), false);

  const sourceFiles = listSourceFiles('apps/web/src');
  for (const sourceFile of sourceFiles) {
    const source = readFileSync(sourceFile, 'utf-8');
    assert.doesNotMatch(source, /from ['"][^'"]*imageCompression(?:\.ts)?['"]/);
    assert.doesNotMatch(source, /import\(['"][^'"]*imageCompression(?:\.ts)?['"]\)/);
  }
});
