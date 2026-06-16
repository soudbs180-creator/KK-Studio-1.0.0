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

  assert.equal(state.projectVersion, '1.5.7');
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

test('运行态构建测试：分组摘要包含隐藏、收纳、颜色和标签', () => {
  const mockCanvas = {
    id: 'test-canvas-1',
    promptNodes: [
      { id: 'p1', prompt: 'product', childImageIds: [], tags: ['automation', 'batch:job-1'] }
    ],
    imageNodes: [
      { id: 'img1', parentPromptId: 'p1', url: 'http://foo/img1.jpg', tags: ['batch:job-1'] }
    ],
    groups: [
      {
        id: 'group-1',
        label: 'AI ecommerce batch',
        nodeIds: ['p1', 'img1'],
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        color: '#ffffff',
        hidden: true,
        collapsed: false
      }
    ]
  };

  const state = buildCanvasRuntimeState({
    currentPage: 'canvas',
    activeCanvas: mockCanvas,
    selectedNodeIds: ['group-1']
  });

  assert.deepEqual(state.selection.groupIds, ['group-1']);
  assert.equal(state.groups.length, 1);
  assert.equal(state.groups[0].label, 'AI ecommerce batch');
  assert.equal(state.groups[0].hidden, true);
  assert.equal(state.groups[0].collapsed, false);
  assert.equal(state.groups[0].color, '#ffffff');
  assert.equal(state.groups[0].nodeCount, 2);
  assert.ok(state.groups[0].tags?.includes('batch:job-1'));
});

test('运行态构建测试：提示词、分组与输入框摘要会脱敏长凭证和 base64', () => {
  const sensitiveText = 'sk-live-secret-token-value-that-should-never-leak data:image/png;base64,abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789==';
  const mockCanvas = {
    id: 'test-canvas-1',
    promptNodes: [
      { id: 'p1', prompt: sensitiveText, childImageIds: [], tags: [] }
    ],
    imageNodes: [],
    groups: [
      { id: 'group-1', label: sensitiveText, nodeIds: ['p1'] }
    ]
  };

  const state = buildCanvasRuntimeState({
    currentPage: 'canvas',
    activeCanvas: mockCanvas,
    selectedNodeIds: ['p1'],
    config: {
      prompt: sensitiveText,
      mode: 'image',
      referenceImages: []
    }
  });

  const serialized = JSON.stringify(state);
  assert.equal(serialized.includes('sk-live-secret-token-value'), false);
  assert.equal(serialized.includes('data:image/png;base64'), false);
  assert.ok(serialized.includes('***'));
});
