import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEcommerceAssetRoleBindings } from '../../src/services/ecommerce/assetRoleBindings.ts';

test('buildEcommerceAssetRoleBindings resets reference labels per item and assigns unified figure aliases', () => {
  const bindings = buildEcommerceAssetRoleBindings({
    rowAssets: [
      { assetId: 'sheet-ref-3', label: '参考图3' },
      { assetId: 'sheet-ref-4', label: '参考图4' },
    ],
    rowMentions: [
      { assetId: 'sheet-ref-3', label: '参考图1', mentionTokens: ['参考图1'] },
      { assetId: 'sheet-ref-4', label: '参考图2', mentionTokens: ['参考图2'] },
    ],
    manualReferences: [],
    productReferences: [{ id: 'product-1', storageId: 'product-1' } as any],
    extraReferences: [{ id: 'extra-1', storageId: 'extra-1' } as any],
  });

  assert.deepEqual(
    bindings.map((binding) => ({
      role: binding.role,
      label: binding.label,
      normalizedLabel: binding.normalizedLabel,
      aliasLabel: binding.aliasLabel,
    })),
    [
      { role: 'reference', label: '参考图1', normalizedLabel: '参考图1', aliasLabel: '图1' },
      { role: 'reference', label: '参考图2', normalizedLabel: '参考图2', aliasLabel: '图2' },
      { role: 'product', label: '产品图1', normalizedLabel: '产品图', aliasLabel: '图3' },
      { role: 'extra-reference', label: '补充参考图1', normalizedLabel: '补充参考图1', aliasLabel: '图4' },
    ],
  );
});
