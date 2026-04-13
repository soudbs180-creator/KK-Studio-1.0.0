import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveEcommercePromptNodeMetadata } from '../../src/services/ecommerce/ecommercePromptNodeMetadata.ts';

test('main-image metadata resolves source row key and theme from the main image item', () => {
  const result = resolveEcommercePromptNodeMetadata({
    kind: 'main-image',
    item: {
      itemId: 'main-12',
      sheet: '涓诲浘',
      rowIndex: 12,
      sequence: 1,
      type: 'hero',
      angle: 'front',
      theme: '晨光护肤主图',
      designRequirements: '',
      copyText: '',
      sizePolicy: 'sheet-native',
      referenceAssetIds: [],
      referenceMentions: [],
      productAssetRequired: true,
      promptDraft: 'hero prompt',
      needsReview: false,
      reviewWarnings: [],
    },
  });

  assert.deepEqual(result, {
    sourceSheet: '主图',
    sourceRowKey: 'main-12',
    theme: '晨光护肤主图',
  });
});

test('a-plus metadata resolves source row key and theme from the module item', () => {
  const result = resolveEcommercePromptNodeMetadata({
    kind: 'a-plus-module',
    item: {
      moduleId: 'aplus-3',
      sheet: 'A+',
      rowIndex: 3,
      moduleName: '五点卖点组图',
      type: 'feature-grid',
      declaredSizeText: '1920x1080',
      angle: 'flat',
      sellingPoints: '卖点',
      designRequirements: '',
      copyText: '',
      sizePolicy: 'desktop-then-mobile',
      referenceAssetIds: [],
      referenceMentions: [],
      productAssetRequired: false,
      promptDraft: 'aplus prompt',
      needsReview: false,
      reviewWarnings: [],
    },
  });

  assert.deepEqual(result, {
    sourceSheet: 'A+',
    sourceRowKey: 'aplus-3',
    theme: '五点卖点组图',
  });
});
