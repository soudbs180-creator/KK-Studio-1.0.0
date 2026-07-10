import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeCanvasLayoutItems, resolveCanvasLayoutBounds } from '../../apps/web/src/canvas/canvasLayoutService.ts';

const items = [
  { id: 'a', position: { x: 0, y: 320 }, width: 280, height: 320 },
  { id: 'b', position: { x: 500, y: 320 }, width: 280, height: 320 },
];

test('canvas layout service preserves the selection center while arranging a row', () => {
  const result = arrangeCanvasLayoutItems(items, { mode: 'row', gap: 120 });

  assert.deepEqual(result.positions, {
    a: { x: 0, y: 320 },
    b: { x: 400, y: 320 },
  });
  assert.deepEqual(result.bounds, { x: -140, y: 0, width: 680, height: 320 });
});

test('canvas layout service uses explicit columns and real dimensions for a grid', () => {
  const result = arrangeCanvasLayoutItems([
    ...items,
    { id: 'c', position: { x: 900, y: 500 }, width: 420, height: 200 },
  ], { mode: 'grid', gap: 40, columns: 2 });

  assert.equal(Object.keys(result.positions).length, 3);
  assert.equal(result.positions.c.y > result.positions.a.y, true);
  assert.equal(result.bounds?.width, 810);
});

test('canvas layout bounds reads bottom-center card coordinates', () => {
  assert.deepEqual(resolveCanvasLayoutBounds(items), {
    x: -140,
    y: 0,
    width: 780,
    height: 320,
  });
});
