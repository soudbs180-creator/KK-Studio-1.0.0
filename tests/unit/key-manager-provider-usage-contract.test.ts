import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type ProviderUsage = {
  totalTokens: number;
  totalCost: number;
  dailyTokens: number;
  dailyCost: number;
  lastReset: number;
};

type ProviderUsageCarrier = {
  usage?: ProviderUsage;
  updatedAt?: number;
};

type KeyManagerProviderUsageModule = {
  applyProviderUsageDeltaToProvider: <TProvider extends ProviderUsageCarrier>(
    provider: TProvider,
    tokenDelta: number,
    costDelta: number,
    now?: number,
  ) => TProvider;
  isUsageLimitExceeded: (target: {
    budgetLimit?: number;
    totalCost?: number;
    tokenLimit?: number;
    usedTokens?: number;
  }) => boolean;
};



async function loadProviderUsageHelpers(): Promise<KeyManagerProviderUsageModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerProviderUsage.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerProviderUsage.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerProviderUsage.ts') as KeyManagerProviderUsageModule;
}

test('provider usage math lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerProviderUsage.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-provider-usage-contract\.test\.ts/);
  assert.match(helperSource, /export function isUsageLimitExceeded/);
  assert.match(helperSource, /export function applyProviderUsageDeltaToProvider/);
  assert.match(keyManagerSource, /from '\.\/keyManagerProviderUsage';/);
  assert.doesNotMatch(keyManagerSource, /private isUsageLimitExceeded/);
  assert.doesNotMatch(keyManagerSource, /private resolveProviderBudgetLimit/);
  assert.doesNotMatch(keyManagerSource, /private resolveProviderTokenLimit/);
  assert.match(keyManagerSource, /applyProviderUsageDeltaToProvider\(provider, tokenDelta, costDelta\)/);
  assert.match(keyManagerSource, /budgetLimit: resolveProviderBudgetLimit\(p\),/);
  assert.match(keyManagerSource, /tokenLimit: resolveProviderTokenLimit\(p\),/);
});

test('provider usage helper preserves limit checks and daily reset behavior', async () => {
  const { applyProviderUsageDeltaToProvider, isUsageLimitExceeded } = await loadProviderUsageHelpers();
  const jan1 = new Date('2026-01-01T10:00:00Z').getTime();
  const jan2 = new Date('2026-01-02T10:00:00Z').getTime();

  assert.equal(isUsageLimitExceeded({ budgetLimit: 10, totalCost: 10 }), true);
  assert.equal(isUsageLimitExceeded({ tokenLimit: 100, usedTokens: 99 }), false);
  assert.equal(isUsageLimitExceeded({ tokenLimit: 100, usedTokens: 100 }), true);
  assert.equal(isUsageLimitExceeded({ budgetLimit: -1, tokenLimit: -1 }), false);

  const provider: ProviderUsageCarrier = {};
  assert.equal(applyProviderUsageDeltaToProvider(provider, 5, 1.25, jan1), provider);
  assert.deepEqual(provider.usage, {
    totalTokens: 5,
    totalCost: 1.25,
    dailyTokens: 5,
    dailyCost: 1.25,
    lastReset: jan1,
  });
  assert.equal(provider.updatedAt, jan1);

  applyProviderUsageDeltaToProvider(provider, 2, 0.75, jan1 + 1000);
  assert.deepEqual(provider.usage, {
    totalTokens: 7,
    totalCost: 2,
    dailyTokens: 7,
    dailyCost: 2,
    lastReset: jan1,
  });

  applyProviderUsageDeltaToProvider(provider, -10, -10, jan2);
  assert.deepEqual(provider.usage, {
    totalTokens: 0,
    totalCost: 0,
    dailyTokens: 0,
    dailyCost: 0,
    lastReset: jan2,
  });
  assert.equal(provider.updatedAt, jan2);
});
