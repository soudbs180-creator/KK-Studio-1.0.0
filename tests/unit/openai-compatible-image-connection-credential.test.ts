import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const legacyAdapter = require('../../services/api/lib/dispatcher/adapters/openAICompatibleImageAdapter.js');
const generationAdapter = require('../../services/api/lib/generation-v3/adapters/openaiCompatibleImageAdapter.js');
const assetStore = require('../../services/api/lib/generation/generationAssetStore.js');

test('OpenAI-compatible v3 adapter passes Connection auth per call without mutating process.env', async (context) => {
  const originalGenerateImage = legacyAdapter.generateImage;
  const previousKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const previousBaseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
  let observedInput: { apiKey?: string; baseUrl?: string } = {};
  legacyAdapter.generateImage = async (input: { apiKey?: string; baseUrl?: string }) => {
    observedInput = input;
    return { status: 'success', urls: ['https://assets.example.test/generated.png'] };
  };
  context.after(() => {
    legacyAdapter.generateImage = originalGenerateImage;
    restoreEnvironmentValue('OPENAI_COMPATIBLE_API_KEY', previousKey);
    restoreEnvironmentValue('OPENAI_COMPATIBLE_BASE_URL', previousBaseUrl);
  });

  process.env.OPENAI_COMPATIBLE_API_KEY = 'environment-fallback-key';
  process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://environment.example.test/v1';
  await generationAdapter.submit({
    requestId: 'request-1',
    modelId: 'gpt-image-test',
    prompt: 'A safe test image',
    auth: {
      apiKey: 'connection-scoped-key',
      endpoint: 'https://owner.example.test/v1',
    },
  });

  assert.equal(observedInput.apiKey, 'connection-scoped-key');
  assert.equal(observedInput.baseUrl, 'https://owner.example.test/v1');
  assert.equal(process.env.OPENAI_COMPATIBLE_API_KEY, 'environment-fallback-key');
  assert.equal(process.env.OPENAI_COMPATIBLE_BASE_URL, 'https://environment.example.test/v1');
});

test('legacy OpenAI-compatible adapter isolates simultaneous per-call credentials', async (context) => {
  const originalFetch = globalThis.fetch;
  const originalSaveFromUrl = assetStore.saveFromUrl;
  const previousKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const previousBaseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
  const observedRequests: Array<{ url: string; authorization: string }> = [];
  context.after(() => {
    globalThis.fetch = originalFetch;
    assetStore.saveFromUrl = originalSaveFromUrl;
    restoreEnvironmentValue('OPENAI_COMPATIBLE_API_KEY', previousKey);
    restoreEnvironmentValue('OPENAI_COMPATIBLE_BASE_URL', previousBaseUrl);
  });

  process.env.OPENAI_COMPATIBLE_API_KEY = 'environment-fallback-key';
  process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://environment.example.test/v1';
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    observedRequests.push({
      url: String(input),
      authorization: headers.get('authorization') || '',
    });
    return new Response(JSON.stringify({ data: [{ url: `${String(input)}/asset.png` }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  assetStore.saveFromUrl = async (url: string) => url;

  const { OpenAICompatibleImageAdapter } = legacyAdapter;
  const adapter = new OpenAICompatibleImageAdapter('openai-compatible-test');
  await Promise.all([
    adapter.generateImage(createGenerationInput('owner-a', 'https://a.example.test/v1')),
    adapter.generateImage(createGenerationInput('owner-b', 'https://b.example.test/v1')),
  ]);

  assert.deepEqual(observedRequests, [
    { url: 'https://a.example.test/v1/images/generations', authorization: 'Bearer owner-a' },
    { url: 'https://b.example.test/v1/images/generations', authorization: 'Bearer owner-b' },
  ]);
  assert.equal(process.env.OPENAI_COMPATIBLE_API_KEY, 'environment-fallback-key');
});

function createGenerationInput(apiKey: string, baseUrl: string) {
  return {
    requestId: `request-${apiKey}`,
    modelId: 'gpt-image-test',
    prompt: 'A safe test image',
    apiKey,
    baseUrl,
  };
}

function restoreEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
