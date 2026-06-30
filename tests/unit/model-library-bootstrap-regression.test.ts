import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('admin model service defers system model preload once startup reaches workspace_ready', () => {
  const source = readSource('apps/web/src/services/model/adminModelService.ts');

  assert.match(source, /if \(!isStartupStageReady\(this\.startupStage, 'workspace_ready'\)\) \{/);
  assert.match(source, /if \(isStartupStageReady\(stage, 'workspace_ready'\)\) \{/);
  assert.match(source, /this\.scheduleDeferredUnifiedRefresh\(\);/);
  assert.doesNotMatch(source, /void this\.forceLoadAdminModels\(\)\.catch/);
});

test('model library background refresh respects startup-safe force flags', () => {
  const source = readSource('apps/web/src/services/model/modelLibraryRefresh.ts');

  assert.match(source, /const force = options\?\.force === true;/);
  assert.match(source, /keyManager\.refreshFromCloudNow\(\{ force \}\)/);
  assert.match(source, /force \? adminModelService\.forceLoadAdminModels\(\) : adminModelService\.loadAdminModels\(false\)/);
});

test('prompt bar bootstraps the model library when system models are browseable but the list is still empty', () => {
  const source = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.match(source, /if \(!canBrowseSystemCreditModels \|\| availableModels\.length > 0\) \{\s*return;\s*\}/);
  assert.match(source, /const INITIAL_MODEL_LIBRARY_BOOTSTRAP_DELAY_MS = 30000;/);
  assert.match(source, /setModelMenuLoadingState\('bootstrapping_without_cache'\);/);
  assert.match(source, /const bootstrapTimer = window\.setTimeout\(\(\) => \{/);
  assert.match(source, /await refreshModelLibraryData\(\{ force: false \}\);/);
  assert.match(source, /window\.clearTimeout\(bootstrapTimer\);/);
  assert.match(source, /setGlobalModels\(keyManager\.getGlobalModelList\(\)\);/);
  assert.match(source, /if \(isModelListEmpty && isModelMenuBootstrapping\) \{\s*currentModelName = '正在同步最新模型库\.\.\.';/);
});
