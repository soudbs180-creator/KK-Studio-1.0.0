import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEcommerceAssetRoleBindings } from '../../apps/web/src/services/ecommerce/assetRoleBindings.ts';

test('buildEcommerceAssetRoleBindings resets reference labels per item and assigns stable @ anchors', () => {
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
      token: binding.token,
      roleLabel: binding.roleLabel,
    })),
    [
      { role: 'reference', label: '参考图1', normalizedLabel: '参考图1', aliasLabel: '@需求参考-heet-ref-3', token: '@需求参考-heet-ref-3', roleLabel: '需求参考' },
      { role: 'reference', label: '参考图2', normalizedLabel: '参考图2', aliasLabel: '@需求参考-heet-ref-4', token: '@需求参考-heet-ref-4', roleLabel: '需求参考' },
      { role: 'product', label: '产品图1', normalizedLabel: '产品图', aliasLabel: '@产品主图', token: '@产品主图', roleLabel: '产品主图' },
      { role: 'extra-reference', label: '补充参考图1', normalizedLabel: '补充参考图1', aliasLabel: '@风格参考', token: '@风格参考', roleLabel: '风格参考' },
    ],
  );
});
