import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const legacyAdapter = require('../../services/api/lib/dispatcher/adapters/googleImageAdapter.js');
const generationAdapter = require('../../services/api/lib/generation-v3/adapters/googleImageAdapter.js');

test('Google v3 adapter passes a Connection credential per call without mutating process.env', async (context) => {
  const originalGenerateImage = legacyAdapter.generateImage;
  const previousEnvironmentKey = process.env.GEMINI_API_KEY;
  let observedApiKey = '';
  legacyAdapter.generateImage = async (input: { apiKey?: string }) => {
    observedApiKey = input.apiKey || '';
    return { status: 'success', urls: ['https://assets.example.test/generated.png'] };
  };
  context.after(() => {
    legacyAdapter.generateImage = originalGenerateImage;
    if (previousEnvironmentKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousEnvironmentKey;
  });

  process.env.GEMINI_API_KEY = 'environment-fallback-key';
  await generationAdapter.submit({
    requestId: 'request-1',
    modelId: 'gemini-2.5-flash-image',
    prompt: 'A safe test image',
    auth: { apiKey: 'connection-scoped-key' },
  });

  assert.equal(observedApiKey, 'connection-scoped-key');
  assert.equal(process.env.GEMINI_API_KEY, 'environment-fallback-key');
});
