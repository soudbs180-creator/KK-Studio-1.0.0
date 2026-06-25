// 简体中文：工具注册表功能与安全策略单元测试 (AI Assistant Tool Registry Test)

import test from 'node:test';
import assert from 'node:assert/strict';
import { toolRegistryInstance, AgentToolRegistry } from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { durableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';

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
  const browserStatusTool = toolRegistryInstance.getTool('browser.getStatus');
  assert.ok(browserStatusTool);
  assert.equal(browserStatusTool.permission, 'safe');
  const browserOpenTool = toolRegistryInstance.getTool('browser.openAssistant');
  assert.ok(browserOpenTool);
  assert.equal(browserOpenTool.permission, 'safe');
  const browserExtractTool = toolRegistryInstance.getTool('browser.extractProduct');
  assert.ok(browserExtractTool);
  assert.equal(browserExtractTool.permission, 'confirm');
  const browserGenerateTool = toolRegistryInstance.getTool('browser.generateExternal');
  assert.ok(browserGenerateTool);
  assert.equal(browserGenerateTool.permission, 'confirm');
  const browserPublishTool = toolRegistryInstance.getTool('browser.publishDraft');
  assert.ok(browserPublishTool);
  assert.equal(browserPublishTool.permission, 'confirm');
  const browserInspectTool = toolRegistryInstance.getTool('browser.inspectPage');
  assert.ok(browserInspectTool);
  assert.equal(browserInspectTool.permission, 'confirm');
  const browserDesktopTool = toolRegistryInstance.getTool('browser.openDesktopProject');
  assert.ok(browserDesktopTool);
  assert.equal(browserDesktopTool.permission, 'confirm');
  const browserLocalLlmTool = toolRegistryInstance.getTool('browser.checkLocalLlm');
  assert.ok(browserLocalLlmTool);
  assert.equal(browserLocalLlmTool.permission, 'safe');
  const browserWriteBackTool = toolRegistryInstance.getTool('browser.writeBackDom');
  assert.ok(browserWriteBackTool);
  assert.equal(browserWriteBackTool.permission, 'dangerous');
  const retryJobTool = toolRegistryInstance.getTool('generation.retryJob');
  assert.ok(retryJobTool);
  assert.equal(retryJobTool.permission, 'safe');
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

test('ToolRegistry: canvas.createPromptCards can attach Browser Assistant image results to prompt cards', async () => {
  const promptNodes: any[] = [];
  const imageNodes: any[] = [];

  await toolRegistryInstance.execute('canvas.createPromptCards', {
    prompts: ['browser assistant product poster'],
    imageUrl: 'https://assets.example.com/poster.png',
    model: 'browser-model',
    aspectRatio: '4:5'
  }, {
    activeCanvas: {
      id: 'canvas-browser',
      promptNodes: [],
      imageNodes: [],
      audioNodes: []
    },
    addPromptNodes: async (nodes: any[]) => {
      promptNodes.push(...nodes);
    },
    addImageNodes: async (nodes: any[]) => {
      imageNodes.push(...nodes);
    },
    getNextCardPosition: () => ({ x: 120, y: 240 }),
    notify: {
      success: () => {}
    }
  });

  assert.equal(promptNodes.length, 1);
  assert.equal(imageNodes.length, 1);
  assert.equal(promptNodes[0].childImageIds[0], imageNodes[0].id);
  assert.equal(imageNodes[0].parentPromptId, promptNodes[0].id);
  assert.equal(imageNodes[0].url, 'https://assets.example.com/poster.png');
  assert.equal(imageNodes[0].prompt, 'browser assistant product poster');
  assert.equal(imageNodes[0].model, 'browser-model');
  assert.equal(imageNodes[0].aspectRatio, '4:5');
  assert.equal(imageNodes[0].canvasId, 'canvas-browser');
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

test('ToolRegistry: generation.retryJob retries failed durable queue prompts', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  durableGenerationQueue.clearAllJobs();

  let shouldFail = true;
  let executionCount = 0;
  (globalThis as any).setTimeout = ((handler: any, timeout?: number, ...args: any[]) => (
    originalSetTimeout(handler, typeof timeout === 'number' && timeout > 20 ? 1 : timeout, ...args)
  )) as typeof setTimeout;

  try {
    durableGenerationQueue.registerExecutor(async (_prompt, _options, _jobId, promptId) => {
      executionCount += 1;
      if (shouldFail) {
        throw new Error('tool_retry_later');
      }
      return {
        promptNodeId: `prompt-node-${promptId}`,
        resultImageNodeIds: [`image-node-${promptId}`]
      };
    });

    const createdJob = durableGenerationQueue.createJob(
      [{ id: 'prompt-1', prompt: 'retry through registry' }],
      {
        modelId: 'test-model',
        aspectRatio: '1:1',
        imageSize: '1K',
        countPerPrompt: 1,
        concurrency: 1,
        layout: 'grid'
      },
      'canvas-1',
      'tool-registry-retry-job'
    );

    await new Promise(resolve => originalSetTimeout(resolve, 120));

    const failedJob = durableGenerationQueue.getJob(createdJob.id);
    assert.equal(failedJob?.prompts[0]?.status, 'failed');
    assert.equal(failedJob?.prompts[0]?.retryCount, 3);

    shouldFail = false;
    const result = await toolRegistryInstance.execute('generation.retryJob', { jobId: createdJob.id }, {
      runId: 'run-retry-job-tool',
      notify: {
        success: () => {}
      }
    });

    assert.equal(result.id, createdJob.id);
    assert.equal(result.retryingCount, 1);
    assert.equal(result.failedCount, 0);

    await new Promise(resolve => originalSetTimeout(resolve, 50));

    const recoveredJob = durableGenerationQueue.getJob(createdJob.id);
    assert.equal(recoveredJob?.prompts[0]?.status, 'completed');
    assert.deepEqual(recoveredJob?.prompts[0]?.resultImageNodeIds, ['image-node-prompt-1']);
    assert.equal(executionCount, 5);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    durableGenerationQueue.clearAllJobs();
    durableGenerationQueue.registerExecutor(async () => []);
  }
});

test('ToolRegistry: generation.retryJob without jobId retries the latest failed durable job', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  durableGenerationQueue.clearAllJobs();

  let shouldFail = true;
  (globalThis as any).setTimeout = ((handler: any, timeout?: number, ...args: any[]) => (
    originalSetTimeout(handler, typeof timeout === 'number' && timeout > 20 ? 1 : timeout, ...args)
  )) as typeof setTimeout;

  try {
    durableGenerationQueue.registerExecutor(async (_prompt, _options, _jobId, promptId) => {
      if (shouldFail) {
        throw new Error('latest_failed_retry_later');
      }
      return {
        promptNodeId: `prompt-node-${promptId}`,
        resultImageNodeIds: [`image-node-${promptId}`]
      };
    });

    const olderJob = durableGenerationQueue.createJob(
      [{ id: 'older-prompt', prompt: 'older failed job' }],
      {
        modelId: 'test-model',
        aspectRatio: '1:1',
        imageSize: '1K',
        countPerPrompt: 1,
        concurrency: 1,
        layout: 'grid'
      },
      'canvas-1',
      'tool-registry-latest-failed-older'
    );

    await new Promise(resolve => originalSetTimeout(resolve, 120));

    const newerJob = durableGenerationQueue.createJob(
      [{ id: 'newer-prompt', prompt: 'newer failed job' }],
      {
        modelId: 'test-model',
        aspectRatio: '1:1',
        imageSize: '1K',
        countPerPrompt: 1,
        concurrency: 1,
        layout: 'grid'
      },
      'canvas-1',
      'tool-registry-latest-failed-newer'
    );

    await new Promise(resolve => originalSetTimeout(resolve, 120));

    assert.equal(durableGenerationQueue.getJob(olderJob.id)?.prompts[0]?.status, 'failed');
    assert.equal(durableGenerationQueue.getJob(newerJob.id)?.prompts[0]?.status, 'failed');

    shouldFail = false;
    const result = await toolRegistryInstance.execute('generation.retryJob', {}, {
      runId: 'run-retry-latest-failed-job-tool',
      notify: {
        success: () => {}
      }
    });

    assert.equal(result.id, newerJob.id);
    assert.equal(result.resolvedFrom, 'latest_failed');
    assert.equal(result.retryingCount, 1);

    await new Promise(resolve => originalSetTimeout(resolve, 50));

    assert.equal(durableGenerationQueue.getJob(olderJob.id)?.prompts[0]?.status, 'failed');
    assert.equal(durableGenerationQueue.getJob(newerJob.id)?.prompts[0]?.status, 'completed');
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    durableGenerationQueue.clearAllJobs();
    durableGenerationQueue.registerExecutor(async () => []);
  }
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
    paths: ['apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts'],
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

test('ToolRegistry: browser.getStatus returns setup guidance when Browser Bridge is disconnected', async () => {
  const result = await toolRegistryInstance.execute('browser.getStatus', {}, {
    browserBridge: {
      getStatus: async () => ({
        daemonStatus: 'disconnected',
        extensionStatus: 'disconnected',
        setupRequired: true,
        setupHint: '请先启动本地守护进程并连接 Chrome Bridge 插件。',
        platforms: [],
        sessions: [],
        socialChannels: []
      })
    }
  });

  assert.equal(result.daemonStatus, 'disconnected');
  assert.equal(result.extensionStatus, 'disconnected');
  assert.equal(result.setupRequired, true);
  assert.match(result.setupHint, /守护进程/);
});

test('ToolRegistry: browser.extractProduct validates URL before dispatching bridge command', async () => {
  await assert.rejects(
    () => toolRegistryInstance.execute('browser.extractProduct', {
      url: 'file:///C:/Users/Administrator/secrets.txt'
    }, {}),
    /Browser Bridge only accepts http or https URLs/
  );
});

test('ToolRegistry: disconnected browser.extractProduct returns setup_required instead of fake success', async () => {
  const result = await toolRegistryInstance.execute('browser.extractProduct', {
    url: 'https://example.com/item/1'
  }, {
    browserBridge: {
      execute: async () => ({
        id: 'cmd-test',
        status: 'setup_required',
        summary: '需要安装或连接 Browser Bridge。',
        error: 'Browser Bridge disconnected',
        audit: { redacted: true }
      })
    }
  });

  assert.equal(result.status, 'setup_required');
  assert.match(result.summary, /Browser Bridge/);
  assert.equal(result.data, undefined);
});

test('ToolRegistry: provider.getModelCapabilities queries properties correctly', async () => {
  const getModelCapabilities = toolRegistryInstance.getTool('provider.getModelCapabilities');
  assert.ok(getModelCapabilities);
  assert.equal(getModelCapabilities.permission, 'safe');

  const getModelCapabilitiesAlias = toolRegistryInstance.getTool('getModelCapabilities');
  assert.ok(getModelCapabilitiesAlias);

  const resultGemini = await toolRegistryInstance.execute('provider.getModelCapabilities', {
    modelId: 'gemini-2.0-flash-exp'
  }, {});
  assert.equal(resultGemini.modelId, 'gemini-2.0-flash-exp');
  assert.equal(resultGemini.multimodal, true);

  const resultNonExist = await toolRegistryInstance.execute('provider.getModelCapabilities', {
    modelId: 'non-exist-model'
  }, {});
  assert.equal(resultNonExist.modelId, 'non-exist-model');
  assert.equal(resultNonExist.multimodal, false);
});

test('ToolRegistry: ui.openToolWindow calls openToolWindowInstance in ctx', async () => {
  let openedToolId = '';
  let openedUrl = '';
  let openedOptions: any = null;
  const mockCtx = {
    openToolWindowInstance: async (toolId: string, url?: string, options?: any) => {
      openedToolId = toolId;
      openedUrl = url || '';
      openedOptions = options;
    },
    notify: {
      success: () => {}
    }
  };

  await toolRegistryInstance.execute('ui.openToolWindow', {
    toolId: 'stress-lab',
    url: 'https://test-tool.com',
    options: { width: 500 }
  }, mockCtx);

  assert.equal(openedToolId, 'stress-lab');
  assert.equal(openedUrl, 'https://test-tool.com');
  assert.deepEqual(openedOptions, { width: 500 });
});

test('ToolRegistry: ui.updateWindowLayout calls updateToolWindowLayout in ctx', async () => {
  const originalRaf = (globalThis as any).requestAnimationFrame;
  (globalThis as any).requestAnimationFrame = (cb: () => void) => {
    return setTimeout(cb, 1) as any;
  };

  try {
    let updatedInstanceId = '';
    let updatedLayout: any = null;
    const mockCtx = {
      updateToolWindowLayout: (instanceId: string, layout: any) => {
        updatedInstanceId = instanceId;
        updatedLayout = layout;
      },
      notify: {
        success: () => {}
      }
    };

    await toolRegistryInstance.execute('ui.updateWindowLayout', {
      instanceId: 'win_123',
      x: 150,
      y: 250,
      width: 800,
      height: 600,
      minimized: true
    }, mockCtx);

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(updatedInstanceId, 'win_123');
    assert.equal(updatedLayout.x, 150);
    assert.equal(updatedLayout.y, 250);
    assert.equal(updatedLayout.width, 800);
    assert.equal(updatedLayout.height, 600);
    assert.equal(updatedLayout.minimized, true);
  } finally {
    (globalThis as any).requestAnimationFrame = originalRaf;
  }
});

