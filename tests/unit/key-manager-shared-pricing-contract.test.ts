import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('keyManager shared pricing helpers live outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerSharedPricing.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-shared-pricing-contract\.test\.ts/);
  assert.match(keyManagerSource, /from '\.\/keyManagerSharedPricing(?:\.ts)?';/);
  assert.match(helperSource, /export function buildSharedPricingItemsFromRawCatalog/);
  assert.match(helperSource, /export function buildPricingSnapshotFromSharedCache/);
  assert.doesNotMatch(keyManagerSource, /function buildSharedPricingItemsFromRawCatalog/);
  assert.doesNotMatch(keyManagerSource, /function buildPricingSnapshotFromSharedCache/);
});

test('keyManager shared pricing helpers preserve raw shared catalog normalization', async () => {
  const { buildSharedPricingItemsFromRawCatalog } = await import(
    '../../apps/web/src/services/auth/keyManagerSharedPricing.ts'
  );

  const pricing = buildSharedPricingItemsFromRawCatalog([
    {
      model: 'models/gpt-4.1',
      model_name: 'GPT 4.1',
      per_request_price: '0.03',
      currency: 'USD',
      billing_unit: 'image',
      display_price: '$0.03',
      supports_groups: true,
      endpoint_url: ' https://api.example.com/v1/images ',
    },
    {
      modelId: 'gpt-4.1',
      perRequestPrice: 99,
    },
    {
      modelName: 'fallback-name',
      inputPrice: '0.25',
      outputPrice: '0.5',
      completionRatio: 2,
      groupRatio: '1.5',
      quotaType: 'tokens',
      endpointPath: '/v1/chat/completions',
    },
  ], { default: 2 });

  assert.deepEqual(pricing, [
    {
      modelId: 'gpt-4.1',
      modelName: 'GPT 4.1',
      inputPrice: 0.03,
      outputPrice: 0,
      isPerToken: false,
      groupRatio: 2,
      currency: 'USD',
      billingUnit: 'image',
      displayPrice: '$0.03',
      supportsGroups: true,
      endpointUrl: 'https://api.example.com/v1/images',
      endpointPath: undefined,
    },
    {
      modelId: 'fallback-name',
      modelName: 'fallback-name',
      inputPrice: 0.25,
      outputPrice: 0.5,
      isPerToken: true,
      groupRatio: 1.5,
      currency: 'USD',
      billingUnit: undefined,
      displayPrice: undefined,
      supportsGroups: false,
      endpointUrl: undefined,
      endpointPath: '/v1/chat/completions',
    },
  ]);
});

test('keyManager shared pricing helpers preserve provider snapshot construction', async () => {
  const { buildPricingSnapshotFromSharedCache } = await import(
    '../../apps/web/src/services/auth/keyManagerSharedPricing.ts'
  );

  assert.equal(buildPricingSnapshotFromSharedCache([]), undefined);

  const snapshot = buildPricingSnapshotFromSharedCache([
    {
      modelId: 'image-model',
      modelName: 'Image Model',
      inputPrice: 0.02,
      outputPrice: 0,
      isPerToken: false,
      groupRatio: 1,
      currency: 'USD',
      billingUnit: 'image',
      displayPrice: '$0.02',
      supportsGroups: false,
      endpointUrl: 'https://api.example.com/images',
      endpointPath: '/v1/images/generations',
    },
  ]);

  assert.equal(snapshot?.note, 'Loaded from shared provider pricing cache');
  assert.equal(snapshot?.rows?.[0]?.model, 'image-model');
  assert.equal(snapshot?.rows?.[0]?.perRequestPrice, 0.02);
  assert.equal(snapshot?.rows?.[0]?.modelPrice, 0.02);
  assert.equal(snapshot?.rows?.[0]?.endpointUrl, 'https://api.example.com/images');
  assert.equal(snapshot?.rows?.[0]?.endpointPath, '/v1/images/generations');
});
