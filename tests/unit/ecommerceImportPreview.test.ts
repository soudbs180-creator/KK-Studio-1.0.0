import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendUploadFilesWithinLimit,
  buildEcommerceUploadPreviewModel,
  removeUploadFileAtIndex,
} from '../../src/components/ecommerce/ecommerceImportPreview.ts';

type MockUploadFile = {
  name: string;
  type: string;
};

test('buildEcommerceUploadPreviewModel prefers analyzed product name and preserves grouped uploads', () => {
  const productFiles: MockUploadFile[] = [
    { name: 'thermos-product-1.png', type: 'image/png' },
    { name: 'thermos-product-2.png', type: 'image/png' },
  ];
  const extraReferenceFiles: MockUploadFile[] = [
    { name: 'kitchen-scene.jpg', type: 'image/jpeg' },
  ];

  const result = buildEcommerceUploadPreviewModel({
    analyzedProductName: '316 stainless thermos',
    productFiles,
    extraReferenceFiles,
  });

  assert.equal(result.productName, '316 stainless thermos');
  assert.equal(result.productNameSource, 'analysis');
  assert.equal(result.productItems.length, 2);
  assert.equal(result.extraReferenceItems.length, 1);
  assert.equal(result.productItems[0]?.displayLabel, 'thermos');
  assert.equal(result.extraReferenceItems[0]?.displayLabel, 'kitchen');
});

test('buildEcommerceUploadPreviewModel falls back to uploaded file names when no analyzed product exists', () => {
  const result = buildEcommerceUploadPreviewModel({
    analyzedProductName: '',
    productFiles: [
      { name: 'foldable-storage-box_product-03.webp', type: 'image/webp' },
    ],
    extraReferenceFiles: [],
  });

  assert.equal(result.productName, 'foldable storage box');
  assert.equal(result.productNameSource, 'file-name');
  assert.equal(result.productItems[0]?.displayLabel, 'foldable storage box');
});

test('removeUploadFileAtIndex removes only the targeted item', () => {
  const files: MockUploadFile[] = [
    { name: 'product-a.png', type: 'image/png' },
    { name: 'product-b.png', type: 'image/png' },
    { name: 'product-c.png', type: 'image/png' },
  ];

  const result = removeUploadFileAtIndex(files, 1);

  assert.deepEqual(result.map((file) => file.name), ['product-a.png', 'product-c.png']);
  assert.deepEqual(files.map((file) => file.name), ['product-a.png', 'product-b.png', 'product-c.png']);
});

test('appendUploadFilesWithinLimit keeps earlier files and caps total count', () => {
  const existing: MockUploadFile[] = [
    { name: 'a.png', type: 'image/png' },
    { name: 'b.png', type: 'image/png' },
    { name: 'c.png', type: 'image/png' },
  ];
  const incoming: MockUploadFile[] = [
    { name: 'd.png', type: 'image/png' },
    { name: 'e.png', type: 'image/png' },
  ];

  const result = appendUploadFilesWithinLimit(existing, incoming, 4);

  assert.deepEqual(result.map((file) => file.name), ['a.png', 'b.png', 'c.png', 'd.png']);
});
