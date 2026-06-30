import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('large-project canvas underlay only receives standalone image card metas', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const metaBuildStart = appSource.indexOf('const sourceImages = isLargeProject ? visibleImageNodes : activeCanvas.imageNodes;');
  const metaBuildEnd = appSource.indexOf('setCardMetas(metas);', metaBuildStart);

  assert.notEqual(metaBuildStart, -1);
  assert.notEqual(metaBuildEnd, -1);

  const metaBuildSource = appSource.slice(metaBuildStart, metaBuildEnd);

  assert.doesNotMatch(metaBuildSource, /activeCanvas\.promptNodes\.forEach/);
  assert.match(metaBuildSource, /const sourceImages = isLargeProject \? visibleImageNodes : activeCanvas\.imageNodes;/);
  assert.match(metaBuildSource, /sourceImages\.forEach\(\(n\) => \{/);
  assert.match(metaBuildSource, /if \(n\.parentPromptId\) \{\s*return;\s*\}/);
});

test('CanvasLayerRenderer refuses to paint prompt shells over the React prompt-group layer', () => {
  const source = readSource('apps/web/src/components/canvas/CanvasLayerRenderer.tsx');
  const helperSource = readSource('apps/web/src/canvas/largeCanvasVirtualization.ts');

  assert.match(helperSource, /if \(meta\.type === 'image'\)/);
  assert.doesNotMatch(source, /type === 'prompt'/);
  assert.doesNotMatch(source, /fillText\('PROMPT CARD'/);
});
