import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEcommerceCanvasGroupLayout } from '../../src/services/ecommerce/groupCanvasLayout.ts';

test('buildEcommerceCanvasGroupLayout places main and A+ shells into fixed left/right columns with vertical slots', () => {
  const plan = buildEcommerceCanvasGroupLayout({
    basePosition: { x: 1000, y: 600 },
    mainSlotKeys: ['main-1', 'main-2'],
    aPlusSlotKeys: ['aplus-1', 'aplus-2', 'aplus-3'],
  });

  assert.deepEqual(plan.mainGroup.position, { x: 1000, y: 600 });
  assert.deepEqual(plan.aPlusGroup.position, { x: 1940, y: 600 });

  assert.deepEqual(
    plan.mainGroup.slots.map((slot) => ({ slotId: slot.slotId, sourceKey: slot.sourceKey, position: slot.position })),
    [
      { slotId: 'main-slot-1', sourceKey: 'main-1', position: { x: 1000, y: 780 } },
      { slotId: 'main-slot-2', sourceKey: 'main-2', position: { x: 1000, y: 1000 } },
    ],
  );

  assert.deepEqual(
    plan.aPlusGroup.slots.map((slot) => ({ slotId: slot.slotId, sourceKey: slot.sourceKey, position: slot.position })),
    [
      { slotId: 'aplus-slot-1', sourceKey: 'aplus-1', position: { x: 1940, y: 780 } },
      { slotId: 'aplus-slot-2', sourceKey: 'aplus-2', position: { x: 1940, y: 1000 } },
      { slotId: 'aplus-slot-3', sourceKey: 'aplus-3', position: { x: 1940, y: 1220 } },
    ],
  );
});

test('buildEcommerceCanvasGroupLayout keeps stable group metadata for later pack/export wiring', () => {
  const plan = buildEcommerceCanvasGroupLayout({
    basePosition: { x: 500, y: 400 },
    mainSlotKeys: ['main-only'],
    aPlusSlotKeys: [],
  });

  assert.equal(plan.mainGroup.groupKey, 'main');
  assert.equal(plan.mainGroup.label, '主图');
  assert.equal(plan.mainGroup.exportLabel, '主图包');
  assert.equal(plan.aPlusGroup.groupKey, 'aplus');
  assert.equal(plan.aPlusGroup.label, 'A+');
  assert.equal(plan.aPlusGroup.exportLabel, 'A+包');
  assert.equal(plan.aPlusGroup.slots.length, 0);
});
