import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce post-build sync runtime owns built-card upload and active-task effects', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommercePostBuildSyncRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'src/app/useEcommercePostBuildSyncRuntime.ts should exist');

  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommercePostBuildSyncRuntime.ts');

  assert.match(hookSource, /export interface UseEcommercePostBuildSyncRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommercePostBuildSyncRuntimeResult \{/);
  assert.match(hookSource, /findEcommerceAnalysisItemBySourceKey/);
  assert.match(hookSource, /buildRuntimeEcommerceAssetRoles/);
  assert.match(hookSource, /activeTaskNodeId/);
  assert.match(hookSource, /analysisConfirmed/);
  assert.match(hookSource, /buildCurrentEcommerceUploadReferences\(\)/);
  assert.match(hookSource, /setEcommercePostBuildSyncState\(\(previousState\) =>/);

  assert.match(appSource, /useEcommercePostBuildSyncRuntime\(\{/);
  assert.match(appSource, /setEcommercePostBuildSyncState: updateEcommercePostBuildSyncState/);
  assert.doesNotMatch(appSource, /const findEcommerceAnalysisItemBySourceKey = useCallback/);
  assert.doesNotMatch(appSource, /const buildRuntimeEcommerceAssetRoles = useCallback/);
  assert.doesNotMatch(appSource, /const sourceItem = findEcommerceAnalysisItemBySourceKey\(analysis, node\.ecommerce\.sourceRowKey\)/);
  assert.doesNotMatch(appSource, /const latestNode = activeCanvas\?\.promptNodes\.find\(\(node\) => node\.id === ecommerceState\.activeTaskNodeId\)/);
});
