import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  buildSaveAdminCreditProviderPayload,
  createDefaultProviderEditorState,
  createProviderEditorState,
  hasProviderApiKeysForSave,
} from '../../apps/admin/src/features/providers/providerEditorModel.ts';

const providersPageSource = readFileSync(
  new URL('../../apps/admin/src/pages/AdminProvidersPage.tsx', import.meta.url),
  'utf8',
);

test('createProviderEditorState keeps editable provider fields without storing raw key values', () => {
  assert.deepEqual(
    createProviderEditorState({
      providerId: 'provider-1',
      providerName: 'System Route',
      baseUrl: 'https://example.com/v1',
      apiKeyEntries: [{ fingerprint: 'fp-1', preview: 'sk-***' }],
      models: [],
    }),
    {
      id: 'provider-1',
      providerName: 'System Route',
      baseUrl: 'https://example.com/v1',
      apiKeyInput: '',
      retainApiKeyFingerprints: ['fp-1'],
      models: [],
    },
  );
});

test('createDefaultProviderEditorState creates an ecommerce-ready system route draft', () => {
  const provider = createDefaultProviderEditorState();

  assert.equal(provider.id, 'system-image-provider');
  assert.equal(provider.baseUrl, 'https://future-api.vodeshop.com');
  assert.equal(provider.apiKeyInput, '');

  const primaryModel = provider.models[0];
  assert.equal(primaryModel.modelId, 'gemini-3.1-flash-image-preview');
  assert.equal(primaryModel.displayName, 'Nano Banana 2');
  assert.equal(primaryModel.endpointType, 'openai');
  assert.equal(primaryModel.isActive, true);
  assert.equal(primaryModel.priority, 100);
  assert.equal(primaryModel.weight, 100);
  assert.deepEqual(primaryModel.qualityPricing, {
    '1K': { enabled: true, creditCost: 12 },
    '2K': { enabled: true, creditCost: 24 },
    '4K': { enabled: true, creditCost: 48 },
  });
});

test('buildSaveAdminCreditProviderPayload returns the canonical save payload', () => {
  assert.deepEqual(
    buildSaveAdminCreditProviderPayload({
      id: 'provider-1',
      providerName: 'System Route',
      baseUrl: 'https://example.com/v1',
      apiKeyInput: 'sk-new-1\nsk-new-2, sk-new-1',
      retainApiKeyFingerprints: ['fp-1'],
      models: [{
        modelId: 'model-a',
        displayName: 'Model A',
        endpointType: 'chat',
        creditCost: 10,
        isActive: true,
        callCount: 0,
        advancedEnabled: false,
        mixWithSameModel: false,
        priority: 7,
        weight: 3,
      }],
    } as any),
    {
      providerName: 'System Route',
      baseUrl: 'https://example.com/v1',
      apiKeys: ['sk-new-1', 'sk-new-2'],
      retainApiKeyFingerprints: ['fp-1'],
      models: [{
        modelId: 'model-a',
        displayName: 'Model A',
        description: undefined,
        endpointType: 'chat',
        creditCost: 10,
        advancedEnabled: false,
        mixWithSameModel: false,
        qualityPricing: {},
        priority: 7,
        weight: 3,
        isActive: true,
        color: '#111111',
        colorSecondary: null,
        textColor: 'white',
        maxCallsLimit: null,
        autoPauseOnLimit: false,
      }],
    },
  );
});

test('hasProviderApiKeysForSave requires either retained or newly entered provider keys', () => {
  const provider = createDefaultProviderEditorState();

  assert.equal(hasProviderApiKeysForSave(provider), false);
  assert.equal(hasProviderApiKeysForSave({ ...provider, apiKeyInput: 'sk-live' }), true);
  assert.equal(hasProviderApiKeysForSave({ ...provider, retainApiKeyFingerprints: ['fp-1'] }), true);
});

test('AdminProvidersPage exposes a first-provider bootstrap editor instead of dead-ending on an empty list', () => {
  assert.match(providersPageSource, /createDefaultProviderEditorState/);
  assert.match(providersPageSource, /hasProviderApiKeysForSave/);
  assert.match(providersPageSource, /data-testid="admin-provider-bootstrap"/);
  assert.match(providersPageSource, /data-testid="admin-provider-api-key-input"/);
  assert.match(providersPageSource, /saveAdminCreditProvider\(\s*provider\.id/);
});
