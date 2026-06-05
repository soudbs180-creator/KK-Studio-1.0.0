// 简体中文：工具注册表功能与安全策略单元测试 (AI Assistant Tool Registry Test)

import test from 'node:test';
import assert from 'node:assert/strict';
import { toolRegistryInstance, AgentToolRegistry } from '../../apps/web/src/features/ai-takeover/core/toolRegistry.ts';

test('工具注册表：已注册工具清单检查', () => {
  const tools = toolRegistryInstance.getAllTools();
  assert.ok(tools.length > 0);

  const fillPrompt = toolRegistryInstance.getTool('fillPrompt');
  assert.ok(fillPrompt);
  assert.equal(fillPrompt.permission, 'safe');

  const fillApiKey = toolRegistryInstance.getTool('fillApiKey');
  assert.ok(fillApiKey);
  assert.equal(fillApiKey.permission, 'forbidden');

  assert.ok(toolRegistryInstance.getTool('canvas.getState'));
  assert.ok(toolRegistryInstance.getTool('canvas.getSelectedNodes'));
  assert.ok(toolRegistryInstance.getTool('canvas.arrangeNodes'));
  assert.ok(toolRegistryInstance.getTool('assets.resolveOriginals'));
  assert.ok(toolRegistryInstance.getTool('assets.zipOriginals'));
  assert.ok(toolRegistryInstance.getTool('generation.createBatchJob'));
  assert.ok(toolRegistryInstance.getTool('generation.getJobStatus'));
  const ecommerceBatchTool = toolRegistryInstance.getTool('ecommerce.createBatchTransformJob');
  assert.ok(ecommerceBatchTool);
  assert.equal(ecommerceBatchTool.permission, 'confirm');
  assert.ok(toolRegistryInstance.getTool('knowledge.searchProject'));
  assert.ok(toolRegistryInstance.getTool('knowledge.recordChange'));
  assert.ok(toolRegistryInstance.getTool('ui.recordLayoutChange'));
  assert.ok(toolRegistryInstance.getTool('skills.upsertSkill'));
});

test('工具注册表：执行未知工具抛出错误', async () => {
  await assert.rejects(
    async () => {
      await toolRegistryInstance.execute('non_existent_tool', {}, {});
    },
    /未找到工具: non_existent_tool/
  );
});

test('工具注册表：硬性拦截 forbidden 高危工具', async () => {
  let notifiedError = false;
  const mockCtx = {
    notify: {
      error: (title: string, msg: string) => {
        notifiedError = true;
      }
    }
  };

  await assert.rejects(
    async () => {
      await toolRegistryInstance.execute('fillApiKey', {}, mockCtx);
    },
    /Execution forbidden for tool: fillApiKey/
  );

  assert.equal(notifiedError, true);
});

test('工具注册表：自定义工具注册防重校验', () => {
  const customRegistry = new AgentToolRegistry();
  customRegistry.register({
    name: 'testTool',
    description: '测试工具',
    permission: 'safe',
    inputSchema: {},
    handler: async () => 'hello'
  });

  // 重复注册同名工具应该报错
  assert.throws(
    () => {
      customRegistry.register({
        name: 'testTool',
        description: '重复工具',
        permission: 'safe',
        inputSchema: {},
        handler: async () => 'world'
      });
    },
    /工具已注册: testTool/
  );
});

test('工具注册表：安全级别 safe 工具成功驱动执行', async () => {
  let valueFilled = '';
  const mockCtx = {
    activeCanvas: {
      selectedNodeIds: ['node-1'],
      promptNodes: [{ id: 'node-1', prompt: '原始' }]
    },
    updatePromptNode: async (node: any) => {
      valueFilled = node.prompt;
    },
    notify: {
      success: () => {}
    }
  };

  await toolRegistryInstance.execute('fillPrompt', { prompt: '新提示词' }, mockCtx);
  assert.equal(valueFilled, '新提示词');

  const logs = toolRegistryInstance.getLogs();
  const latestLog = logs[logs.length - 1];
  assert.equal(latestLog?.toolName, 'fillPrompt');
  assert.equal(latestLog?.status, 'success');
});

test('工具注册表：审计日志保留上限，避免长会话内存无限增长', async () => {
  const registry = new AgentToolRegistry();
  registry.register({
    name: 'ping',
    description: 'lightweight test tool',
    permission: 'safe',
    inputSchema: {},
    handler: async (input: any) => input
  });

  for (let index = 0; index < 205; index += 1) {
    await registry.execute('ping', { index }, { runId: 'run-log-cap' });
  }

  const logs = registry.getLogs();
  assert.equal(logs.length, 200);
  assert.match(logs[0].inputSummary, /"index":5/);
  assert.match(logs[logs.length - 1].inputSummary, /"index":204/);
});

test('工具注册表：异常日志脱敏后写入审计记录', async () => {
  const registry = new AgentToolRegistry();
  registry.register({
    name: 'explode',
    description: 'test failing tool',
    permission: 'safe',
    inputSchema: {},
    handler: async () => {
      throw new Error('Bearer abcdefghijklmnopqrstuvwxyz0123456789.secret should not leak');
    }
  });

  await assert.rejects(() => registry.execute('explode', {}, { runId: 'run-redact' }));
  const logs = registry.getLogs();
  const latestLog = logs[logs.length - 1];
  assert.equal(latestLog?.status, 'failed');
  assert.equal(latestLog?.error?.includes('abcdefghijklmnopqrstuvwxyz'), false);
  assert.ok(latestLog?.error?.includes('Bearer ***'));
});

test('工具注册表：namespaced 读工具返回当前画布摘要', async () => {
  const result = await toolRegistryInstance.execute('canvas.getState', {}, {
    activeCanvas: {
      id: 'canvas-1',
      name: '测试画布',
      promptNodes: [{ id: 'p1' }],
      imageNodes: [{ id: 'i1' }],
      groups: [],
      selectedNodeIds: ['p1']
    }
  });

  assert.equal(result.canvasId, 'canvas-1');
  assert.equal(result.promptCount, 1);
  assert.equal(result.imageCount, 1);
  assert.deepEqual(result.selectedNodeIds, ['p1']);
});

test('工具注册表：canvas.arrangeNodes 调用注入的画布整理能力', async () => {
  let arrangedMode = '';
  const result = await toolRegistryInstance.execute('canvas.arrangeNodes', { mode: 'row' }, {
    activeCanvas: {
      id: 'canvas-1',
      selectedNodeIds: ['p1']
    },
    arrangeAllNodes: (mode: string) => {
      arrangedMode = mode;
    },
    notify: {
      success: () => {}
    }
  });

  assert.equal(arrangedMode, 'row');
  assert.equal(result.status, 'arranged');
  assert.equal(result.selectedCount, 1);
});

test('ToolRegistry: canvas.arrangeNodes supports targeted compact node layout', async () => {
  let updatePayload: any = null;
  let arrangeAllCalled = false;
  const result = await toolRegistryInstance.execute('canvas.arrangeNodes', {
    nodeIds: ['p1', 'img1'],
    preset: 'compact-grid',
    columns: 2,
    gap: 24
  }, {
    activeCanvas: {
      id: 'canvas-1',
      promptNodes: [
        { id: 'p1', prompt: 'test', position: { x: 0, y: 180 }, height: 180, childImageIds: [] }
      ],
      imageNodes: [
        { id: 'img1', url: 'blob:1', position: { x: 400, y: 360 }, aspectRatio: '4:5' }
      ],
      groups: [],
      selectedNodeIds: []
    },
    updateNodes: (updates: any) => {
      updatePayload = updates;
    },
    arrangeAllNodes: () => {
      arrangeAllCalled = true;
    },
    notify: {
      success: () => {}
    }
  });

  assert.equal(result.status, 'arranged');
  assert.equal(result.preset, 'compact-grid');
  assert.equal(result.selectedCount, 2);
  assert.equal(arrangeAllCalled, false);
  assert.equal(updatePayload.promptNodes.length, 1);
  assert.equal(updatePayload.imageNodes.length, 1);
});

test('ToolRegistry: ecommerce batch transform tool creates a grouped durable job', async () => {
  const result = await toolRegistryInstance.execute('ecommerce.createBatchTransformJob', {
    imageIds: ['img-1', 'img-2'],
    rawUserRequest: 'compact ecommerce layout',
    aspectRatio: '4:5',
    layoutPreset: 'compact-grid',
    idempotencyKey: 'tool-registry-ecommerce-batch'
  }, {
    activeCanvas: {
      id: 'canvas-1',
      imageNodes: [
        { id: 'img-1', url: 'blob:1', position: { x: 0, y: 0 }, aspectRatio: '1:1' },
        { id: 'img-2', url: 'blob:2', position: { x: 300, y: 0 }, aspectRatio: '1:1' }
      ],
      promptNodes: [],
      groups: []
    },
    selectedModel: { id: 'test-model' },
    notify: {
      success: () => {}
    }
  });

  assert.equal(result.promptCount, 2);
  assert.equal(result.outputGroup.color, '#ffffff');
  assert.equal(result.outputGroup.includePromptNodes, true);
});

test('ToolRegistry: assets.resolveOriginals returns selected original source summary', async () => {
  const result = await toolRegistryInstance.execute('assets.resolveOriginals', { scope: 'selected_cards' }, {
    selectedNodeIds: ['img-1'],
    activeCanvas: {
      promptNodes: [],
      imageNodes: [
        {
          id: 'img-1',
          url: 'https://assets.kkai.plus/test-fixtures/preview.png',
          originalUrl: 'https://assets.kkai.plus/test-fixtures/original.png',
          prompt: 'test',
          parentPromptId: 'prompt-1',
          timestamp: 100,
          model: 'test-model',
          canvasId: 'canvas-1',
          position: { x: 0, y: 0 },
          aspectRatio: '1:1'
        },
        {
          id: 'img-2',
          url: 'https://assets.kkai.plus/test-fixtures/other.png',
          prompt: 'other',
          parentPromptId: 'prompt-2',
          timestamp: 101,
          model: 'test-model',
          canvasId: 'canvas-1',
          position: { x: 0, y: 0 },
          aspectRatio: '1:1'
        }
      ]
    }
  });

  assert.equal(result.count, 1);
  assert.equal(result.items[0].nodeId, 'img-1');
  assert.equal(result.items[0].sourceKind, 'originalUrl');
  assert.equal(result.items[0].hasSource, true);
});

test('ToolRegistry: KnowledgeSync tools record and search changes', async () => {
  const change = await toolRegistryInstance.execute('knowledge.recordChange', {
    title: 'Tool registry knowledge sync',
    summary: 'Registered knowledge.searchProject and knowledge.recordChange tools.',
    paths: ['apps/web/src/features/ai-takeover/core/toolRegistry.ts'],
    tools: ['knowledge.recordChange', 'knowledge.searchProject'],
    validation: ['tests/unit/ai-assistant-tool-registry.test.ts']
  }, {});

  const uiChange = await toolRegistryInstance.execute('ui.recordLayoutChange', {
    component: 'AI takeover toggle',
    summary: 'Selector remains stable for assistant highlighting.',
    selector: '#btn-ai-takeover-toggle',
    affectedTools: ['ui.highlightElement']
  }, {});

  const skill = await toolRegistryInstance.execute('skills.upsertSkill', {
    name: 'record-knowledge-after-agent-change',
    trigger: 'Assistant, tool, UI, generation, download, or queue behavior changed',
    tools: ['knowledge.recordChange'],
    steps: ['Summarize change', 'List touched files', 'List validation commands'],
    validation: ['npm run governance:check']
  }, {});

  const search = await toolRegistryInstance.execute('knowledge.searchProject', {
    query: 'knowledge sync tool registry',
    limit: 5
  }, {});

  assert.equal(change.title, 'Tool registry knowledge sync');
  assert.equal(uiChange.component, 'AI takeover toggle');
  assert.equal(skill.name, 'record-knowledge-after-agent-change');
  assert.ok(search.results.length > 0);
});
