import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('useVisibleCanvasItemsNew avoids O(N) culling loops and queries spatial index', () => {
  const source = readSource('apps/web/src/app/useVisibleCanvasItems.ts');

  // 契约：必须引入新版极速查询 Hook
  assert.match(source, /export function useVisibleCanvasItemsNew/);

  // 契约：空间裁剪必须使用 O(1) 的 Lookup 模式，不得遍历全量 activeCanvas 节点进行可视筛选
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

  // 契约：必须基于空间查询得出的 visibleIds 集合进行 forEach Lookup 收集
  assert.match(source, /visibleIds\.forEach\(/);
  assert.match(source, /promptNodeById\.get\(/);
  assert.match(source, /imageNodeById\.get\(/);

  // 契约：必须强制保留 selected 节点和正在编辑的 draft 节点以防 unmount 状态丢失
  assert.match(source, /selectedNodeIds\.forEach\(/);
  assert.match(source, /draftNodeId/);
});

test('useCanvasSpatialIndex correctly indexes prompt and image bounds', () => {
  const source = readSource('apps/web/src/app/useCanvasSpatialIndex.ts');

  assert.match(source, /export function useCanvasSpatialIndex/);
  assert.match(source, /index\.updateNode/);
  assert.match(source, /promptNodeById/);
  assert.match(source, /imageNodeById/);
});
