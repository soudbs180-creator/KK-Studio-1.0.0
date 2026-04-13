import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getEcommerceAllowedModels,
  isEcommerceAllowedModel,
  normalizeEcommerceModelId,
  resolveEcommerceAspectPolicy,
} from '../../src/services/ecommerce/ecommerceModelPolicy.ts';

describe('ecommerce model policy', () => {
  test('normalizes Nano Banana aliases to canonical model ids', () => {
    assert.equal(normalizeEcommerceModelId('nano banana 2'), 'gemini-3.1-flash-image-preview');
    assert.equal(normalizeEcommerceModelId('nano-banana-pro'), 'gemini-3-pro-image-preview');
    assert.equal(normalizeEcommerceModelId('gemini-3.1-flash-image-preview@slot_1'), 'gemini-3.1-flash-image-preview');
  });

  test('allows only the ecommerce Nano Banana whitelist', () => {
    assert.deepEqual(getEcommerceAllowedModels(), [
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
    ]);
    assert.equal(isEcommerceAllowedModel('nano banana 2'), true);
    assert.equal(isEcommerceAllowedModel('gemini-3-pro-image-preview'), true);
    assert.equal(isEcommerceAllowedModel('imagen-4.0-generate-001'), false);
  });

  test('uses a constrained aspect policy for main-image requirements', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'main-image',
      modelId: 'gemini-3.1-flash-image-preview',
    });

    assert.equal(policy.sizePolicy, 'main-default');
    assert.equal(policy.defaultAspectRatio, '1:1');
    assert.deepEqual(policy.allowedAspectRatios, ['1:1', '3:4']);
    assert.equal(policy.mobileAspectRatio, undefined);
  });

  test('treats explicit sheet dimensions like 970*600 as single-stage A+ requirements', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'a-plus-module',
      modelId: 'gemini-3-pro-image-preview',
      declaredDimensions: '970*600',
      designRequirements: '冰川背景，参考图1排版',
    });

    assert.equal(policy.sizePolicy, 'sheet-native');
    assert.equal(policy.defaultAspectRatio, '16:9');
    assert.deepEqual(policy.allowedAspectRatios, ['16:9']);
    assert.equal(policy.mobileAspectRatio, undefined);
  });

  test('detects desktop/mobile staged A+ requirements from bilingual hints', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'a-plus-module',
      modelId: 'gemini-3.1-flash-image-preview',
      designRequirements: '先生成电脑端横幅，确认后再出手机端版本',
      copyText: 'desktop hero first, then mobile crop',
    });

    assert.equal(policy.sizePolicy, 'desktop-then-mobile');
    assert.equal(policy.defaultAspectRatio, '21:9');
    assert.deepEqual(policy.allowedAspectRatios, ['21:9']);
    assert.equal(policy.mobileAspectRatio, '4:3');
  });
});
