import { test, expect } from 'vitest';
import { performance } from 'perf_hooks';
import { CanvasSpatialIndex } from '../../apps/web/src/canvas/CanvasSpatialIndex';
import { CanvasMeasurementScheduler } from '../../apps/web/src/canvas/CanvasMeasurementScheduler';
import { CanvasConnectorScheduler } from '../../apps/web/src/canvas/CanvasConnectorScheduler';
import { useCanvasSpatialIndex } from '../../apps/web/src/app/useCanvasSpatialIndex';
import { useVisibleCanvasItemsNew } from '../../apps/web/src/app/useVisibleCanvasItems';
import {
  buildCanvasLayerMetaLookup,
  buildViewportImageLoadScheduling,
  selectCanvasLayerMetasForPaint,
} from '../../apps/web/src/canvas/largeCanvasVirtualization';
import type { CachedCardMeta } from '../../apps/web/src/services/storage/offlineDb';

// Mock requestAnimationFrame for Node.js test runtime
if (typeof global !== 'undefined' && !(global as any).requestAnimationFrame) {
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);
  (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}

// 简体中文：模拟卡片节点数据
interface DummyPromptNode {
  id: string;
  prompt: string;
  originalPrompt: string;
  position: { x: number; y: number };
  height: number;
  timestamp: number;
  zIndex: number;
  mode: string;
  userMoved: boolean;
}

interface DummyImageNode {
  id: string;
  storageId: string;
  url: string;
  originalUrl: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  timestamp: number;
  zIndex: number;
  canvasId: string;
  parentPromptId: string;
  position: { x: number; y: number };
  userMoved: boolean;
}

function generateFixture(nodeCount: number) {
  const promptNodes: DummyPromptNode[] = [];
  const imageNodes: DummyImageNode[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const isPrompt = i % 2 === 0;
    const id = isPrompt ? `prompt-${i}` : `image-${i}`;
    
    // 离散化分布，模拟大画布上的节点排布
    const x = (i * 350) % 12000;
    const y = Math.floor((i * 350) / 12000) * 500;

    if (isPrompt) {
      promptNodes.push({
        id,
        prompt: `Prompt Node ${i}`,
        originalPrompt: `Prompt Node ${i}`,
        position: { x, y },
        height: 200 + (i % 5) * 30,
        timestamp: Date.now() - i * 1000,
        zIndex: i,
        mode: 'image',
        userMoved: false
      });
    } else {
      imageNodes.push({
        id,
        storageId: id,
        url: 'data:image/png;base64,placeholder',
        originalUrl: 'data:image/png;base64,placeholder',
        prompt: `Image Node ${i}`,
        aspectRatio: '1:1',
        imageSize: '1K',
        timestamp: Date.now() - i * 1000,
        zIndex: i,
        canvasId: 'default',
        parentPromptId: `prompt-${i - 1}`,
        position: { x, y: y + 350 },
        userMoved: false
      });
    }
  }

  return { promptNodes, imageNodes };
}

test('dense canvas performance benchmark and regression check', () => {
  const scales = [20, 100, 500];
  const results: any[] = [];

  // 性能预算红线阈值 (在 500 节点规模下，考虑 CI 机器可能存在的浮动)
  const BUDGET_SPATIAL_INSERT_MS = 25.0; // 500 节点构建索引上限
  const BUDGET_SPATIAL_QUERY_MS = 3.0;    // 500 节点单次视口查询上限
  const BUDGET_CULLING_SORT_MS = 8.0;     // 500 节点可视区筛选和深度排序上限
  const BUDGET_SCHEDULER_QUEUE_MS = 10.0; // 500 节点调度开销上限

  for (const size of scales) {
    const fixture = generateFixture(size);
    const index = new CanvasSpatialIndex(1000);

    // 1. 测试空间索引构建时间
    const startInsert = performance.now();
    fixture.promptNodes.forEach(node => {
      const width = 284;
      const height = node.height;
      index.updateNode(node.id, { x: node.position.x - width / 2, y: node.position.y - height, width, height });
    });
    fixture.imageNodes.forEach(node => {
      const width = 284;
      const height = 300;
      index.updateNode(node.id, { x: node.position.x - width / 2, y: node.position.y - height, width, height });
    });
    const insertTime = performance.now() - startInsert;

    // 2. 测试高频空间查询时间
    const queryCount = 200;
    const startQuery = performance.now();
    for (let i = 0; i < queryCount; i++) {
      const vLeft = (i * 20) % 8000;
      const vTop = (i * 15) % 6000;
      const vRight = vLeft + 1440;
      const vBottom = vTop + 960;
      index.query(vLeft, vTop, vRight, vBottom);
    }
    const queryTime = (performance.now() - startQuery) / queryCount;

    // 3. 测试可视区过滤和 Z-Index 排序耗时
    const cullingCount = 100;
    const collapsedCanvasGroupNodeIds = new Set<string>();
    const promptGroupLayerById = new Map<string, number>();
    const promptGroupStackZIndexById = new Map<string, number>();
    const standaloneImageStackZIndexById = new Map<string, number>();

    const promptNodeById = new Map<string, DummyPromptNode>();
    fixture.promptNodes.forEach(node => promptNodeById.set(node.id, node));
    const imageNodeById = new Map<string, DummyImageNode>();
    fixture.imageNodes.forEach(node => imageNodeById.set(node.id, node));

    const startCulling = performance.now();
    for (let i = 0; i < cullingCount; i++) {
      const vLeft = (i * 30) % 8000;
      const vTop = (i * 20) % 6000;
      const vRight = vLeft + 1440;
      const vBottom = vTop + 960;

      const visibleIds = index.query(vLeft, vTop, vRight, vBottom);

      const rawVisiblePrompts: DummyPromptNode[] = [];
      const rawVisibleImages: DummyImageNode[] = [];

      visibleIds.forEach(id => {
        const p = promptNodeById.get(id);
        if (p) {
          rawVisiblePrompts.push(p);
          return;
        }
        const img = imageNodeById.get(id);
        if (img) {
          rawVisibleImages.push(img);
        }
      });

      const visiblePrompts = rawVisiblePrompts
        .filter((n) => !collapsedCanvasGroupNodeIds.has(n.id))
        .sort((a, b) => {
          const az = promptGroupStackZIndexById.get(a.id) ?? ((promptGroupLayerById.get(a.id) ?? a.zIndex ?? 0) * 100 + 10);
          const bz = promptGroupStackZIndexById.get(b.id) ?? ((promptGroupLayerById.get(b.id) ?? b.zIndex ?? 0) * 100 + 10);
          const zDiff = az - bz;
          if (zDiff !== 0) return zDiff;
          return a.timestamp - b.timestamp;
        });

      const visibleImages = rawVisibleImages
        .filter((n) => !collapsedCanvasGroupNodeIds.has(n.id))
        .sort((a, b) => {
          const az = a.parentPromptId
            ? (promptGroupStackZIndexById.get(a.parentPromptId) ?? ((promptGroupLayerById.get(a.parentPromptId) ?? a.zIndex ?? 0) * 100 + 10))
            : (standaloneImageStackZIndexById.get(a.id) ?? ((a.zIndex ?? 0) * 100 + 10));
          const bz = b.parentPromptId
            ? (promptGroupStackZIndexById.get(b.parentPromptId) ?? ((promptGroupLayerById.get(b.parentPromptId) ?? b.zIndex ?? 0) * 100 + 10))
            : (standaloneImageStackZIndexById.get(b.id) ?? ((b.zIndex ?? 0) * 100 + 10));
          const zDiff = az - bz;
          if (zDiff !== 0) return zDiff;
          return a.timestamp - b.timestamp;
        });
    }
    const cullingTime = (performance.now() - startCulling) / cullingCount;

    // 4. 测试测量与连接线调度开销
    const startMeasurement = performance.now();
    const dummyEl = { offsetHeight: 250 } as unknown as HTMLElement;
    for (let i = 0; i < Math.min(fixture.promptNodes.length, 100); i++) {
      CanvasMeasurementScheduler.request(
        fixture.promptNodes[i].id,
        dummyEl,
        () => 250,
        () => {}
      );
    }
    const measurementTime = performance.now() - startMeasurement;

    const startConnector = performance.now();
    for (let i = 0; i < Math.min(fixture.imageNodes.length, 100); i++) {
      const node = fixture.imageNodes[i];
      if (node.parentPromptId) {
        CanvasConnectorScheduler.request(node.parentPromptId, node.id, false);
      }
    }
    const connectorTime = performance.now() - startConnector;

    results.push({
      size,
      insertTime,
      queryTime,
      cullingTime,
      measurementTime,
      connectorTime
    });
  }

  // 输出性能指标日志
  console.log('\n================ Performance Benchmark Results =================');
  console.log('| Size     | Spatial Index Build | Spatial Query | Viewport Culling | Measure Queue | Connector Queue |');
  console.log('|----------|---------------------|---------------|------------------|---------------|-----------------|');
  results.forEach(res => {
    console.log(
      `| ${String(res.size).padEnd(8)} | ` +
      `${res.insertTime.toFixed(4).padStart(17)}ms | ` +
      `${res.queryTime.toFixed(4).padStart(11)}ms | ` +
      `${res.cullingTime.toFixed(4).padStart(14)}ms | ` +
      `${res.measurementTime.toFixed(4).padStart(11)}ms | ` +
      `${res.connectorTime.toFixed(4).padStart(13)}ms |`
    );
  });
  console.log('=================================================================\n');

  // 对 500 节点规模进行回归阈值断言
  const target500 = results.find(r => r.size === 500);
  expect(target500).toBeDefined();

  expect(target500.insertTime).toBeLessThanOrEqual(BUDGET_SPATIAL_INSERT_MS);
  expect(target500.queryTime).toBeLessThanOrEqual(BUDGET_SPATIAL_QUERY_MS);
  expect(target500.cullingTime).toBeLessThanOrEqual(BUDGET_CULLING_SORT_MS);
  expect(target500.measurementTime).toBeLessThanOrEqual(BUDGET_SCHEDULER_QUEUE_MS);
  expect(target500.connectorTime).toBeLessThanOrEqual(BUDGET_SCHEDULER_QUEUE_MS);
});

test('CanvasSpatialIndex bucket query and overscan functionality check', () => {
  const index = new CanvasSpatialIndex(1000);
  
  // 1. 模拟插入两个节点
  // 节点 1 bounds: x=-42, y=-100, w=284, h=200
  index.updateNode('prompt-1', { x: -42, y: -100, width: 284, height: 200 });
  // 节点 2 bounds: x=1858, y=1800, w=284, h=200
  index.updateNode('image-2', { x: 1858, y: 1800, width: 284, height: 200 });

  // 2. 模拟 viewport 在原点 (0, 0)，包含 1000px 的 overscan buffer 缓冲范围
  // 查询区间为：x 在 -1000 到 2440, y 在 -1000 到 1960
  const results = index.query(-1000, -1000, 2440, 1960);
  
  // 节点 1 应该被正确检索到，而节点 2 也被 overscan 包含
  expect(results.has('prompt-1')).toBe(true);
  expect(results.has('image-2')).toBe(true);

  // 3. 如果我们缩小查询范围，无 overscan (仅查询 0 到 100)
  const tightResults = index.query(0, 0, 100, 100);
  expect(tightResults.has('prompt-1')).toBe(true);
  expect(tightResults.has('image-2')).toBe(false);
});

test('10000 card canvas virtualization keeps per-frame work bounded to visible candidates', () => {
  const totalCards = 10000;
  const metas: CachedCardMeta[] = [];
  const imageNodes: Array<Pick<DummyImageNode, 'id' | 'position'>> = [];
  const visibleIds = new Set<string>();

  for (let i = 0; i < totalCards; i++) {
    const id = `standalone-image-${i}`;
    const x = (i % 100) * 420;
    const y = Math.floor(i / 100) * 640;

    metas.push({
      id,
      x,
      y,
      width: 400,
      height: 600,
      type: 'image',
      thumbnailUrl: `blob:standalone-${i}`,
      updatedAt: i,
    });
    imageNodes.push({ id, position: { x, y } });

    if (i % 125 === 0) {
      visibleIds.add(id);
    }
  }

  const lookup = buildCanvasLayerMetaLookup(metas);
  const startSelect = performance.now();
  const paintMetas = selectCanvasLayerMetasForPaint({
    cardMetaById: lookup,
    visibleCardIds: visibleIds,
    selectedNodeIds: new Set(),
    activeSourceImage: null,
  });
  const selectTime = performance.now() - startSelect;

  const nearViewportNodes = imageNodes.filter((node) => visibleIds.has(node.id));
  const startSchedule = performance.now();
  const scheduling = buildViewportImageLoadScheduling({
    imageNodes: nearViewportNodes,
    collapsedCanvasGroupNodeIds: new Set(),
    canvasTransform: { x: 0, y: 0, scale: 1 },
    viewportWidth: 1440,
    viewportHeight: 960,
  });
  const scheduleTime = performance.now() - startSchedule;

  console.log(
    `[canvas:10000] visibleIds=${visibleIds.size} paintMetas=${paintMetas.length} ` +
    `select=${selectTime.toFixed(4)}ms schedule=${scheduleTime.toFixed(4)}ms`
  );

  expect(paintMetas.length).toBe(visibleIds.size);
  expect(scheduling.size).toBeLessThanOrEqual(nearViewportNodes.length);
  expect(selectTime).toBeLessThanOrEqual(4);
  expect(scheduleTime).toBeLessThanOrEqual(6);
});

