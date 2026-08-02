import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeCenteredZoomTransform } from '../../apps/web/src/app/canvasNavigationMath.ts';
import { readSource } from '../support/workspacePaths.js';

test('zoom controls preserve the current world-space center in both map states', () => {
  assert.deepEqual(
    computeCenteredZoomTransform({ centerX: 200, centerY: 100, viewportWidth: 1000, viewportHeight: 800, scale: 2 }),
    { x: 100, y: 200, scale: 2 },
  );
});

test('navigation keeps zoom, arrange, and map toggle operable in one persistent bottom bar', () => {
  const source = readSource('apps/web/src/app/AppCanvasNavigationPanel.tsx');
  const persistentBar = source.match(/data-canvas-navigation-bar="true"[\s\S]*data-canvas-minimap-toggle="true"/)?.[0] || '';

  assert.match(source, /const miniWidth = 280/);
  assert.match(source, /const miniHeight = 156/);
  assert.match(source, /data-minimap-confirmation="true"/);
  assert.doesNotMatch(source, />导航小地图</);
  assert.doesNotMatch(source, /data-canvas-navigation-action="fitToAll"/);
  assert.doesNotMatch(source, /data-canvas-navigation-action="resetView"/);
  assert.match(persistentBar, /data-canvas-zoom-control="true"[\s\S]*data-canvas-navigation-action="autoArrange"[\s\S]*data-canvas-minimap-toggle="true"/);
});
