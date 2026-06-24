import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProviderMetadata } from '../../apps/web/src/services/api/providerRegistry.ts';

test('frontend provider metadata keeps relay platforms distinct from official providers', () => {
  const openRouter = getProviderMetadata('openrouter');
  assert.equal(openRouter.label, 'OpenRouter');
  assert.equal(openRouter.kind, 'relay');
  assert.notEqual(openRouter.label, 'OpenAI');

  const gptBest = getProviderMetadata('gpt-best');
  assert.equal(gptBest.label, 'GPT-Best');
  assert.equal(gptBest.kind, 'relay');

  const apimart = getProviderMetadata('api mart');
  assert.equal(apimart.label, 'APIMart');
  assert.equal(apimart.kind, 'relay');
});

test('frontend provider metadata preserves official provider labels for official ids', () => {
  const openai = getProviderMetadata('OpenAI');
  assert.equal(openai.label, 'OpenAI');
  assert.equal(openai.kind, 'official');

  const google = getProviderMetadata('Google');
  assert.equal(google.label, 'Google Cloud / Gemini');
  assert.equal(google.kind, 'official');
});
