import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEcommerceGroupExportManifest } from '../../apps/web/src/services/ecommerce/groupExportManifest.ts';

test('buildEcommerceGroupExportManifest derives exported, skipped, and missing slot states', () => {
  const manifest = buildEcommerceGroupExportManifest({
    packageType: 'main-image-group',
    groupId: 'group-main-1',
    groupLabel: 'main',
    sourcePromptId: 'prompt-main-group',
    slots: [
      {
        slotId: 'main-slot-1',
        slotLabel: 'main 1:1 4K',
        selectedForGeneration: true,
        latestImageId: 'image-main-1',
        latestSource: 'generated',
        fileName: '01-main-1x1-4k.png',
      },
      {
        slotId: 'main-slot-2',
        slotLabel: 'main 3:4 4K',
        selectedForGeneration: false,
      },
      {
        slotId: 'main-slot-3',
        slotLabel: 'main missing',
        selectedForGeneration: true,
      },
    ],
  });

  assert.equal(manifest.version, 1);
  assert.equal(manifest.packageType, 'main-image-group');
  assert.equal(manifest.groupLabel, 'main');
  assert.deepEqual(manifest.slots, [
    {
      slotId: 'main-slot-1',
      slotLabel: 'main 1:1 4K',
      status: 'exported',
      selectedForGeneration: true,
      latestImageId: 'image-main-1',
      latestSource: 'generated',
      fileName: '01-main-1x1-4k.png',
    },
    {
      slotId: 'main-slot-2',
      slotLabel: 'main 3:4 4K',
      status: 'skipped',
      selectedForGeneration: false,
    },
    {
      slotId: 'main-slot-3',
      slotLabel: 'main missing',
      status: 'missing',
      selectedForGeneration: true,
    },
  ]);
});

test('buildEcommerceGroupExportManifest keeps redraw as the preferred latest source', () => {
  const manifest = buildEcommerceGroupExportManifest({
    packageType: 'a-plus-group',
    groupId: 'group-aplus-1',
    groupLabel: 'A+',
    sourcePromptId: 'prompt-aplus-group',
    slots: [
      {
        slotId: 'aplus-slot-1',
        slotLabel: 'A+ 21:9 4K',
        selectedForGeneration: true,
        latestImageId: 'image-aplus-redraw',
        latestSource: 'redraw',
        fileName: '01-aplus-21x9-4k-redraw.png',
      },
    ],
  });

  assert.equal(manifest.slots[0]?.status, 'exported');
  assert.equal(manifest.slots[0]?.latestSource, 'redraw');
  assert.equal(manifest.slots[0]?.fileName, '01-aplus-21x9-4k-redraw.png');
});

test('buildEcommerceGroupExportManifest can record desktop and mobile deliverables for the same A+ slot', () => {
  const manifest = buildEcommerceGroupExportManifest({
    packageType: 'a-plus-group',
    groupId: 'group-aplus-2',
    groupLabel: 'A+',
    sourcePromptId: 'prompt-aplus-group',
    slots: [
      {
        slotId: 'aplus-slot-2',
        slotLabel: 'A+ 1464x600 staged module',
        selectedForGeneration: true,
        deliverables: [
          {
            deliveryKind: 'desktop',
            latestImageId: 'image-aplus-desktop',
            latestSource: 'generated',
            fileName: '01-aplus-desktop-original.png',
          },
          {
            deliveryKind: 'mobile',
            latestImageId: 'image-aplus-mobile',
            latestSource: 'redraw',
            fileName: '01-aplus-mobile-original.png',
          },
        ],
      },
    ],
  });

  assert.deepEqual(manifest.slots, [
    {
      slotId: 'aplus-slot-2',
      slotLabel: 'A+ 1464x600 staged module',
      status: 'exported',
      selectedForGeneration: true,
      deliverables: [
        {
          deliveryKind: 'desktop',
          status: 'exported',
          latestImageId: 'image-aplus-desktop',
          latestSource: 'generated',
          fileName: '01-aplus-desktop-original.png',
        },
        {
          deliveryKind: 'mobile',
          status: 'exported',
          latestImageId: 'image-aplus-mobile',
          latestSource: 'redraw',
          fileName: '01-aplus-mobile-original.png',
        },
      ],
    },
  ]);
});
