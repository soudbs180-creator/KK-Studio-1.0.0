import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  buildMinimapSpatialIndex,
  selectMinimapVisibleNodes,
  type MinimapIndexNode,
} from '../../apps/web/src/app/minimapSpatialIndex.ts';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function minimapNode(id: string, x: number, y: number, kind: 'prompt' | 'image' = 'image'): MinimapIndexNode {
  return {
    id,
    position: { x, y },
    hiddenInCanvas: false,
    ...(kind === 'image' ? { url: `data:image/png;base64,${id}` } : {}),
  };
}

test('minimap spatial index queries 10000 canvas nodes without scanning the whole set per render', () => {
  const promptNodes: MinimapIndexNode[] = [];
  const imageNodes: MinimapIndexNode[] = [];

  for (let i = 0; i < 2000; i += 1) {
    promptNodes.push(minimapNode(`prompt-${i}`, (i % 100) * 900, Math.floor(i / 100) * 1200, 'prompt'));
  }

  for (let i = 0; i < 10000; i += 1) {
    imageNodes.push(minimapNode(`image-${i}`, (i % 125) * 760, Math.floor(i / 125) * 760, 'image'));
  }

  let index = buildMinimapSpatialIndex(promptNodes, imageNodes);
  const indexDurationsMs: number[] = [];
  for (let sample = 0; sample < 3; sample += 1) {
    const indexStartedAt = performance.now();
    index = buildMinimapSpatialIndex(promptNodes, imageNodes);
    indexDurationsMs.push(performance.now() - indexStartedAt);
  }
  const indexDurationMs = Math.min(...indexDurationsMs);

  let visibleNodes = selectMinimapVisibleNodes(index, -200, -200, 2400, 1800);
  const queryDurationsMs: number[] = [];
  for (let sample = 0; sample < 3; sample += 1) {
    const queryStartedAt = performance.now();
    visibleNodes = selectMinimapVisibleNodes(index, -200, -200, 2400, 1800);
    queryDurationsMs.push(performance.now() - queryStartedAt);
  }
  const queryDurationMs = Math.min(...queryDurationsMs);

  assert.equal(index.totalNodeCount, 12000);
  assert.ok(visibleNodes.length > 0);
  assert.ok(visibleNodes.length < 80, `Expected minimap query to return a bounded visible subset, got ${visibleNodes.length}`);
  assert.ok(indexDurationMs < 40, `Expected minimap index build under 40ms, got ${indexDurationMs.toFixed(2)}ms`);
  assert.ok(queryDurationMs < 2, `Expected minimap query under 2ms, got ${queryDurationMs.toFixed(2)}ms`);
});

test('AppCanvasNavigationPanel renders minimap nodes from a spatial-index query', () => {
  const source = readSource('apps/web/src/app/AppCanvasNavigationPanel.tsx');

  assert.match(source, /buildMinimapSpatialIndex\(/);
  assert.match(source, /selectMinimapVisibleNodes\(/);
  assert.doesNotMatch(source, /const visibleNodes = \[\s*\.\.\.promptNodes\.filter/s);
  assert.doesNotMatch(source, /visibleNodes\s*\.filter\(\(node: any\) => \{[\s\S]*\.map\(\(node: any\) => \{/);
});
