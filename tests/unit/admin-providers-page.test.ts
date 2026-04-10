import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildSaveAdminCreditProviderPayload,
  createProviderEditorState,
} from '../../apps/admin/src/features/providers/providerEditorModel.ts';

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
      retainApiKeyFingerprints: ['fp-1'],
      models: [],
    },
  );
});

test('buildSaveAdminCreditProviderPayload returns the canonical save payload', () => {
  assert.deepEqual(
    buildSaveAdminCreditProviderPayload({
      id: 'provider-1',
      providerName: 'System Route',
      baseUrl: 'https://example.com/v1',
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
      }],
    } as any),
    {
      providerName: 'System Route',
      baseUrl: 'https://example.com/v1',
      apiKeys: [],
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
        priority: 0,
        weight: 0,
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
