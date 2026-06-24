import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getProviderMetadata,
  getProviderMetadataFromBaseUrl,
  resolveProviderAliasFromBaseUrl,
} from '../../apps/web/src/services/api/providerRegistry.ts';

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

test('frontend provider metadata resolves relay identity from baseUrl hosts', () => {
  assert.equal(resolveProviderAliasFromBaseUrl('https://openrouter.ai/api/v1'), 'OpenRouter');
  assert.equal(resolveProviderAliasFromBaseUrl('https://api.apimart.ai/v1'), 'APIMart');
  assert.equal(resolveProviderAliasFromBaseUrl('https://api.gpt-best.com/v1'), 'GPTBest');
  assert.equal(resolveProviderAliasFromBaseUrl('https://api.wuyinkeji.com'), 'Wuyin');
  assert.equal(resolveProviderAliasFromBaseUrl('https://cdn.12ai.org'), '12AI');

  const openRouterFromBase = getProviderMetadataFromBaseUrl('https://openrouter.ai/api/v1');
  assert.equal(openRouterFromBase?.label, 'OpenRouter');
  assert.equal(openRouterFromBase?.kind, 'relay');

  const officialOpenAiFromBase = getProviderMetadataFromBaseUrl('https://api.openai.com/v1');
  assert.equal(officialOpenAiFromBase, null);
});

test('frontend provider metadata preserves official provider labels for official ids', () => {
  const openai = getProviderMetadata('OpenAI');
  assert.equal(openai.label, 'OpenAI');
  assert.equal(openai.kind, 'official');

  const google = getProviderMetadata('Google');
  assert.equal(google.label, 'Google Cloud / Gemini');
  assert.equal(google.kind, 'official');
});
