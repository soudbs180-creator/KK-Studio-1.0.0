import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce build runtime owns confirmation and node builders', () => {
  const hookPath = path.join(ROOT_DIR, 'src/app/useEcommerceBuildRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommerceBuildRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceBuildRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceBuildRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceBuildRuntimeResult \{/);
  assert.match(hookSource, /buildEcommerceFrameworkNode/);
  assert.match(hookSource, /buildEcommerceGroupNode/);
  assert.match(hookSource, /buildEcommercePromptNode/);
  assert.match(hookSource, /handleConfirmEcommerceAnalysis:/);
  assert.match(hookSource, /const currentUploadReferences = await buildCurrentEcommerceUploadReferences\(\);/);
  assert.match(hookSource, /buildEcommerceCanvasGroupLayout\(\{/);
  assert.match(hookSource, /buildInitialEcommerceGroupSlotState\(\{/);
  assert.match(hookSource, /createEcommerceFrameworkRuntimeState\(\{/);
  assert.match(hookSource, /const referenceAssetIds = params\.item\.referenceAssetIds \|\| \[\];/);
  assert.match(hookSource, /const referenceMentions = params\.item\.referenceMentions \|\| \[\];/);
  assert.match(hookSource, /reviewWarnings: params\.item\.reviewWarnings \|\| \[\]/);
  assert.match(hookSource, /notify\.success\('Build complete'/);
  assert.match(hookSource, /notify\.error\('Build failed'/);

  assert.match(appSource, /useEcommerceBuildRuntime\(\{/);
  assert.match(appSource, /setEcommerceBuildRuntimeState: updateEcommerceBuildRuntimeState/);
  assert.doesNotMatch(appSource, /const buildEcommerceFrameworkNode = useCallback/);
  assert.doesNotMatch(appSource, /const buildEcommerceGroupNode = useCallback/);
  assert.doesNotMatch(appSource, /const buildEcommercePromptNode = useCallback/);
  assert.doesNotMatch(appSource, /const handleConfirmEcommerceAnalysis = useCallback/);
});

test('ecommerce build runtime remains separate from upload sync and generation runtime', () => {
  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceBuildRuntime.ts');
  const postBuildSyncSource = readSource('src/app/useEcommercePostBuildSyncRuntime.ts');

  assert.match(appSource, /useEcommercePostBuildSyncRuntime\(\{/);
  assert.match(postBuildSyncSource, /if \(!ecommerceState\.analysisConfirmed \|\| !analysis \|\| !activeCanvas\?\.promptNodes\.length\) \{/);
  assert.match(appSource, /const runEcommerceNodeGeneration = useCallback/);
  assert.doesNotMatch(hookSource, /activeCanvas\?\.promptNodes/);
  assert.doesNotMatch(hookSource, /runEcommerceNodeGeneration/);
  assert.doesNotMatch(appSource, /const ecommercePromptNodes = activeCanvas\.promptNodes\.filter/);
  assert.doesNotMatch(postBuildSyncSource, /runEcommerceNodeGeneration/);
});
