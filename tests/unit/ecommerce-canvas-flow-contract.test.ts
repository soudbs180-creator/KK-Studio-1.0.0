import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce canvas flow allows building skeleton cards before product uploads and keeps recognized copy out of the main composer prompt', () => {
  const appSource = readSource('src/App.tsx');

  assert.doesNotMatch(appSource, /if \(ecommerceState\.productFiles\.length === 0\) \{/);
  assert.doesNotMatch(appSource, /notify\.warning\('缺少产品图', '请先上传至少一张产品图，再确认建卡。'\);/);
  assert.match(appSource, /const textToCopy = clickedNode\.mode === GenerationMode\.ECOMMERCE\s*\?\s*''\s*:/);
  assert.doesNotMatch(
    appSource,
    /clickedNode\.mode === GenerationMode\.ECOMMERCE && ecommerceTaskState\s*\?\s*\(ecommerceTaskState\.sparseUserIntent \|\| ''\)/,
  );
});
