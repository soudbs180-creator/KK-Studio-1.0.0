import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clampFloatingToolbarPosition } from '../../apps/web/src/components/canvas/floatingToolbarPosition.ts';
import { readSource } from '../support/workspacePaths.js';

test('drawing toolbar stays inside the viewport after drag or resize', () => {
  assert.deepEqual(
    clampFloatingToolbarPosition(
      { x: -40, y: 900 },
      { width: 420, height: 44 },
      { width: 1099, height: 720 },
    ),
    { x: 8, y: 668 },
  );
});

test('drawing toolbar uses a dedicated pointer-captured handle and compact controls', () => {
  const source = readSource('apps/web/src/components/canvas/CanvasDrawingToolbar.tsx');

  assert.match(source, /data-drawing-toolbar-handle="true"/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /DRAWING_TOOLBAR_STORAGE_KEY/);
  assert.match(source, /h-8 w-8/);
});
