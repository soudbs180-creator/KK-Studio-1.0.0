import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clampNormalizedRect,
  expandSelectionToAspectRatio,
  resolvePixelRect,
  resolveRelativeSelectionRect,
} from '../../src/services/image/partialRedraw.ts';

test('expandSelectionToAspectRatio grows the selection outward to the target ratio without leaving image bounds', () => {
  const selection = { x: 0.42, y: 0.2, width: 0.1, height: 0.27 };
  const sourceSize = { width: 2400, height: 1600 };
  const result = expandSelectionToAspectRatio(
    selection,
    sourceSize,
    '16:9',
  );

  assert.equal(result.x >= 0, true);
  assert.equal(result.y >= 0, true);
  assert.equal(result.x + result.width <= 1, true);
  assert.equal(result.y + result.height <= 1, true);
  assert.equal(result.x <= selection.x, true);
  assert.equal(result.y <= selection.y, true);
  assert.equal(result.x + result.width >= selection.x + selection.width, true);
  assert.equal(result.y + result.height >= selection.y + selection.height, true);

  const expandedPixelRect = resolvePixelRect(result, sourceSize);
  const pixelRatio = Number((expandedPixelRect.width / expandedPixelRect.height).toFixed(4));
  assert.equal(pixelRatio, Number((16 / 9).toFixed(4)));
});

test('resolveRelativeSelectionRect maps the inner redraw slice inside the expanded crop', () => {
  const selection = { x: 0.4, y: 0.3, width: 0.15, height: 0.1 };
  const generation = { x: 0.25, y: 0.2, width: 0.4, height: 0.225 };
  const result = resolveRelativeSelectionRect(selection, generation);

  assert.equal(Math.abs(result.x - 0.375) < 1e-9, true);
  assert.equal(Math.abs(result.y - 0.4444444444444444) < 1e-9, true);
  assert.equal(Math.abs(result.width - 0.375) < 1e-9, true);
  assert.equal(Math.abs(result.height - 0.4444444444444444) < 1e-9, true);
});

test('resolvePixelRect rounds normalized rectangles against source dimensions', () => {
  assert.deepEqual(
    resolvePixelRect({ x: 0.125, y: 0.2, width: 0.25, height: 0.3 }, { width: 2000, height: 1000 }),
    { x: 250, y: 200, width: 500, height: 300 },
  );

  assert.deepEqual(
    clampNormalizedRect({ x: -0.05, y: 0.92, width: 0.2, height: 0.2 }),
    { x: 0, y: 0.8, width: 0.2, height: 0.2 },
  );
});
