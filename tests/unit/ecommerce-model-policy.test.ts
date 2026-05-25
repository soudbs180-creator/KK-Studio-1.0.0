import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  classifyEcommerceAPlusSizeTier,
  getEcommerceAllowedModels,
  isEcommerceAllowedModel,
  normalizeEcommerceModelId,
  resolveEcommercePromptBarAspectContext,
  resolveEffectiveEcommerceAPlusPolicy,
  resolveEcommerceAspectPolicy,
} from '../../apps/web/src/services/ecommerce/ecommerceModelPolicy.ts';

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

  test('uses auto as the default constrained aspect policy for main-image requirements', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'main-image',
      modelId: 'gemini-3.1-flash-image-preview',
    });

    assert.equal(policy.sizePolicy, 'main-default');
    assert.equal(policy.sizeTier, undefined);
    assert.equal(policy.defaultAspectRatio, 'auto');
    assert.deepEqual(policy.allowedAspectRatios, ['auto', '1:1', '3:4']);
    assert.equal(policy.mobileAspectRatio, undefined);
  });

  test('classifies declared A+ business size tiers before ratio inference', () => {
    assert.equal(classifyEcommerceAPlusSizeTier('1464*600'), '1464x600');
    assert.equal(classifyEcommerceAPlusSizeTier('1460\u00d7600'), '1464x600');
    assert.equal(classifyEcommerceAPlusSizeTier('970 x 600'), '970x600');
    assert.equal(classifyEcommerceAPlusSizeTier('600*450'), '600x450');
    assert.equal(classifyEcommerceAPlusSizeTier('1200*628'), 'unknown');
  });

  test('treats explicit sheet dimensions like 970*600 as single-stage A+ requirements', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'a-plus-module',
      modelId: 'gemini-3-pro-image-preview',
      declaredDimensions: '970*600',
      designRequirements: 'single-stage desktop-only aplus module',
    });

    assert.equal(policy.sizePolicy, 'sheet-native');
    assert.equal(policy.sizeTier, '970x600');
    assert.equal(policy.defaultAspectRatio, '16:9');
    assert.deepEqual(policy.allowedAspectRatios, ['16:9']);
    assert.equal(policy.mobileAspectRatio, undefined);
  });

  test('treats 1464*600 and 1460*600 as the same staged A+ desktop-to-mobile requirement', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'a-plus-module',
      modelId: 'gemini-3.1-flash-image-preview',
      declaredDimensions: '1460*600',
      designRequirements: 'desktop hero banner first',
    });

    assert.equal(policy.sizePolicy, 'desktop-then-mobile');
    assert.equal(policy.sizeTier, '1464x600');
    assert.equal(policy.defaultAspectRatio, '21:9');
    assert.deepEqual(policy.allowedAspectRatios, ['21:9']);
    assert.equal(policy.mobileAspectRatio, '4:3');
  });

  test('treats direct 600*450 requirements as a single-stage compact delivery with a 4:3 target', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'a-plus-module',
      modelId: 'gemini-3.1-flash-image-preview',
      declaredDimensions: '600*450',
      designRequirements: 'final mobile deliverable 600 by 450',
    });

    assert.equal(policy.sizePolicy, 'sheet-native');
    assert.equal(policy.sizeTier, '600x450');
    assert.equal(policy.defaultAspectRatio, '4:3');
    assert.deepEqual(policy.allowedAspectRatios, ['4:3']);
    assert.equal(policy.mobileAspectRatio, undefined);
  });

  test('detects desktop/mobile staged A+ requirements from bilingual hints when no business size exists', () => {
    const policy = resolveEcommerceAspectPolicy({
      kind: 'a-plus-module',
      modelId: 'gemini-3.1-flash-image-preview',
      designRequirements: 'desktop banner first and then mobile crop',
      copyText: 'desktop hero first, then mobile crop',
    });

    assert.equal(policy.sizePolicy, 'desktop-then-mobile');
    assert.equal(policy.sizeTier, 'unknown');
    assert.equal(policy.defaultAspectRatio, '21:9');
    assert.deepEqual(policy.allowedAspectRatios, ['21:9']);
    assert.equal(policy.mobileAspectRatio, '4:3');
  });

  test('uses auto A+ control mode to prefer detected business tiers and fallback to 970x600 when unknown', () => {
    assert.deepEqual(
      resolveEffectiveEcommerceAPlusPolicy({
        detectedSizeTier: '1464x600',
        controlMode: 'auto',
      }),
      {
        detectedSizeTier: '1464x600',
        effectiveSizeTier: '1464x600',
        effectiveSizePolicy: 'desktop-then-mobile',
        allowedAspectRatios: ['21:9'],
        defaultAspectRatio: '21:9',
        runtimeAspectRatio: '21:9',
        mobileAspectRatio: '4:3',
      },
    );

    assert.deepEqual(
      resolveEffectiveEcommerceAPlusPolicy({
        detectedSizeTier: 'unknown',
        controlMode: 'auto',
      }),
      {
        detectedSizeTier: 'unknown',
        effectiveSizeTier: '970x600',
        effectiveSizePolicy: 'sheet-native',
        allowedAspectRatios: ['16:9'],
        defaultAspectRatio: '16:9',
        runtimeAspectRatio: '16:9',
        mobileAspectRatio: undefined,
      },
    );
  });

  test('lets the global A+ control mode override the detected tier without changing main-image constraints', () => {
    const policy = resolveEffectiveEcommerceAPlusPolicy({
      detectedSizeTier: '1464x600',
      controlMode: '600x450',
    });

    assert.equal(policy.detectedSizeTier, '1464x600');
    assert.equal(policy.effectiveSizeTier, '600x450');
    assert.equal(policy.effectiveSizePolicy, 'sheet-native');
    assert.equal(policy.runtimeAspectRatio, '4:3');
    assert.deepEqual(policy.allowedAspectRatios, ['4:3']);
    assert.equal(policy.mobileAspectRatio, undefined);
  });

  test('resolves prompt bar aspect context to the main-image policy when no ecommerce sheet is active', () => {
    assert.deepEqual(
      resolveEcommercePromptBarAspectContext({}),
      {
        activeSheet: '\u4e3b\u56fe',
        allowedAspectRatios: ['auto', '1:1', '3:4'],
        defaultAspectRatio: 'auto',
      },
    );
  });

  test('resolves prompt bar aspect context to the active A+ sheet settings when no task override exists', () => {
    assert.deepEqual(
      resolveEcommercePromptBarAspectContext({
        activeSheet: 'A+',
        sheetSettings: {
          'A+': {
            aspectRatio: '16:9',
            imageSize: '4K',
            aPlusControlMode: '970x600',
          } as any,
        },
      }),
      {
        activeSheet: 'A+',
        allowedAspectRatios: ['16:9'],
        defaultAspectRatio: '16:9',
      },
    );
  });

  test('keeps all main-image ecommerce ratios visible when the sheet default is auto', () => {
    assert.deepEqual(
      resolveEcommercePromptBarAspectContext({
        activeSheet: '\u4e3b\u56fe',
        sheetSettings: {
          '\u4e3b\u56fe': {
            aspectRatio: 'auto',
            aPlusControlMode: 'auto',
          },
        },
      }),
      {
        activeSheet: '\u4e3b\u56fe',
        allowedAspectRatios: ['auto', '1:1', '3:4'],
        defaultAspectRatio: 'auto',
      },
    );
  });

  test('resolves prompt bar aspect context to the active A+ task override before applying generic ecommerce guards', () => {
    assert.deepEqual(
      resolveEcommercePromptBarAspectContext({
        activeTask: {
          sourceSheet: 'A+',
          sizeTier: '1464x600',
          sizeControlOverride: '600x450',
        },
      }),
      {
        activeSheet: 'A+',
        allowedAspectRatios: ['4:3'],
        defaultAspectRatio: '4:3',
      },
    );

    assert.deepEqual(
      resolveEcommercePromptBarAspectContext({
        activeTask: {
          sourceSheet: 'A+',
          sizeTier: '1464x600',
          sizeControlOverride: null,
        },
        ratioOverride: ['21:9'],
      }),
      {
        activeSheet: 'A+',
        allowedAspectRatios: ['21:9'],
        defaultAspectRatio: '21:9',
      },
    );
  });
});
