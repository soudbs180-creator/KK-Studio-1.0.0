import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getBillingMode,
  BillingMode,
  parseGroupMultiplier,
  normalizeApiResponse,
  ProviderPriceMap,
  inferProviderFromModel,
} from '../../src/services/billing/pricingRules.ts';

test('pricingRules: inferProviderFromModel should detect provider correctly', () => {
  assert.strictEqual(inferProviderFromModel('gpt-4o-mini'), 'OpenAI');
  assert.strictEqual(inferProviderFromModel('gemini-1.5-pro'), 'Google');
  assert.strictEqual(inferProviderFromModel('claude-3-5-sonnet'), 'Anthropic');
  assert.strictEqual(inferProviderFromModel('deepseek-chat'), 'DeepSeek');
  assert.strictEqual(inferProviderFromModel('unknown-model'), undefined);
});

test('pricingRules: getBillingMode should detect times vs tokens correctly', () => {
  assert.strictEqual(getBillingMode('per_request'), BillingMode.TIMES);
  assert.strictEqual(getBillingMode('times'), BillingMode.TIMES);
  assert.strictEqual(getBillingMode('fixed'), BillingMode.TIMES);
  assert.strictEqual(getBillingMode('token'), BillingMode.TOKENS);
  assert.strictEqual(getBillingMode('tokens'), BillingMode.TOKENS);
  assert.strictEqual(getBillingMode(''), BillingMode.TOKENS);
});

test('pricingRules: parseGroupMultiplier should robustly extract numbers', () => {
  assert.strictEqual(parseGroupMultiplier('1.5'), 1.5);
  assert.strictEqual(parseGroupMultiplier('vip: 2.0'), 2.0);
  assert.strictEqual(parseGroupMultiplier('default：1.25'), 1.25);
  assert.strictEqual(parseGroupMultiplier('×3.0'), 3.0);
  assert.strictEqual(parseGroupMultiplier('invalid-text'), 1.0);
  assert.strictEqual(parseGroupMultiplier(''), 1.0);
});

test('pricingRules: normalizeApiResponse should format times billing items', () => {
  const rawTimes = {
    model: 'dall-e-3',
    billing_type: 'per_request',
    price: 0.04,
    group_ratio: 1.5,
  };
  const normalizedTimes = normalizeApiResponse(rawTimes);
  assert.ok(normalizedTimes);
  assert.strictEqual(normalizedTimes.modelId, 'dall-e-3');
  assert.strictEqual(normalizedTimes.type, 'times');
  assert.strictEqual(normalizedTimes.inputPrice, 0.04);
  assert.strictEqual(normalizedTimes.outputPrice, 0);
  assert.strictEqual(normalizedTimes.groupRatio, 1.5);
});

test('pricingRules: normalizeApiResponse should format tokens billing items with custom group ratio', () => {
  const rawTokens = {
    model: 'gpt-4o',
    billing_type: 'token',
    input_price: 5.0,
    output_price: 15.0,
    token_group: 'vip',
  };
  const groupRatioMap = {
    vip: 2.0,
    default: 1.0,
  };
  const normalizedTokens = normalizeApiResponse(rawTokens, groupRatioMap);
  assert.ok(normalizedTokens);
  assert.strictEqual(normalizedTokens.modelId, 'gpt-4o');
  assert.strictEqual(normalizedTokens.type, 'tokens');
  assert.strictEqual(normalizedTokens.inputPrice, 5.0);
  assert.strictEqual(normalizedTokens.outputPrice, 15.0);
  assert.strictEqual(normalizedTokens.groupRatio, 2.0);
});

test('pricingRules: normalizeApiResponse should fallback empty prices to ProviderPriceMap', () => {
  const rawEmptyPrices = {
    model: 'gemini-1.5-flash',
    input_price: 0,
    output_price: 0,
  };
  const normalizedEmpty = normalizeApiResponse(rawEmptyPrices);
  assert.ok(normalizedEmpty);
  assert.strictEqual(normalizedEmpty.provider, 'Google');
  assert.strictEqual(normalizedEmpty.inputPrice, ProviderPriceMap.google.input);
  assert.strictEqual(normalizedEmpty.outputPrice, ProviderPriceMap.google.output);
});
