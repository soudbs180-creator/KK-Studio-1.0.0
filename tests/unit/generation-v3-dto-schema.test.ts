import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CreateQuoteRequestSchema,
  GenerationQuoteDtoSchema,
  CreateJobRequestSchema,
  GenerationJobDtoV3Schema,
} from '../../packages/shared/src/index.ts';

test('valid create quote request passes schema', () => {
  const result = CreateQuoteRequestSchema.parse({
    mediaType: 'image',
    model: 'gemini-2.5-flash',
    count: 4,
    preferredChannel: 'platform-credits',
  });
  assert.equal(result.mediaType, 'image');
  assert.equal(result.count, 4);
});

test('invalid mediaType is rejected', () => {
  assert.throws(() => CreateQuoteRequestSchema.parse({
    mediaType: '3d',
    model: 'gemini-2.5-flash',
  }));
});

test('generation quote DTO requires priceVersion', () => {
  assert.throws(() => GenerationQuoteDtoSchema.parse({
    quoteId: '550e8400-e29b-41d4-a716-446655440000',
    mediaType: 'image',
    model: 'gemini-2.5-flash',
    count: 1,
    routeSnapshot: {
      providerId: 'fake-provider',
      modelId: 'gemini-2.5-flash',
      adapterId: 'fake-provider',
      adapterVersion: '1.0.0',
      capabilityVersion: '1.0.0',
    },
    channel: 'platform-credits',
    cost: { credits: 10 },
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    createdAt: new Date().toISOString(),
    ownerId: 'user-1',
  }));
});

test('valid generation job DTO passes schema', () => {
  const job = GenerationJobDtoV3Schema.parse({
    jobId: '550e8400-e29b-41d4-a716-446655440000',
    quoteId: '550e8400-e29b-41d4-a716-446655440001',
    channel: 'platform-credits',
    provider: 'fake-provider',
    model: 'gemini-2.5-flash',
    capabilityVersion: '1.0.0',
    status: 'reserved',
    items: [
      {
        itemId: '550e8400-e29b-41d4-a716-446655440002',
        sequence: 0,
        status: 'pending',
        reconciliation: 'pending',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerId: 'user-1',
  });
  assert.equal(job.items.length, 1);
  assert.equal(job.retryCount, 0);
});

test('create job request validates quoteId and optional payload', () => {
  const result = CreateJobRequestSchema.parse({
    quoteId: '550e8400-e29b-41d4-a716-446655440000',
    payload: { prompt: 'hello' },
    canvasNodeIds: ['node-1'],
  });
  assert.equal(result.canvasNodeIds?.[0], 'node-1');
});
