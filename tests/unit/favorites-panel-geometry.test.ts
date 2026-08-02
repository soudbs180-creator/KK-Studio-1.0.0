import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  FAVORITES_PANEL_MIN_HEIGHT,
  FAVORITES_PANEL_MIN_WIDTH,
  clampFavoritesPanelGeometry,
  resizeFavoritesPanelGeometry,
} from '../../apps/web/src/features/favorites/favoritesPanelGeometry.ts';

const start = {
  schemaVersion: 2 as const,
  x: 40,
  y: 30,
  width: 720,
  height: 600,
};

test('favorites geometry clamps to viewport margin and minimum size', () => {
  const result = clampFavoritesPanelGeometry({
    ...start,
    x: -100,
    y: -100,
    width: 100,
    height: 100,
  }, { width: 1200, height: 800 });
  assert.equal(result.x, 12);
  assert.equal(result.y, 12);
  assert.equal(result.width, FAVORITES_PANEL_MIN_WIDTH);
  assert.equal(result.height, FAVORITES_PANEL_MIN_HEIGHT);
});

test('favorites corner resize preserves aspect ratio', () => {
  const result = resizeFavoritesPanelGeometry(
    start,
    'proportional',
    120,
    10,
    { width: 1440, height: 1000 },
  );
  assert.equal(result.width / result.height, start.width / start.height);
});

test('favorites panel persists schemaVersion geometry and exposes edge/corner handles only on desktop', () => {
  const source = fs.readFileSync('apps/web/src/features/favorites/FavoritesPanel.tsx', 'utf8');
  assert.match(source, /schemaVersion/);
  assert.match(source, /workspace-favorites-resize-handle is-width/);
  assert.match(source, /workspace-favorites-resize-handle is-height/);
  assert.match(source, /workspace-favorites-resize-handle is-proportional/);
  assert.match(source, /!isMobile/);
});
