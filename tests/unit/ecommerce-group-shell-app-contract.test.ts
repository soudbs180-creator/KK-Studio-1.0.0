import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce analysis confirmation leaves one visible framework card while child task data stays hidden', () => {
  const appSource = readSource('src/App.tsx');
  const buildRuntimeSource = readSource('src/app/useEcommerceBuildRuntime.ts');
  const runtimeSource = readSource('src/services/ecommerce/frameworkRuntime.ts');
  const typesSource = readSource('src/types.ts');

  assert.match(appSource, /useEcommerceBuildRuntime\(\{/);
  assert.doesNotMatch(appSource, /const buildEcommerceGroupNode = useCallback/);
  assert.match(buildRuntimeSource, /const mainGroupNode = buildEcommerceGroupNode/);
  assert.match(buildRuntimeSource, /const aPlusGroupNode = buildEcommerceGroupNode/);
  assert.match(buildRuntimeSource, /buildEcommerceGroupNode\(\s*analysis\.projectMeta\.productName,\s*'A\+'/s);
  assert.match(buildRuntimeSource, /groupId: mainGroupNode\.id/);
  assert.match(buildRuntimeSource, /groupId: aPlusGroupNode\.id/);
  assert.match(buildRuntimeSource, /groupIds: \{[\s\S]*'A\+': aPlusGroupNode\.id,/);
  assert.match(typesSource, /hiddenInCanvas\?: boolean/);
  assert.match(buildRuntimeSource, /hiddenInCanvas: Boolean\(frameworkId\)/);
  assert.match(buildRuntimeSource, /hiddenInCanvas: Boolean\(params\.frameworkId\)/);
  assert.doesNotMatch(buildRuntimeSource, /hiddenInCanvas: false/);
  assert.match(runtimeSource, /hiddenInCanvas: true/);
  assert.match(appSource, /n\.hiddenInCanvas/);
  assert.match(appSource, /n\.ecommerce\?\.frameworkId/);
  assert.match(appSource, /n\.ecommerce\.kind === 'a-plus-group'/);
  assert.match(appSource, /ecommerceFrameworkTaskNodesById/);
});
