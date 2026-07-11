import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getAvailableCanvasViewport } from '../../apps/web/src/canvas/canvasAvailableViewport.ts';

test('available canvas viewport subtracts every chrome inset', () => {
  assert.deepEqual(getAvailableCanvasViewport(
    { width: 1200, height: 800 },
    { left: 56, right: 140, top: 72, bottom: 100 },
  ), {
    x: 56,
    y: 72,
    width: 1004,
    height: 628,
    centerX: 558,
    centerY: 386,
  });
});

test('restore and fit use scoped storage plus the measured available viewport', () => {
  const infinite = fs.readFileSync('apps/web/src/components/canvas/InfiniteCanvas.tsx', 'utf8');
  const viewport = fs.readFileSync('apps/web/src/hooks/useCanvasViewport.ts', 'utf8');
  assert.match(infinite, /measureCanvasViewportInsets/);
  assert.match(infinite, /restoreFocusBounds/);
  assert.match(infinite, /createCanvasFitTransform\(sceneBounds, available/);
  assert.doesNotMatch(infinite, /localStorage\.getItem\('kk_canvas_view'\)/);
  assert.match(viewport, /window\.visualViewport\?\.addEventListener\('resize'/);
  assert.match(viewport, /measureCanvasViewportInsets/);
});
