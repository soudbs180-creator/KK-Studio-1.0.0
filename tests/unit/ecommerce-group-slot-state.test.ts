import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildInitialEcommerceGroupSlotState,
  applyEcommerceSlotResult,
  buildEcommerceSlotPreviewBundle,
} from '../../src/services/ecommerce/groupSlotState.ts';

test('buildInitialEcommerceGroupSlotState creates stable slots with selected state per source key', () => {
  const state = buildInitialEcommerceGroupSlotState({
    groupKey: 'main',
    slots: [
      { slotId: 'main-slot-1', sourceKey: 'main-1' },
      { slotId: 'main-slot-2', sourceKey: 'main-2' },
    ],
    selectedItems: {
      'main-1': true,
      'main-2': false,
    },
  });

  assert.deepEqual(state, [
    {
      slotId: 'main-slot-1',
      groupKey: 'main',
      sourceKey: 'main-1',
      selected: true,
      currentImageId: null,
      currentSource: null,
      history: [],
    },
    {
      slotId: 'main-slot-2',
      groupKey: 'main',
      sourceKey: 'main-2',
      selected: false,
      currentImageId: null,
      currentSource: null,
      history: [],
    },
  ]);
});

test('applyEcommerceSlotResult replaces current slot result and preserves version history', () => {
  const initial = buildInitialEcommerceGroupSlotState({
    groupKey: 'aplus',
    slots: [{ slotId: 'aplus-slot-1', sourceKey: 'aplus-1' }],
    selectedItems: { 'aplus-1': true },
  });

  const afterGenerated = applyEcommerceSlotResult(initial, {
    slotId: 'aplus-slot-1',
    imageId: 'image-v1',
    source: 'generated',
  });
  const afterRedraw = applyEcommerceSlotResult(afterGenerated, {
    slotId: 'aplus-slot-1',
    imageId: 'image-v2',
    source: 'redraw',
  });

  assert.deepEqual(afterGenerated[0], {
    slotId: 'aplus-slot-1',
    groupKey: 'aplus',
    sourceKey: 'aplus-1',
    selected: true,
    currentImageId: 'image-v1',
    currentSource: 'generated',
    history: [
      { imageId: 'image-v1', source: 'generated' },
    ],
  });

  assert.deepEqual(afterRedraw[0], {
    slotId: 'aplus-slot-1',
    groupKey: 'aplus',
    sourceKey: 'aplus-1',
    selected: true,
    currentImageId: 'image-v2',
    currentSource: 'redraw',
    history: [
      { imageId: 'image-v1', source: 'generated' },
      { imageId: 'image-v2', source: 'redraw' },
    ],
  });
});

test('buildEcommerceSlotPreviewBundle keeps slot history order and focuses the requested version', () => {
  const initial = buildInitialEcommerceGroupSlotState({
    groupKey: 'main',
    slots: [{ slotId: 'main-slot-1', sourceKey: 'main-1' }],
    selectedItems: { 'main-1': true },
  });

  const afterGenerated = applyEcommerceSlotResult(initial, {
    slotId: 'main-slot-1',
    imageId: 'image-v1',
    source: 'generated',
  });
  const afterRedraw = applyEcommerceSlotResult(afterGenerated, {
    slotId: 'main-slot-1',
    imageId: 'image-v2',
    source: 'redraw',
  });

  const imagesById = new Map([
    ['image-v1', { id: 'image-v1', label: 'generated' }],
    ['image-v2', { id: 'image-v2', label: 'redraw' }],
  ]);

  const bundle = buildEcommerceSlotPreviewBundle(afterRedraw[0], imagesById, 'image-v1');

  assert.deepEqual(bundle, {
    images: [
      { id: 'image-v1', label: 'generated' },
      { id: 'image-v2', label: 'redraw' },
    ],
    initialIndex: 0,
  });
});
