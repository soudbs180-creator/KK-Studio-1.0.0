import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { DEFAULT_GOOGLE_MODELS } from '../../apps/web/src/services/auth/keyManagerDefaultModels.ts';

const ROOT_DIR = process.cwd();

type RemoteDiscoveryModule = {
  buildGoogleModelDiscoveryResult: (payload: unknown) => {
    strictModels: string[];
    finalModels: string[];
  };
  extractGeminiCompatModelIds: (payload: unknown) => string[];
  buildOpenAICompatModelDiscoveryResult: (payload: unknown) => {
    rawCount: number;
    firstModel: unknown;
    hasObjectField: boolean;
    hasDataArray: boolean;
    models: string[];
    metadataByModelId: Record<string, {
      endpointTypes?: string[];
    }>;
  };
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadRemoteDiscovery(): Promise<RemoteDiscoveryModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerRemoteModelDiscovery.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerRemoteModelDiscovery.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerRemoteModelDiscovery.ts') as RemoteDiscoveryModule;
}

test('keyManager remote model discovery parsing lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const helperSource = readSource('src/services/auth/keyManagerRemoteModelDiscovery.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-remote-model-discovery-contract\.test\.ts/);
  assert.match(keyManagerSource, /from '\.\/keyManagerRemoteModelDiscovery';/);
  assert.match(helperSource, /export function buildGoogleModelDiscoveryResult/);
  assert.match(helperSource, /export function extractGeminiCompatModelIds/);
  assert.match(helperSource, /export function buildOpenAICompatModelDiscoveryResult/);
  assert.match(keyManagerSource, /const REMOTE_MODEL_METADATA = new Map<string, ModelMetadata>\(\);/);
  assert.match(keyManagerSource, /registerRemoteModelMetadata\(discovery\.metadataByModelId\);/);
  assert.match(keyManagerSource, /const remoteMetadata = REMOTE_MODEL_METADATA\.get\(exactId\)\s*\|\|\s*REMOTE_MODEL_METADATA\.get\(baseId\);/);
  assert.ok(
    keyManagerSource.indexOf('const remoteMetadata = REMOTE_MODEL_METADATA.get(exactId)')
      < keyManagerSource.indexOf('const exactModel = keyManager.getGlobalModelList().find'),
    'remote endpoint metadata must be checked before route-qualified global model entries',
  );
  assert.doesNotMatch(keyManagerSource, /const allowedPatterns = \[/);
  assert.doesNotMatch(keyManagerSource, /const deduped = new Map<string, string>/);
});

test('Google model discovery keeps the strict whitelist and default merge behavior', async () => {
  const { buildGoogleModelDiscoveryResult } = await loadRemoteDiscovery();

  const result = buildGoogleModelDiscoveryResult({
    models: [
      { name: 'models/gemini-2.5-pro' },
      { name: 'models/gemini-2.5-flash-image-preview' },
      { name: 'models/text-embedding-004' },
      { name: 'models/gemini-3-pro-preview' },
      { name: 'models/veo-3.1-fast-generate-preview' },
      { name: 'models/aqa' },
    ],
  });

  assert.deepEqual(result.strictModels, [
    'gemini-2.5-pro',
    'gemini-3-pro-preview',
    'veo-3.1-fast-generate-preview',
  ]);
  assert.deepEqual(result.finalModels, Array.from(new Set([
    ...DEFAULT_GOOGLE_MODELS,
    'gemini-2.5-pro',
  ])));
});

test('Gemini-compatible discovery normalizes models and data payloads', async () => {
  const { extractGeminiCompatModelIds } = await loadRemoteDiscovery();

  assert.deepEqual(extractGeminiCompatModelIds({
    models: [
      { name: 'models/gemini-2.5-pro' },
      { id: ' gemini-2.5-flash ' },
      { model: 'models/custom-model' },
      { name: 'models/gemini-2.5-pro' },
      null,
    ],
  }), [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'custom-model',
  ]);

  assert.deepEqual(extractGeminiCompatModelIds({
    data: [
      { id: 'models/fallback-data-model' },
    ],
  }), ['fallback-data-model']);
});

test('OpenAI-compatible discovery preserves formatted metadata and canonical dedupe', async () => {
  const { buildOpenAICompatModelDiscoveryResult } = await loadRemoteDiscovery();

  const result = buildOpenAICompatModelDiscoveryResult({
    object: 'list',
    data: [
      { id: 'image-model-4k', name: 'Image 4K', owned_by: 'vendor-a' },
      { id: 'image-model', name: 'Image Base', provider: 'vendor-a' },
      { id: 'chat-model', title: 'Chat Model' },
      { id: 'plain-model' },
      { id: 'plain-model-16x9' },
    ],
  });

  assert.equal(result.rawCount, 5);
  assert.equal(result.firstModel, 'image-model-4k');
  assert.equal(result.hasObjectField, true);
  assert.equal(result.hasDataArray, true);
  assert.deepEqual(result.models, [
    'image-model|Image Base|vendor-a',
    'chat-model|Chat Model|',
    'plain-model',
  ]);
});

test('OpenAI-compatible discovery preserves GPT Best supported endpoint types', async () => {
  const { buildOpenAICompatModelDiscoveryResult } = await loadRemoteDiscovery();

  const result = buildOpenAICompatModelDiscoveryResult({
    object: 'list',
    data: [
      {
        id: 'nano-banana-2',
        name: 'Nano Banana 2',
        supported_endpoint_types: [
          'v1beta/models/gemini-3-pro-image-preview:generateContent',
          'image-generation',
        ],
      },
    ],
  });

  assert.deepEqual(result.models, [
    'nano-banana-2|Nano Banana 2|',
  ]);
  assert.deepEqual(result.metadataByModelId['nano-banana-2'].endpointTypes, [
    'v1beta/models/gemini-3-pro-image-preview:generateContent',
    'image-generation',
  ]);
});
