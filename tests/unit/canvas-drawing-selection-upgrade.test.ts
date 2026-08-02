import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clampDrawingWidth,
  normalizeDrawingHexColor,
  getDrawingBounds,
  selectCanvasDrawingsInBounds,
} from '../../apps/web/src/canvas/canvasDrawingUtils.ts';

test('drawing HEX input accepts six-digit colors and preserves invalid values', () => {
  assert.equal(normalizeDrawingHexColor('#ABCDEF'), '#abcdef');
  assert.equal(normalizeDrawingHexColor('10b981'), '#10b981');
  assert.equal(normalizeDrawingHexColor('#12345'), null);
  assert.equal(normalizeDrawingHexColor('#gggggg'), null);
});

test('drawing width is clamped to the compact toolbar range', () => {
  assert.equal(clampDrawingWidth(-4), 1);
  assert.equal(clampDrawingWidth(8.8), 9);
  assert.equal(clampDrawingWidth(99), 24);
});

test('drawing selection hits text and vector bounds without converting to a note', () => {
  const drawings = [
    { id: 'line', type: 'line' as const, points: [{ x: 10, y: 10 }, { x: 80, y: 10 }], color: '#ef4444', width: 3 },
    { id: 'text', type: 'text' as const, points: [{ x: 120, y: 60 }], color: '#3b82f6', width: 2, text: 'hello', fontSize: 18 },
  ];
  const bounds = getDrawingBounds(drawings[1]);
  assert.ok(bounds);
  assert.equal(selectCanvasDrawingsInBounds(drawings, { x: 0, y: 0, width: 95, height: 30 }).map((item) => item.id).join(','), 'line');
  assert.equal(selectCanvasDrawingsInBounds(drawings, { x: 110, y: 45, width: 120, height: 60 }).map((item) => item.id).join(','), 'text');
});
