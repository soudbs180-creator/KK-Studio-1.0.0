import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('keyManager reads and writes user slot/provider state through the local API payload route', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.doesNotMatch(source, /loadUserApisPayloadFromCloudRecord/);
  assert.doesNotMatch(source, /mergeUserApisPayloadToCloudRecord/);
  assert.match(source, /const accessToken = await getPreferredKkApiAccessToken\(\);/);
  assert.match(source, /const response = await kkWebApiClient\.getKeyManagerCloudState\(\{ accessToken \}\);/);
  assert.match(source, /const response = await kkWebApiClient\.replaceKeyManagerCloudState\(/);
  assert.doesNotMatch(source, /void getPreferredKkApiAccessToken\(\)\.then\(\(accessToken\) => \(/);
});

test('keyManager no longer skips local or temp users when hydrating or syncing payload state', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(
    source,
    /private async loadFromCloud\(\) \{\s*if \(!this\.userId\) return;/,
  );
  assert.doesNotMatch(
    source,
    /private async loadFromCloud\(\) \{\s*(?:(?!\b(?:private|public|async)\b)[\s\S])*canUseSessionlessLocalUserApiStorage\(\)/,
  );
  assert.doesNotMatch(
    source,
    /private async loadFromCloud\(\) \{\s*(?:(?!\b(?:private|public|async)\b)[\s\S])*this\.userId\.startsWith\('dev-user-'\)/,
  );
  assert.doesNotMatch(source, /if \(this\.canUseSessionlessLocalUserApiStorage\(\)\) \{\s*console\.log\('\[KeyManager\] Local API temp user payload bridge enabled:', userId\);\s*return;\s*\}/);
  assert.doesNotMatch(source, /private canHydrateCloudState\(\): boolean \{\s*if \(this\.canUseSessionlessLocalUserApiStorage\(\)\) \{/);
  assert.doesNotMatch(source, /private canPollCloudState\(\): boolean \{\s*if \(this\.canUseSessionlessLocalUserApiStorage\(\)\) \{/);
  assert.match(source, /const activeUserId = this\.userId;\s*if \(!activeUserId\) \{/);
  assert.doesNotMatch(source, /const activeUserId = this\.userId;\s*if \(!activeUserId \|\| activeUserId\.startsWith\('dev-user-'\)\) \{/);
});

test('keyManager preserves local provider pricing snapshots when cloud payloads refresh provider config', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');
  const providerSource = readSource('apps/web/src/services/auth/keyManagerProviders.ts');

  assert.match(source, /mergeCloudProvidersWithLocalRuntimeState/);
  assert.doesNotMatch(source, /private mergeCloudProvidersWithLocalRuntimeState/);
  assert.match(providerSource, /pricingSnapshot:\s*provider\.pricingSnapshot\s*\|\|\s*localProvider\.pricingSnapshot/);
  assert.match(providerSource, /activitySummary:\s*provider\.activitySummary\s*\|\|\s*localProvider\.activitySummary/);
});

test('keyManager reapplies cloud provider state to linked legacy slots before rebuilding the model library', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(
    source,
    /this\.state\.slots = cloudSlots;[\s\S]*this\.providers\.forEach\(\(provider\) => \{\s*this\.syncLegacySlotsWithProvider\(provider, undefined, \{ persistState: false \}\);[\s\S]*this\.notifyListeners\(\);/
  );
  assert.match(source, /if \(changed && options\?\.persistState !== false\) \{\s*this\.saveState\(\);\s*\}/);
});

test('keyManager clears stale provider models from runtime providers and linked slots when a provider connection changes', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(source, /const nextProviderModels = updates\.models !== undefined[\s\S]*connectionFieldsChanged[\s\S]*\[\][\s\S]*previousProvider\.models;/);
  assert.match(source, /const nextSupportedModels = normalizeModelList\(provider\.models \|\| \[\], slot\.provider, nextBaseUrl\);/);
  assert.match(source, /slot\.supportedModels = nextSupportedModels;/);
});

test('effective linked slots no longer fall back to stale slot models when the provider model list is empty', () => {
  const source = readSource('apps/web/src/services/auth/keyManagerEffectiveSlot.ts');

  assert.match(
    source,
    /supportedModels:\s*normalizeModels\(\s*\(provider\.models \|\| \[\]\)\.map\(\(model\) => parseModelString\(model\)\.id \|\| model\),\s*slot\.provider\s*\),/
  );
});

test('keyManager clears linked legacy slots when a provider is removed locally or disappears from cloud payloads', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(source, /private clearLegacySlotsForRemovedProvider\(/);
  assert.match(source, /slot\.disabled = true;\s*slot\.supportedModels = \[\];/);
  assert.match(source, /this\.clearLegacySlotsForRemovedProvider\(removedProvider, \{ persistState: false \}\);/);
  assert.match(
    source,
    /previousProviders[\s\S]*\.filter\(\(provider\) => !this\.providers\.some\(\(candidate\) => candidate\.id === provider\.id\)\)[\s\S]*this\.clearLegacySlotsForRemovedProvider\(provider, \{ persistState: false \}\);/
  );
});

test('keyManager uses effective provider models for routing and cache invalidation, not raw provider.models length only', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(source, /const effectiveProviderModels = resolveEffectiveProviderModels\(\{\s*provider: p\.name,\s*baseUrl: p\.baseUrl,\s*format: p\.format,\s*models: p\.models,\s*\}\);[\s\S]*supportedModels: effectiveProviderModels,/);
  assert.match(source, /const effectiveProviderModels = resolveEffectiveProviderModels\(\{\s*provider: p\.name,\s*baseUrl: p\.baseUrl,\s*format: p\.format,\s*models: p\.models,\s*\}\);[\s\S]*if \(effectiveProviderModels\.includes\('\*'\) \|\| effectiveProviderModels\.includes\(normalizedModelId\)\) return true;/);
  assert.match(source, /const slotsHash = `\$\{activeSlots\.length\}-\$\{activeSlots[\s\S]*supportedModels[\s\S]*join\('\|\|'\)/);
  assert.match(source, /const providerHash = `\$\{this\.providers\.length\}-\$\{this\.providers[\s\S]*effectiveProviderModels[\s\S]*join\('\|\|'\)/);
});

test('keyManager projects linked provider state through getSlots and channel config reads', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(source, /private getProjectedSlots\(\): KeySlot\[] \{\s*return this\.state\.slots\.map\(\(slot\) => \{\s*const linkedProvider = this\.findLinkedProviderForSlot\(slot\);\s*return linkedProvider \? this\.buildEffectiveSlotFromProvider\(slot, linkedProvider\) : slot;\s*\}\);\s*\}/);
  assert.match(source, /getSlots\(\): KeySlot\[] \{\s*this\.ensureCloudHydration\(\);\s*return this\.getProjectedSlots\(\);\s*\}/);
  assert.match(source, /const slotChannels = this\.getProjectedSlots\(\)/);
  assert.match(source, /const slot = this\.getProjectedSlots\(\)\.find\(\(item\) => item\.id === id\);/);
});

test('keyManager public slot reads and custom-key checks use projected slots instead of raw state slots', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(source, /public getKey\(id: string\): KeySlot \| undefined \{\s*return this\.getProjectedSlots\(\)\.find\(s => s\.id === id\);\s*\}/);
  assert.match(source, /public getEffectiveKey\(id: string\): KeySlot \| undefined \{\s*return this\.getProjectedSlots\(\)\.find\(\(item\) => item\.id === id\);\s*\}/);
  assert.match(source, /const slots = this\.getProjectedSlots\(\);\s*return \{\s*total: slots\.length,/);
  assert.match(source, /hasValidKeys\(\): boolean \{\s*return this\.getProjectedSlots\(\)\.some\(s => !s\.disabled && s\.status !== 'invalid'\);\s*\}/);
  assert.match(source, /const hasValidSlot = this\.getProjectedSlots\(\)\.some\(s => \{/);
});

test('keyManager refreshKey clears stale models and syncs linked provider model lists', () => {
  const source = readSource('apps/web/src/services/auth/keyManager.ts');

  assert.match(source, /const linkedProvider = this\.findLinkedProviderForSlot\(slot\);/);
  assert.match(source, /Refresh valid but no models found for \$\{id\}\. Clearing stale model list\./);
  assert.match(source, /slot\.supportedModels = \[\];/);
  assert.match(source, /if \(linkedProvider\) \{\s*linkedProvider\.models = normalizeModelList\(slot\.supportedModels \|\| \[\], linkedProvider\.name, linkedProvider\.baseUrl\);/);
  assert.match(source, /if \(linkedProvider\) \{\s*this\.saveProviders\(\);\s*\}/);
});
