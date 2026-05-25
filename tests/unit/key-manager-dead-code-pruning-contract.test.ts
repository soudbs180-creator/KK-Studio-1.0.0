import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('keyManager does not retain proven unused local helper definitions', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-dead-code-pruning-contract\.test\.ts/);
  assert.doesNotMatch(source, /const LEGACY_GOOGLE_MODELS = /);
  assert.doesNotMatch(source, /const isLegacyGoogleModelList = /);
  assert.doesNotMatch(source, /private migrateFromOldFormat\(\): KeyManagerState/);
  assert.doesNotMatch(source, /function getDefaultGoogleModels\(\): string\[]/);
  assert.doesNotMatch(source, /import \{ RegionService \} from '\.\.\/system\/RegionService';/);
  assert.doesNotMatch(source, /function get12AIBaseUrl\(\): string/);
  assert.doesNotMatch(source, /const chatModelIds = new Set\(GOOGLE_CHAT_MODELS\.map\(model => model\.id\)\);/);
  assert.doesNotMatch(source, /Get validated global model list from all channels \(Standard \+ Custom\)[\s\S]*?\*\/\s*\/\*\*[\s\S]*?Get validated global model list from all channels \(Standard \+ Custom\)/);
  assert.doesNotMatch(source, /getProviderStorageKey,\s*[\r\n]+\s*isBrowserRuntime/);
  assert.doesNotMatch(source, /private authHasSession = false;/);
  assert.doesNotMatch(source, /this\.authHasSession = detail\.hasSession;/);
  assert.doesNotMatch(source, /private getProviderStorageKey\(targetUserId: string \| null = this\.userId\): string/);
  assert.doesNotMatch(source, /const isCreditModel = normalizedModelId\.includes\('nano-banana'\)/);
  assert.doesNotMatch(source, /private flushPendingProviderCloudSync\(\): void/);
  assert.match(source, /if \(this\.userId\) \{\s*markPendingProviderCloudSync\(this\.cloudSyncState\);\s*void this\.flushPendingCloudSync\(\);\s*\}/);
  assert.doesNotMatch(source, /if \(this\.userId && !this\.canUseSessionlessLocalUserApiStorage\(\)\) \{/);
});
