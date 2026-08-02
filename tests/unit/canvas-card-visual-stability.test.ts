import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveStableCanvasDetailLevel } from '../../apps/web/src/hooks/useCanvasRenderItems.ts';
import { readSource } from '../support/workspacePaths.js';

test('mounted canvas cards keep their full visual structure through pan and zoom', () => {
  for (const scale of [0.1, 0.35, 0.7, 1, 2]) {
    assert.equal(resolveStableCanvasDetailLevel({ scale, isCanvasTransforming: false }), 'full');
    assert.equal(resolveStableCanvasDetailLevel({ scale, isCanvasTransforming: true }), 'full');
  }
});

test('workspace no longer uses performance LOD to rewrite mounted card detail', () => {
  const source = readSource('apps/web/src/hooks/useCanvasRenderItems.ts');

  assert.doesNotMatch(source, /detailLevel = isHighPriority \? 'compact' : 'ghost'/);
  assert.match(source, /resolveStableCanvasDetailLevel/);
});
