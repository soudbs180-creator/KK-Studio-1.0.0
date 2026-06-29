import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('large-project canvas underlay only receives standalone image card metas', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const metaBuildStart = appSource.indexOf('const metas: CachedCardMeta[] = [];');
  const metaBuildEnd = appSource.indexOf('setCardMetas(metas);', metaBuildStart);

  assert.notEqual(metaBuildStart, -1);
  assert.notEqual(metaBuildEnd, -1);

  const metaBuildSource = appSource.slice(metaBuildStart, metaBuildEnd);

  assert.doesNotMatch(metaBuildSource, /activeCanvas\.promptNodes\.forEach/);
  assert.match(metaBuildSource, /activeCanvas\.imageNodes\s*\.filter\(\(n\) => !n\.parentPromptId\)\s*\.forEach/);
});

test('CanvasLayerRenderer refuses to paint prompt shells over the React prompt-group layer', () => {
  const source = readSource('apps/web/src/components/canvas/CanvasLayerRenderer.tsx');

  assert.match(source, /if \(meta\.type !== 'image'\) return;/);
  assert.doesNotMatch(source, /type === 'prompt'/);
  assert.doesNotMatch(source, /fillText\('PROMPT CARD'/);
});
