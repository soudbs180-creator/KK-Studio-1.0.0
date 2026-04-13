import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEcommerceGroupExportManifest } from '../../src/services/ecommerce/groupExportManifest.ts';

test('buildEcommerceGroupExportManifest derives exported, skipped, and missing slot states', () => {
  const manifest = buildEcommerceGroupExportManifest({
    packageType: 'main-image-group',
    groupId: 'group-main-1',
    groupLabel: '主图',
    sourcePromptId: 'prompt-main-group',
    slots: [
      {
        slotId: 'main-slot-1',
        slotLabel: '主图 1:1 4K',
        selectedForGeneration: true,
        latestImageId: 'image-main-1',
        latestSource: 'generated',
        fileName: '01-main-1x1-4k.png',
      },
      {
        slotId: 'main-slot-2',
        slotLabel: '主图 3:4 4K',
        selectedForGeneration: false,
      },
      {
        slotId: 'main-slot-3',
        slotLabel: '主图 4:5 4K',
        selectedForGeneration: true,
      },
    ],
  });

  assert.equal(manifest.version, 1);
  assert.equal(manifest.packageType, 'main-image-group');
  assert.equal(manifest.groupLabel, '主图');
  assert.deepEqual(manifest.slots, [
    {
      slotId: 'main-slot-1',
      slotLabel: '主图 1:1 4K',
      status: 'exported',
      selectedForGeneration: true,
      latestImageId: 'image-main-1',
      latestSource: 'generated',
      fileName: '01-main-1x1-4k.png',
    },
    {
      slotId: 'main-slot-2',
      slotLabel: '主图 3:4 4K',
      status: 'skipped',
      selectedForGeneration: false,
    },
    {
      slotId: 'main-slot-3',
      slotLabel: '主图 4:5 4K',
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
