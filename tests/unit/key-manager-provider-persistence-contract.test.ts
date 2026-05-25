import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type ProviderRuntimeState = {
  id: string;
  name?: string;
  pricingSnapshot?: unknown;
  activitySummary?: unknown;
};

type KeyManagerProvidersModule = {
  mergeCloudProvidersWithLocalRuntimeState: <TProvider extends ProviderRuntimeState>(
    cloudProviders: TProvider[],
    localProviders: TProvider[],
  ) => TProvider[];
};

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

async function loadProviderHelpers(): Promise<KeyManagerProvidersModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerProviders.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerProviders.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerProviders.ts') as KeyManagerProvidersModule;
}

test('provider runtime-state merge lives with provider persistence helpers', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const providerSource = readSource('src/services/auth/keyManagerProviders.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-provider-persistence-contract\.test\.ts/);
  assert.match(providerSource, /export function mergeCloudProvidersWithLocalRuntimeState/);
  assert.match(keyManagerSource, /mergeCloudProvidersWithLocalRuntimeState,/);
  assert.match(keyManagerSource, /from '\.\/keyManagerProviders';/);
  assert.doesNotMatch(keyManagerSource, /private mergeCloudProvidersWithLocalRuntimeState/);
  assert.match(
    keyManagerSource,
    /mergeCloudProvidersWithLocalRuntimeState\(\s*this\.normalizeStoredProviders\(extractUserApiProvidersFromPayload\(rawPayload\)\)\s*,\s*this\.providers\s*,\s*\)/,
  );
});

test('provider runtime-state merge preserves local pricing and activity snapshots only when cloud omits them', async () => {
  const { mergeCloudProvidersWithLocalRuntimeState } = await loadProviderHelpers();
  const localPricing = { input: 1 };
  const localActivity = { lastLatencyMs: 120 };
  const cloudPricing = { input: 2 };
  const cloudProviders: ProviderRuntimeState[] = [
    { id: 'provider-a', name: 'Cloud A' },
    { id: 'provider-b', name: 'Cloud B', pricingSnapshot: cloudPricing },
    { id: 'provider-c', name: 'Cloud C' },
  ];
  const localProviders: ProviderRuntimeState[] = [
    { id: ' provider-a ', name: 'Local A', pricingSnapshot: localPricing, activitySummary: localActivity },
    { id: 'provider-b', name: 'Local B', pricingSnapshot: localPricing, activitySummary: localActivity },
  ];

  assert.deepEqual(
    mergeCloudProvidersWithLocalRuntimeState(
      cloudProviders,
      localProviders,
    ),
    [
      { id: 'provider-a', name: 'Cloud A', pricingSnapshot: localPricing, activitySummary: localActivity },
      { id: 'provider-b', name: 'Cloud B', pricingSnapshot: cloudPricing, activitySummary: localActivity },
      { id: 'provider-c', name: 'Cloud C' },
    ],
  );

  assert.deepEqual(mergeCloudProvidersWithLocalRuntimeState([], [{ id: 'provider-a' }]), []);
});
