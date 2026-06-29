import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';

import {
  buildCanvasLayerMetaLookup,
  buildViewportImageLoadScheduling,
  selectCanvasLayerMetasForPaint,
} from '../../apps/web/src/canvas/largeCanvasVirtualization.ts';
import { ImageQuality } from '../../apps/web/src/services/image/imageQuality.ts';
import type { CachedCardMeta } from '../../apps/web/src/services/storage/offlineDb.ts';

test('CanvasLayerRenderer paints from visible ids instead of scanning every cached meta', () => {
  const rendererSource = readSource('apps/web/src/components/canvas/CanvasLayerRenderer.tsx');
  const helperSource = readSource('apps/web/src/canvas/largeCanvasVirtualization.ts');

  assert.match(rendererSource, /buildCanvasLayerMetaLookup/);
  assert.match(rendererSource, /selectCanvasLayerMetasForPaint/);
  assert.match(helperSource, /visibleCardIds\.forEach/);
  assert.doesNotMatch(rendererSource, /cardMetas\.forEach/);
});

test('Workspace image scheduling is bounded to visible image nodes for huge canvases', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const scheduleStart = appSource.indexOf('const imageLoadSchedulingById = React.useMemo(() => {');
  const scheduleEnd = appSource.indexOf('useEffect(() => {', scheduleStart);

  assert.notEqual(scheduleStart, -1);
  assert.notEqual(scheduleEnd, -1);

  const scheduleSource = appSource.slice(scheduleStart, scheduleEnd);

  assert.match(scheduleSource, /buildViewportImageLoadScheduling/);
  assert.match(scheduleSource, /imageNodes:\s*visibleImageNodes/);
  assert.doesNotMatch(scheduleSource, /activeCanvas\.imageNodes\.forEach/);
});

test('canvas layer meta selection stays proportional to visible ids with 10000 cached cards', () => {
  const metas: CachedCardMeta[] = Array.from({ length: 10000 }, (_, index) => ({
    id: `image-${index}`,
    x: index * 12,
    y: index * 8,
    width: 400,
    height: 600,
    type: 'image',
    thumbnailUrl: `blob:local-${index}`,
    updatedAt: index,
  }));

  metas.push({
    id: 'prompt-visible',
    x: 0,
    y: 0,
    width: 360,
    height: 200,
    type: 'prompt',
    updatedAt: 10001,
  });

  const lookup = buildCanvasLayerMetaLookup(metas);
  const visibleIds = new Set(['image-9', 'image-2500', 'image-9000', 'prompt-visible', 'missing-image']);
  const selectedIds = new Set(['image-2500']);

  const start = performance.now();
  const selected = selectCanvasLayerMetasForPaint({
    cardMetaById: lookup,
    visibleCardIds: visibleIds,
    selectedNodeIds: selectedIds,
    activeSourceImage: 'image-9000',
  });
  const duration = performance.now() - start;

  assert.deepEqual(selected.map((meta) => meta.id), ['image-9']);
  assert.ok(duration < 2, `visible meta selection should stay tiny; got ${duration.toFixed(4)}ms`);
});

test('viewport image load scheduling only ranks provided near-viewport candidates', () => {
  const candidateNodes = Array.from({ length: 120 }, (_, index) => ({
    id: `candidate-${index}`,
    position: {
      x: index < 20 ? index * 30 : 8000 + index * 30,
      y: index < 20 ? 500 + index * 5 : 12000 + index * 20,
    },
  }));

  const farAwayNode = {
    id: 'far-away-not-provided',
    position: { x: 999999, y: 999999 },
  };

  const scheduling = buildViewportImageLoadScheduling({
    imageNodes: candidateNodes,
    collapsedCanvasGroupNodeIds: new Set(['candidate-4']),
    canvasTransform: { x: 0, y: 0, scale: 1 },
    viewportWidth: 1440,
    viewportHeight: 960,
  });

  assert.ok(scheduling.size <= candidateNodes.length);
  assert.equal(scheduling.has('candidate-4'), false);
  assert.equal(scheduling.has(farAwayNode.id), false);
  assert.equal(scheduling.get('candidate-0')?.loadBand, 0);
  assert.equal(scheduling.get('candidate-0')?.prefetchQuality, ImageQuality.PREVIEW);
});
