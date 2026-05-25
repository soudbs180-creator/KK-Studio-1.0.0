import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('admin model service can preload system models once startup reaches workspace_ready', () => {
  const source = readSource('src/services/model/adminModelService.ts');

  assert.match(source, /if \(!isStartupStageReady\(this\.startupStage, 'workspace_ready'\)\) \{/);
  assert.match(source, /if \(isStartupStageReady\(stage, 'workspace_ready'\)\) \{/);
  assert.match(source, /void this\.forceLoadAdminModels\(\)\.catch/);
});

test('prompt bar bootstraps the model library when system models are browseable but the list is still empty', () => {
  const source = readSource('src/components/layout/PromptBar.tsx');

  assert.match(source, /if \(!canBrowseSystemCreditModels \|\| availableModels\.length > 0\) \{\s*return;\s*\}/);
  assert.match(source, /setModelMenuLoadingState\('bootstrapping_without_cache'\);/);
  assert.match(source, /await refreshModelLibraryData\(\{ force: true \}\);/);
  assert.match(source, /setGlobalModels\(keyManager\.getGlobalModelList\(\)\);/);
  assert.match(source, /if \(isModelListEmpty && isModelMenuBootstrapping\) \{\s*currentModelName = '正在同步最新模型库\.\.\.';/);
});
