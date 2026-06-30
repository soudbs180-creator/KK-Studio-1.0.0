import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('workspace startup does not block canvas readiness on model catalog bootstrap', () => {
  const source = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const start = source.indexOf('// Sync user with KeyManager and handle Modal Logic');
  const end = source.indexOf('// Generation config state');
  assert.ok(start >= 0 && end > start, 'startup bootstrap effect should be discoverable');

  const startupEffect = source.slice(start, end);

  assert.match(startupEffect, /void\s+adminModelService\.initializeUnifiedModels\(\)\.catch/);
  assert.doesNotMatch(startupEffect, /await\s+adminModelService\.initializeUnifiedModels\(\)/);
  assert.match(startupEffect, /advanceTo\('workspace_ready'\);\s*advanceTo\('background_ready'\);/);
});

test('workspace model notifications avoid unchanged 10k canvas rerenders', () => {
  const workspaceSource = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const adminModelSource = readSource('apps/web/src/services/model/adminModelService.ts');
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(workspaceSource, /setKeyStats\(prev => \(/);
  assert.match(workspaceSource, /prev\.total === nextKeyStats\.total/);
  assert.match(workspaceSource, /setProviders\(prev => \(/);
  assert.match(workspaceSource, /JSON\.stringify\(prev\) === JSON\.stringify\(nextProviders\)/);

  assert.match(adminModelSource, /private unifiedModelsSignature = '\[\]';/);
  assert.match(adminModelSource, /private adminCatalogSignature = JSON\.stringify\(\{ providers: \[\], models: \[\], creditCatalog: \[\] \}\);/);
  assert.match(adminModelSource, /private static readonly DEFERRED_UNIFIED_REFRESH_MS = 30000;/);
  assert.match(adminModelSource, /private scheduleDeferredUnifiedRefresh\(\): void/);
  assert.match(adminModelSource, /reschedule\(AdminModelService\.DEFERRED_UNIFIED_REFRESH_MS\);/);
  assert.match(adminModelSource, /this\.scheduleDeferredUnifiedRefresh\(\);/);
  assert.match(adminModelSource, /const nextSignature = this\.getAdminCatalogSignature\(nextProviders, nextModels, nextCreditCatalog\);/);
  assert.match(adminModelSource, /if \(this\.adminCatalogSignature === nextSignature\) \{\s*return;\s*\}/);
  assert.match(adminModelSource, /private applyUnifiedModels\(nextModels: UnifiedModel\[\]\): boolean/);
  assert.match(adminModelSource, /if \(this\.unifiedModelsSignature === nextSignature\) \{\s*return false;\s*\}/);
  assert.doesNotMatch(adminModelSource, /setTimeout\(\(\) => \{\s*void this\.refreshUnifiedModels\(\);\s*\}, 0\);/);
  assert.doesNotMatch(adminModelSource, /void this\.forceLoadAdminModels\(\)\.catch\(\(error\) => \{\s*console\.warn\('\[AdminModelService\] Deferred startup refresh failed:'[^]*?\}\);/);
  assert.doesNotMatch(adminModelSource, /JSON\.stringify\(this\.unifiedModels\) !== JSON\.stringify\(nextModels\)/);

  assert.match(keyManagerSource, /private getCloudPayloadStateSignature\(\): string/);
  assert.match(keyManagerSource, /const CLOUD_LOAD_COOLDOWN_MS = 30 \* 1000;/);
  assert.match(keyManagerSource, /private lastCloudLoadAttemptAt = 0;/);
  assert.match(keyManagerSource, /private async loadFromCloud\(options\?: \{ force\?: boolean \}\)/);
  assert.match(keyManagerSource, /if \(!force && this\.lastCloudLoadAttemptAt > 0 && now - this\.lastCloudLoadAttemptAt < CLOUD_LOAD_COOLDOWN_MS\) \{/);
  assert.match(keyManagerSource, /const previousSignature = this\.getCloudPayloadStateSignature\(\);/);
  assert.match(keyManagerSource, /const nextSignature = this\.getCloudPayloadStateSignature\(\);/);
  assert.match(keyManagerSource, /if \(previousSignature === nextSignature\) \{\s*console\.log\('\[KeyManager\] Local API payload refresh unchanged\. Keys:', this\.state\.slots\.length\);\s*return false;\s*\}/);
});

test('global service worker CDN probing stays off the startup critical path', () => {
  const bootstrapSource = readSource('apps/web/src/bootstrap.tsx');
  const registerStart = bootstrapSource.indexOf('function registerGlobalServiceWorker()');
  assert.ok(registerStart >= 0, 'service worker registration should be discoverable');

  const registerBlock = bootstrapSource.slice(registerStart);

  assert.match(bootstrapSource, /const CDN_LATENCY_TIMEOUT_MS = 600;/);
  assert.match(bootstrapSource, /const CDN_LATENCY_DEFER_MS = 15000;/);
  assert.match(bootstrapSource, /__KK_LARGE_CANVAS_SMOKE__/);
  assert.match(bootstrapSource, /window\.requestIdleCallback/);
  assert.match(bootstrapSource, /window\.setTimeout\(scheduleIdleProbe, CDN_LATENCY_DEFER_MS\);/);
  assert.match(registerBlock, /scheduleCdnPreferenceProbe\(activeWorker\);/);
  assert.doesNotMatch(registerBlock, /await\s+Promise\.all\(CDN_NODES\.map\(measureCdnLatency\)\)/);
});
