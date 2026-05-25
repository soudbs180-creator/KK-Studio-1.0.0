import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce analysis confirmation keeps unchecked modules as skipped slots instead of dropping them', () => {
  const appSource = readSource('src/App.tsx');
  const buildRuntimeSource = readSource('src/app/useEcommerceBuildRuntime.ts');

  assert.doesNotMatch(appSource, /if \(ecommerceState\.selectedItems\[item\.itemId\] === false\) \{\s*continue;\s*\}/);
  assert.doesNotMatch(appSource, /if \(ecommerceState\.selectedItems\[item\.moduleId\] === false\) \{\s*continue;\s*\}/);
  assert.match(buildRuntimeSource, /selected:\s*ecommerceState\.selectedItems\[item\.itemId\] !== false/);
  assert.match(buildRuntimeSource, /selected:\s*ecommerceState\.selectedItems\[item\.moduleId\] !== false/);
  assert.match(buildRuntimeSource, /groupId:\s*mainGroupNode\.id/);
  assert.match(buildRuntimeSource, /groupId:\s*aPlusGroupNode\.id/);
});
