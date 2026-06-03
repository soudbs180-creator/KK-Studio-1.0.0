// 简体中文：画布实时运行态构建器单元测试 (Canvas Runtime State Builder Test)

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanvasRuntimeState } from '../../apps/web/src/features/ai-takeover/core/canvasRuntimeStateBuilder.ts';

test('运行态构建测试：无任何选中节点时的初始状态', () => {
  const mockCanvas = {
    id: 'test-canvas-1',
    name: '我的测试项目',
    promptNodes: [],
    imageNodes: [],
    groups: [],
    viewportCenter: { x: 100, y: 200 },
    lastModified: 1718000000000
  };

  const state = buildCanvasRuntimeState({
    currentPage: 'canvas',
    activeCanvas: mockCanvas,
    selectedNodeIds: [],
    canvasTransform: { x: 10, y: 20, scale: 1.5 }
  });

  assert.equal(state.projectVersion, '1.5.2');
  assert.equal(state.currentPage, 'canvas');
  assert.equal(state.canvas.id, 'test-canvas-1');
  assert.equal(state.canvas.name, '我的测试项目');
  assert.equal(state.canvas.promptCount, 0);
  assert.equal(state.canvas.imageCount, 0);
  assert.equal(state.canvas.groupCount, 0);
  assert.equal(state.canvas.lastModified, 1718000000000);
  
  // 视口与中心
  assert.equal(state.viewport.x, 10);
  assert.equal(state.viewport.y, 20);
  assert.equal(state.viewport.scale, 1.5);
  
  // 选区
  assert.equal(state.selection.count, 0);
  assert.equal(state.selection.selectedNodeIds.length, 0);
  assert.equal(state.selection.promptNodeIds.length, 0);
  assert.equal(state.selection.imageNodeIds.length, 0);
  assert.equal(state.selection.childImageNodeIdsFromSelectedPrompts.length, 0);
});

test('运行态构建测试：框选 Prompt 节点并解析推导子图 IDs', () => {
  const mockCanvas = {
    id: 'test-canvas-1',
    promptNodes: [
      {
        id: 'p1',
        prompt: '可爱的小猫咪',
        isGenerating: false,
        childImageIds: ['img1', 'img2'],
        tags: ['cat']
      },
      {
        id: 'p2',
        prompt: '机甲战士',
        isGenerating: true,
        childImageIds: [],
        tags: []
      }
    ],
    imageNodes: [
      { id: 'img1', parentPromptId: 'p1', url: 'http://foo/img1.jpg' },
      { id: 'img2', parentPromptId: 'p1', url: 'http://foo/img2.jpg' },
      { id: 'img3', parentPromptId: 'p2', url: 'http://foo/img3.jpg' }
    ]
  };

  const state = buildCanvasRuntimeState({
    currentPage: 'canvas',
    activeCanvas: mockCanvas,
    selectedNodeIds: ['p1'],
    canvasTransform: null,
    canvasRef: {
      current: {
        getCurrentTransform: () => ({ x: 0, y: 0, scale: 1 }),
        getCanvasRect: () => ({ width: 800, height: 600 } as DOMRect)
      }
    }
  });

  assert.equal(state.selection.count, 1);
  assert.deepEqual(state.selection.promptNodeIds, ['p1']);
  assert.deepEqual(state.selection.imageNodeIds, []);
  
  // 子图推导: 选中 p1，应自动带出其关联的 img1, img2
  assert.deepEqual(state.selection.childImageNodeIdsFromSelectedPrompts.sort(), ['img1', 'img2'].sort());
  assert.equal(state.selectedNodes.prompts.length, 1);
  assert.equal(state.selectedNodes.prompts[0].prompt, '可爱的小猫咪');
  assert.equal(state.selectedNodes.prompts[0].status, 'done');
});

test('运行态构建测试：框选图片卡片', () => {
  const mockCanvas = {
    id: 'test-canvas-1',
    promptNodes: [],
    imageNodes: [
      { id: 'img1', parentPromptId: 'p1', url: 'http://foo/img1.jpg', originalUrl: 'http://foo/orig.jpg' }
    ]
  };

  const state = buildCanvasRuntimeState({
    currentPage: 'canvas',
    activeCanvas: mockCanvas,
    selectedNodeIds: ['img1']
  });

  assert.equal(state.selection.count, 1);
  assert.deepEqual(state.selection.imageNodeIds, ['img1']);
  assert.equal(state.selectedNodes.images.length, 1);
  assert.equal(state.selectedNodes.images[0].originalUrlPresent, true);
  assert.equal(state.selectedNodes.images[0].urlPresent, true);
  assert.equal(state.selectedNodes.images[0].apiResultUrlPresent, false);
});
