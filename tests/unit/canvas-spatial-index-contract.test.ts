import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const spatialIndexSource = () => readSource('apps/web/src/canvas/CanvasSpatialIndex.ts');
const spatialHookSource = () => readSource('apps/web/src/app/useCanvasSpatialIndex.ts');
const visibleItemsSource = () => readSource('apps/web/src/app/useVisibleCanvasItems.ts');
const workspaceSource = () => readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');

test('CanvasSpatialIndex uses grid buckets and viewport queries', () => {
  const source = spatialIndexSource();

  assert.match(source, /class CanvasSpatialIndex/);
  assert.match(source, /private buckets = new Map<string, Set<string>>/);
  assert.match(source, /private nodeBounds = new Map<string, CanvasNodeBounds>/);
  assert.match(source, /const startX = Math\.floor\(vLeft \/ this\.bucketSize\)/);
  assert.match(source, /const endX = Math\.floor\(vRight \/ this\.bucketSize\)/);
  assert.match(source, /bucket\.forEach\(\(nodeId\) => result\.add\(nodeId\)\)/);
});

test('useCanvasSpatialIndex indexes prompt image and workflow nodes with lookup maps', () => {
  const source = spatialHookSource();

  assert.match(source, /new CanvasSpatialIndex\(1000\)/);
  assert.match(source, /const promptNodeById = new Map<string, PromptNode>\(\)/);
  assert.match(source, /const imageNodeById = new Map<string, GeneratedImage>\(\)/);
  assert.match(source, /const workflowNodeById = new Map<string, WorkflowUtilityCanvasNode>\(\)/);
  assert.match(source, /activeCanvas\.promptNodes\.forEach/);
  assert.match(source, /activeCanvas\.imageNodes\.forEach/);
  assert.match(source, /workflowNodes\.forEach/);
});

test('useVisibleCanvasItemsNew avoids O(N) culling loops and queries spatial index', () => {
  const source = visibleItemsSource();

  assert.match(source, /export function useVisibleCanvasItemsNew/);
  assert.doesNotMatch(
    source,
    /activeCanvas\.promptNodes\.filter\([^)]*visibleIds\.has/,
    'Should not filter the entire promptNodes list based on visibleIds'
  );
  assert.doesNotMatch(
    source,
    /activeCanvas\.imageNodes\.filter\([^)]*visibleIds\.has/,
    'Should not filter the entire imageNodes list based on visibleIds'
  );
  assert.match(source, /const visibleIds = spatialIndex\.query\(vLeft, vTop, vRight, vBottom\)/);
  assert.match(source, /visibleIds\.forEach\(/);
  assert.match(source, /promptNodeById\.get\(/);
  assert.match(source, /imageNodeById\.get\(/);
});

test('visible canvas items preserve interaction state during transforms', () => {
  const source = visibleItemsSource();

  assert.match(source, /if \(isNodeDragActive\) \{\s*return stableVisibleCanvasSceneRef\.current;/);
  assert.match(source, /if \(isCanvasTransforming\) \{\s*return stableVisibleCanvasSceneRef\.current;/);
  assert.match(source, /selectedNodeIds\.forEach\(\(id\) => \{/);
  assert.match(source, /if \(draftNodeId && !visibleIds\.has\(draftNodeId\)\)/);
});


