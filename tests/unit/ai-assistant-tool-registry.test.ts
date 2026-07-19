// 简体中文：工具注册表功能与安全策略单元测试 (AI Assistant Tool Registry Test)

import test from 'node:test';
import assert from 'node:assert/strict';
import { toolRegistryInstance, AgentToolRegistry } from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { durableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import { emitAuthSessionChange } from '../../apps/web/src/services/auth/authSessionEvents.ts';
import {
  captureAssistantAuthorizationScope,
  createAssistantStepAuthorization,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';

const userGrant = (
  runId: string,
  toolName: string,
  input: unknown,
  scope: Record<string, any> = {},
) => {
  const planId = `${runId}:plan`;
  const requestedIdempotencyKey = input && typeof input === 'object'
    ? String((input as Record<string, unknown>).idempotencyKey || '')
    : '';
  const stepId = requestedIdempotencyKey.startsWith(`${runId}:`)
    ? requestedIdempotencyKey.slice(runId.length + 1)
    : toolName;
  const baseContext = {
    ...scope,
    runId,
    planId,
    stepId,
    currentPage: 'canvas' as const,
    trigger: 'assist-confirmed' as const,
  };
  const authorizationScope = captureAssistantAuthorizationScope(baseContext);
  return {
    ...baseContext,
    confirmationGrant: {
      runId,
      planId,
      ownerId: authorizationScope.ownerId,
      confirmed: true as const,
      toolNames: [toolName],
      authorizationScope,
      authorizedSteps: [createAssistantStepAuthorization({
        runId,
        stepId,
        toolName,
        input,
        context: baseContext,
        authorizationScope,
      })],
      source: 'user' as const,
      grantedAt: new Date().toISOString(),
    },
  };
};

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
  assert.ok(toolRegistryInstance.getTool('canvas.createCard'));
  assert.ok(toolRegistryInstance.getTool('canvas.convertDrawingsToNote'));
  assert.ok(toolRegistryInstance.getTool('canvas.rasterizeNote'));
  assert.ok(toolRegistryInstance.getTool('workflow.createPanel'));
  assert.ok(toolRegistryInstance.getTool('workflow.controlPanel'));
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
  assert.equal(browserPublishTool.permission, 'dangerous');
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
  assert.equal(retryJobTool.permission, 'confirm');
  const resumeJobTool = toolRegistryInstance.getTool('generation.resumeJob');
  assert.ok(resumeJobTool);
  assert.equal(resumeJobTool.permission, 'confirm');
  assert.equal(resumeJobTool.control.cost.kind, 'variable');
  assert.equal(toolRegistryInstance.getTool('generation.cancelJob')?.permission, 'confirm');
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

test('ToolRegistry: forbidden tool audit recursively redacts credential-shaped fields', async () => {
  toolRegistryInstance.clearLogs();
  const secrets = {
    authorization: 'Bearer short-secret',
    nested: {
      apiKey: 'tiny-key',
      'x-api-key': 'short-x-api-key',
      openaiApiKey: 'short-openai-key',
      proxyAuthorization: 'Basic short-proxy-secret',
      privateKey: 'short-private-key',
      sessionToken: 'short-session-token',
      databaseUrl: 'postgres://u:p@db/kk',
      token: '019f61a6-1e98-7793-aa47-35e01ea7d32a',
      credentials: [{ password: 'credential-password' }],
      profiles: [{ password: 'pw-1234', safeLabel: 'visible-label' }],
    },
  };

  await assert.rejects(
    toolRegistryInstance.execute('fillApiKey', secrets, { runId: 'run-redact-forbidden-input' }),
    /Execution forbidden for tool: fillApiKey/,
  );

  const auditLogs = toolRegistryInstance.getLogs();
  const latestLog = auditLogs[auditLogs.length - 1];
  assert.equal(latestLog?.status, 'blocked');
  assert.match(latestLog?.inputSummary || '', /"authorization":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"apiKey":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"x-api-key":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"openaiApiKey":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"proxyAuthorization":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"privateKey":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"sessionToken":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"databaseUrl":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"token":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"credentials":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /"password":"\*\*\*"/);
  assert.match(latestLog?.inputSummary || '', /visible-label/);
  for (const secret of [
    'short-secret', 'tiny-key', 'short-x-api-key', 'short-openai-key',
    'short-proxy-secret', 'short-private-key', 'short-session-token',
    'postgres://u:p@db/kk', '019f61a6', 'pw-1234',
  ]) {
    assert.equal(latestLog?.inputSummary.includes(secret), false);
  }
});

test('ToolRegistry: audit summaries redact credentials embedded in URLs and free-form strings', async () => {
  const registry = new AgentToolRegistry();
  registry.register({
    name: 'test.stringCredentialRedaction',
    description: 'string credential redaction test',
    permission: 'safe',
    control: { effect: 'read' },
    inputSchema: { type: 'object' },
    handler: async () => {
      throw new Error('request failed: https://example.test/?access_token=shortSecret123&api_key=tinyKey password="hunter2" Authorization: Basic dXNlcjpwYXNz');
    },
  });
  await assert.rejects(registry.execute('test.stringCredentialRedaction', {
    url: 'https://example.test/?access_token=shortSecret123&api_key=tinyKey',
    message: 'password="hunter2" database=postgresql://demo-user:demo-pass@example.test/app eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZW1vIn0.c2lnbmF0dXJl',
  }, {}));
  const logs = registry.getLogs();
  const latest = logs[logs.length - 1];
  for (const secret of ['shortSecret123', 'tinyKey', 'hunter2', 'dXNlcjpwYXNz', 'demo-pass', 'eyJhbGciOiJIUzI1NiJ9']) {
    assert.equal(latest?.inputSummary.includes(secret), false);
    assert.equal(latest?.error?.includes(secret), false);
  }
});

test('ToolRegistry: declared and verifier failures redact messages before return, log, and throw', async () => {
  const registry = new AgentToolRegistry();
  registry.register({
    name: 'test.declaredSecretFailure',
    description: 'declared failure redaction',
    permission: 'safe',
    control: { effect: 'read' },
    inputSchema: { type: 'object' },
    handler: async () => ({
      success: false,
      executionOutcome: 'failed' as const,
      message: 'Authorization: Bearer declared-secret-token',
    }),
  });
  registry.register({
    name: 'test.verifierSecretFailure',
    description: 'verifier failure redaction',
    permission: 'safe',
    control: { recovery: { reversible: true } },
    inputSchema: { type: 'object' },
    handler: async () => ({ success: true, executionOutcome: 'success' as const, id: 'verified-output' }),
    verify: async () => ({
      success: false,
      message: 'password="verifier-secret" Cookie: session=verifier-cookie',
    }),
  });

  const declared = await registry.execute('test.declaredSecretFailure', {}, {});
  assert.equal(declared.message.includes('declared-secret-token'), false);
  assert.match(declared.message, /Authorization: \*\*\*/);

  let verifierError = '';
  await assert.rejects(
    registry.execute('test.verifierSecretFailure', {}, {}),
    (error: any) => {
      verifierError = String(error?.message || error);
      return true;
    },
  );
  assert.equal(verifierError.includes('verifier-secret'), false);
  assert.equal(verifierError.includes('verifier-cookie'), false);

  const logs = registry.getLogs();
  assert.equal(logs.some((log) => log.error?.includes('declared-secret-token')), false);
  assert.equal(logs.some((log) => log.error?.includes('verifier-secret')), false);
  assert.equal(logs.some((log) => log.error?.includes('verifier-cookie')), false);
});

test('ToolRegistry: audit logs remain bound to the owner captured before async execution', async (t) => {
  const registry = new AgentToolRegistry();
  let release!: () => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  const waitForRelease = new Promise<void>((resolve) => { release = resolve; });
  registry.register({
    name: 'test.ownerBoundLog',
    description: 'owner log isolation',
    permission: 'safe',
    control: { effect: 'read' },
    inputSchema: { type: 'object' },
    handler: async () => {
      signalStarted();
      await waitForRelease;
      return { success: true };
    },
  });
  t.after(() => emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false }));

  emitAuthSessionChange({ hasSession: true, userId: 'tool-log-owner-a', isTempUser: false });
  const execution = registry.execute('test.ownerBoundLog', {}, {});
  await started;
  emitAuthSessionChange({ hasSession: true, userId: 'tool-log-owner-b', isTempUser: false });
  release();
  await assert.rejects(execution, /owner changed/i);

  assert.equal(registry.getLogs().length, 0);
  assert.equal(registry.getLogs('tool-log-owner-a').length, 1);
  assert.equal(registry.getLogs('tool-log-owner-a')[0]?.toolName, 'test.ownerBoundLog');
});

test('ToolRegistry: persistent idempotency stores only safe receipts, never secret-bearing output', async (t) => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  const storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
  } satisfies Storage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => {
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    else delete (globalThis as any).localStorage;
  });

  const registry = new AgentToolRegistry();
  registry.register({
    name: 'test.secretOutputMutation',
    description: 'secret output persistence guard',
    permission: 'safe',
    control: { recovery: { reversible: true } },
    inputSchema: { type: 'object' },
    handler: async () => ({
      success: true,
      executionOutcome: 'success' as const,
      id: 'safe-id',
      token: 'secret-output-token-value',
    }),
  });

  await registry.execute(
    'test.secretOutputMutation',
    { idempotencyKey: 'secret-output-persistence-key' },
    { runId: 'run-secret-output-persistence' },
  );
  assert.equal([...values.values()].some((value) => value.includes('secret-output-token-value')), false);
});

test('ToolRegistry: one idempotency key cannot be reused with different mutation input', async () => {
  const registry = new AgentToolRegistry();
  let handlerCalls = 0;
  registry.register({
    name: 'test.idempotentMutation',
    description: 'idempotency conflict test',
    permission: 'safe',
    control: { recovery: { reversible: true } },
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'string' }, idempotencyKey: { type: 'string' } },
      required: ['value'],
    },
    handler: async () => {
      handlerCalls += 1;
      return { success: true, executionOutcome: 'success' };
    },
  });

  const idempotencyKey = 'registry-conflict-key-2026-07-19';
  await registry.execute(
    'test.idempotentMutation',
    { value: 'first', idempotencyKey },
    { runId: 'run-idempotency-conflict' },
  );
  await assert.rejects(
    registry.execute(
      'test.idempotentMutation',
      { value: 'second', idempotencyKey },
      { runId: 'run-idempotency-conflict' },
    ),
    (error: any) => error?.code === 'IDEMPOTENCY_CONFLICT',
  );

  assert.equal(handlerCalls, 1);
  const conflictLogs = registry.getLogs();
  const conflictLog = conflictLogs[conflictLogs.length - 1];
  assert.equal(conflictLog?.status, 'failed');
  assert.equal(conflictLog?.failureClass, 'validation');
  assert.equal(conflictLog?.errorCode, 'IDEMPOTENCY_CONFLICT');
});

test('ToolRegistry: in-memory verified execution cache is capped per owner', async () => {
  const registry = new AgentToolRegistry();
  let handlerCalls = 0;
  registry.register({
    name: 'test.memoryBoundedMutation',
    description: 'bounded verified execution cache test',
    permission: 'safe',
    control: { recovery: { reversible: true } },
    inputSchema: {
      type: 'object',
      properties: { idempotencyKey: { type: 'string' } },
    },
    handler: async () => {
      handlerCalls += 1;
      return { success: true };
    },
  });

  const OriginalDate = globalThis.Date;
  const frozenTime = OriginalDate.now();
  class FrozenDate extends OriginalDate {
    constructor(value?: string | number | Date) {
      super(value === undefined ? frozenTime : value as any);
    }
    static now() { return frozenTime; }
  }
  (globalThis as any).Date = FrozenDate;
  try {
    for (let index = 0; index < 205; index += 1) {
      await registry.execute(
        'test.memoryBoundedMutation',
        { idempotencyKey: `bounded-cache-${index}` },
        { runId: `run-bounded-cache-${index}` },
      );
    }

    assert.equal((registry as any).verifiedExecutions.size, 200);
    await registry.execute(
      'test.memoryBoundedMutation',
      { idempotencyKey: 'bounded-cache-204' },
      { runId: 'run-bounded-cache-204' },
    );
    assert.equal(handlerCalls, 205, 'the newest record must survive same-millisecond eviction');
    await registry.execute(
      'test.memoryBoundedMutation',
      { idempotencyKey: 'bounded-cache-0' },
      { runId: 'run-bounded-cache-0' },
    );
    assert.equal(handlerCalls, 206, 'the oldest record should be evicted first');
  } finally {
    (globalThis as any).Date = OriginalDate;
  }
});

test('ToolRegistry: persistent idempotency is owner-scoped and cannot cross canvas boundaries', async (t) => {
  const toolName = 'test.scopedPersistentMutation';
  const idempotencyKey = 'scoped-persistent-key-2026-07-19';
  const registerTool = (registry: AgentToolRegistry, handler: () => Promise<any>) => registry.register({
    name: toolName,
    description: 'owner and canvas scoped idempotency test',
    permission: 'safe',
    control: { recovery: { reversible: true } },
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'string' }, idempotencyKey: { type: 'string' } },
      required: ['value'],
    },
    handler,
  });

  t.after(() => emitAuthSessionChange({ hasSession: false, userId: null, isTempUser: false }));
  emitAuthSessionChange({ hasSession: true, userId: 'tool-owner-a', isTempUser: false });

  let firstCalls = 0;
  const firstRegistry = new AgentToolRegistry();
  registerTool(firstRegistry, async () => {
    firstCalls += 1;
    return { success: true, executionOutcome: 'success', id: 'canvas-a-result' };
  });
  const input = { value: 'same-input', idempotencyKey };
  const canvasAContext = { runId: 'run-scoped-idempotency', currentPage: 'canvas' as const, activeCanvas: { id: 'canvas-a' } };
  await firstRegistry.execute(toolName, input, canvasAContext);
  assert.equal(firstCalls, 1);

  let secondCalls = 0;
  const secondRegistry = new AgentToolRegistry();
  registerTool(secondRegistry, async () => {
    secondCalls += 1;
    return { success: true, executionOutcome: 'success', id: 'fresh-result' };
  });
  const persisted = await secondRegistry.execute(toolName, input, canvasAContext);
  assert.equal(persisted.id, 'canvas-a-result');
  assert.equal(secondCalls, 0);

  await assert.rejects(
    secondRegistry.execute(toolName, input, {
      ...canvasAContext,
      activeCanvas: { id: 'canvas-b' },
    }),
    (error: any) => error?.code === 'IDEMPOTENCY_CONFLICT',
  );
  assert.equal(secondCalls, 0);

  emitAuthSessionChange({ hasSession: true, userId: 'tool-owner-b', isTempUser: false });
  const ownerBResult = await secondRegistry.execute(toolName, input, canvasAContext);
  assert.equal(ownerBResult.id, 'fresh-result');
  assert.equal(secondCalls, 1);
});

test('ToolRegistry: resume and retry never report terminal no-op queue controls as success', async () => {
  durableGenerationQueue.clearAllJobs();
  durableGenerationQueue.registerExecutor(null);
  const job = durableGenerationQueue.createJob(
    [{ id: 'terminal-control-prompt', prompt: 'do not replay' }],
    { taskType: 'image', modelId: 'test-model' },
    'canvas-terminal-control',
    'terminal-control-job-key',
  );
  durableGenerationQueue.cancelJob(job.id);
  const notify = { success() {}, warning() {}, error() {}, info() {} };

  try {
    const resume = await toolRegistryInstance.execute('generation.resumeJob', { jobId: job.id }, {
      ...userGrant('run-terminal-resume', 'generation.resumeJob', { jobId: job.id }),
      notify,
    });
    assert.equal(resume.success, false);
    assert.equal(resume.code, 'INVALID_JOB_STATE');
    const resumeLogs = toolRegistryInstance.getLogs();
    assert.equal(resumeLogs[resumeLogs.length - 1]?.status, 'failed');

    const retryInput = {
      jobId: job.id,
      expectedUpdatedAt: durableGenerationQueue.getJob(job.id)!.updatedAt,
      expectedRetryablePromptIds: ['terminal-control-prompt'],
    };
    const retry = await toolRegistryInstance.execute('generation.retryJob', retryInput, {
      ...userGrant('run-terminal-retry', 'generation.retryJob', retryInput),
      notify,
    });
    assert.equal(retry.success, false);
    assert.equal(retry.code, 'STALE_RETRY_TARGET');
    const retryLogs = toolRegistryInstance.getLogs();
    assert.equal(retryLogs[retryLogs.length - 1]?.status, 'failed');
  } finally {
    durableGenerationQueue.clearAllJobs();
    durableGenerationQueue.registerExecutor(async () => []);
  }
});

test('ToolRegistry: a cached resume result is discarded when the durable job was paused again', async () => {
  durableGenerationQueue.clearAllJobs();
  durableGenerationQueue.registerExecutor(null);
  const job = durableGenerationQueue.createJob(
    [{ id: 'resume-cache-prompt', prompt: 'resume cache guard' }],
    { taskType: 'image', modelId: 'test-model' },
    'canvas-resume-cache',
    'resume-cache-job-key',
  );
  durableGenerationQueue.pauseJob(job.id);
  const input = { jobId: job.id };
  const context = {
    ...userGrant('run-resume-cache-guard', 'generation.resumeJob', input),
    notify: { success() {}, warning() {}, error() {}, info() {} },
  };
  try {
    await toolRegistryInstance.execute('generation.resumeJob', input, context);
    assert.ok(['queued', 'running'].includes(durableGenerationQueue.getJob(job.id)?.status || ''));
    durableGenerationQueue.pauseJob(job.id);
    assert.equal(durableGenerationQueue.getJob(job.id)?.status, 'paused');
    await toolRegistryInstance.execute('generation.resumeJob', input, context);
    assert.ok(['queued', 'running'].includes(durableGenerationQueue.getJob(job.id)?.status || ''));
  } finally {
    durableGenerationQueue.clearAllJobs();
    durableGenerationQueue.registerExecutor(async () => []);
  }
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
    control: { effect: 'read' },
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
    control: { effect: 'read' },
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
  let arrangeCall: { mode?: string; nodeIds?: string[] } | null = null;
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
    arrangeAllNodes: (mode?: string, nodeIds?: string[]) => {
      arrangeCall = { mode, nodeIds };
    },
    notify: {
      success: () => {}
    }
  });

  assert.equal(result.status, 'arranged');
  assert.equal(result.preset, 'compact-grid');
  assert.equal(result.selectedCount, 2);
  assert.deepEqual(arrangeCall, { mode: 'grid', nodeIds: ['p1', 'img1'] });
});

test('ToolRegistry: canvas.arrangeNodes accepts layout alias and auxiliary card ids', async () => {
  let arrangeCall: { mode?: string; nodeIds?: string[] } | null = null;
  await toolRegistryInstance.execute('canvas.arrangeNodes', {
    nodeIds: ['note-1', 'workflow-1'],
    layout: 'column',
  }, {
    activeCanvas: {
      id: 'canvas-1',
      promptNodes: [],
      imageNodes: [],
      noteNodes: [{ id: 'note-1' }],
      workflow: { nodes: [{ id: 'workflow-1' }] },
      groups: [],
    },
    arrangeAllNodes: (mode?: string, nodeIds?: string[]) => {
      arrangeCall = { mode, nodeIds };
    },
  });
  assert.deepEqual(arrangeCall, { mode: 'column', nodeIds: ['note-1', 'workflow-1'] });
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

test('ToolRegistry: canonical card and workflow tools delegate to CanvasContext factory', async () => {
  const inputs: any[] = [];
  const createCard = (input: any) => {
    inputs.push(input);
    return {
      kind: input.kind,
      primaryNodeId: `${input.kind}-1`,
      promptNodes: [], imageNodes: [], noteNodes: [], workflowNodes: [],
    };
  };
  const card = await toolRegistryInstance.execute('canvas.createCard', {
    kind: 'text', prompt: 'AI summary',
  }, { createCard, notify: { success: () => {} } });
  const workflow = await toolRegistryInstance.execute('workflow.createPanel', {
    title: 'Publish flow', steps: [{ label: 'Review' }],
  }, { createCard, notify: { success: () => {} } });

  assert.equal(card.nodeId, 'text-1');
  assert.equal(workflow.nodeId, 'workflow-panel-1');
  assert.deepEqual(inputs.map((input) => input.kind), ['text', 'workflow-panel']);
});

test('ToolRegistry: drawing conversion delegates to the reversible note conversion handler', async () => {
  let drawingIds: string[] = [];
  const result = await toolRegistryInstance.execute('canvas.convertDrawingsToNote', {
    drawingIds: ['drawing-1'], title: 'Review note',
  }, {
    convertDrawingsToNote: (ids: string[]) => {
      drawingIds = ids;
      return { id: 'note-1' };
    },
  });

  assert.deepEqual(drawingIds, ['drawing-1']);
  assert.equal(result.nodeId, 'note-1');
});

test('ToolRegistry: notebook rasterization returns an ephemeral Blob result', async () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const result = await toolRegistryInstance.execute('canvas.rasterizeNote', {
    nodeId: 'note-1',
    scale: 2,
  }, {
    rasterizeNote: async () => ({
      blob,
      mimeType: 'image/png',
      width: 640,
      height: 480,
      sourceNodeIds: ['image-1'],
    }),
  });

  assert.equal(result.status, 'rasterized');
  assert.equal(result.blob, blob);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.width, 640);
  assert.deepEqual(result.sourceNodeIds, ['image-1']);
});

test('ToolRegistry: workflow panel executes enabled steps through the registry bridge', async () => {
  let latestData: any = null;
  const executed: string[] = [];
  const panel = {
    id: 'workflow-1',
    kind: 'workflow-panel',
    data: {
      title: 'Flow',
      status: 'idle',
      outputNodeIds: [],
      steps: [{
        id: 'step-1',
        label: 'Create text',
        enabled: true,
        status: 'idle',
        parameters: { toolName: 'canvas.createCard', input: '{"kind":"text","prompt":"summary"}' },
      }],
    },
  };
  const workflowInput = {
    nodeId: panel.id,
    action: 'run',
  } as const;
  await assert.rejects(toolRegistryInstance.execute('workflow.controlPanel', workflowInput, {
    ...userGrant('run-workflow-control-ai', 'workflow.controlPanel', workflowInput),
    activeCanvas: { workflow: { nodes: [panel] } },
    updateWorkflowNode: (_id: string, updates: any) => { latestData = updates.data; },
    executeTool: async (name: string) => {
      executed.push(name);
      return { nodeId: 'should-not-run' };
    },
  }), /requires a direct user action/);
  assert.deepEqual(executed, []);

  const result = await toolRegistryInstance.execute('workflow.controlPanel', workflowInput, {
    ...userGrant('run-workflow-control', 'workflow.controlPanel', workflowInput),
    trigger: 'user-action',
    activeCanvas: { workflow: { nodes: [panel] } },
    updateWorkflowNode: (_id: string, updates: any) => { latestData = updates.data; },
    executeTool: async (name: string) => {
      executed.push(name);
      return { nodeId: 'text-1' };
    },
  });

  assert.deepEqual(executed, ['canvas.createCard']);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.outputNodeIds, ['text-1']);
  assert.equal(latestData.steps[0].status, 'completed');
});

test('ToolRegistry: ecommerce batch transform tool creates a grouped durable job', async () => {
  const ecommerceInput = {
    imageIds: ['img-1', 'img-2'],
    rawUserRequest: 'compact ecommerce layout',
    aspectRatio: '4:5',
    layoutPreset: 'compact-grid',
    idempotencyKey: 'tool-registry-ecommerce-batch'
  };
  const result = await toolRegistryInstance.execute('ecommerce.createBatchTransformJob', ecommerceInput, {
    ...userGrant(
      'run-ecommerce-batch',
      'ecommerce.createBatchTransformJob',
      ecommerceInput,
      { activeCanvas: { id: 'canvas-1' }, selectedModel: { id: 'test-model' } },
    ),
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
  assert.equal(result.outputGroup.includePromptNodes, false);
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
    const retryInput = {
      jobId: createdJob.id,
      expectedUpdatedAt: failedJob!.updatedAt,
      expectedRetryablePromptIds: ['prompt-1'],
    };
    const result = await toolRegistryInstance.execute('generation.retryJob', retryInput, {
      ...userGrant('run-retry-job-tool', 'generation.retryJob', retryInput),
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

test('ToolRegistry: generation.retryJob rejects dynamic or missing targets before queue mutation', async () => {
  durableGenerationQueue.clearAllJobs();
  durableGenerationQueue.registerExecutor(null);
  const job = durableGenerationQueue.createJob(
    [{ id: 'retry-dynamic-guard-prompt', prompt: 'must remain untouched' }],
    { taskType: 'image', modelId: 'test-model' },
    'canvas-retry-dynamic-guard',
    'retry-dynamic-guard-job',
  );
  try {
    for (const input of [{}, { target: 'latest_failed' }]) {
      await assert.rejects(
        toolRegistryInstance.execute('generation.retryJob', input, {
          ...userGrant(`run-retry-dynamic-${JSON.stringify(input)}`, 'generation.retryJob', input),
          notify: { success() {} },
        }),
      );
    }
    assert.equal(durableGenerationQueue.getJob(job.id)?.status, 'queued');
    assert.equal(durableGenerationQueue.getJob(job.id)?.prompts[0]?.status, 'queued');
  } finally {
    durableGenerationQueue.clearAllJobs();
    durableGenerationQueue.registerExecutor(async () => []);
  }
});

test('ToolRegistry: generation queue controls reject missing jobs instead of reporting fake success', async () => {
  durableGenerationQueue.clearAllJobs();
  const successMessages: string[] = [];
  const mockCtx = {
    runId: 'run-missing-queue-control',
    notify: {
      success: (title: string) => successMessages.push(title),
      warning: () => {}
    }
  };

  for (const toolName of ['generation.pauseJob', 'generation.resumeJob', 'generation.cancelJob']) {
    const queueControlInput = { jobId: 'missing-job-id' };
    const executionContext = toolName === 'generation.pauseJob'
      ? mockCtx
      : { ...mockCtx, ...userGrant(mockCtx.runId, toolName, queueControlInput) };
    await assert.rejects(
      async () => {
        await toolRegistryInstance.execute(toolName, queueControlInput, executionContext);
      },
      /generation job not found: missing-job-id/,
    );
  }

  assert.deepEqual(successMessages, []);
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

  const frozenSelection = await toolRegistryInstance.execute('assets.resolveOriginals', {
    scope: 'selected_cards',
    selectedNodeIds: ['img-1'],
  }, {
    selectedNodeIds: ['img-2'],
    activeCanvas: {
      promptNodes: [],
      imageNodes: [
        { id: 'img-1', originalUrl: 'https://assets.kkai.plus/test-fixtures/original-1.png' },
        { id: 'img-2', originalUrl: 'https://assets.kkai.plus/test-fixtures/original-2.png' },
      ],
    },
  });
  assert.deepEqual(frozenSelection.items.map((item: any) => item.nodeId), ['img-1']);
});

test('ToolRegistry: KnowledgeSync tools record and search changes', async () => {
  const knowledgeInput = {
    title: 'Tool registry knowledge sync',
    summary: 'Registered knowledge.searchProject and knowledge.recordChange tools.',
    paths: ['apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts'],
    tools: ['knowledge.recordChange', 'knowledge.searchProject'],
    validation: ['tests/unit/ai-assistant-tool-registry.test.ts']
  };
  const change = await toolRegistryInstance.execute(
    'knowledge.recordChange',
    knowledgeInput,
    userGrant('run-knowledge-sync-change', 'knowledge.recordChange', knowledgeInput),
  );

  const uiChangeInput = {
    component: 'AI takeover toggle',
    summary: 'Selector remains stable for assistant highlighting.',
    selector: '#btn-ai-takeover-toggle',
    affectedTools: ['ui.highlightElement']
  };
  const uiChange = await toolRegistryInstance.execute(
    'ui.recordLayoutChange',
    uiChangeInput,
    userGrant('run-knowledge-sync-layout', 'ui.recordLayoutChange', uiChangeInput),
  );

  const skillInput = {
    name: 'record-knowledge-after-agent-change',
    trigger: 'Assistant, tool, UI, generation, download, or queue behavior changed',
    tools: ['knowledge.recordChange'],
    steps: ['Summarize change', 'List touched files', 'List validation commands'],
    validation: ['npm run governance:check']
  };
  const skill = await toolRegistryInstance.execute(
    'skills.upsertSkill',
    skillInput,
    userGrant('run-knowledge-sync-skill', 'skills.upsertSkill', skillInput),
  );

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
  const invalidBrowserInput = {
    url: 'file:///C:/Users/Administrator/secrets.txt'
  };
  await assert.rejects(
    () => toolRegistryInstance.execute(
      'browser.extractProduct',
      invalidBrowserInput,
      userGrant('run-browser-invalid-url', 'browser.extractProduct', invalidBrowserInput),
    ),
    /Browser Bridge only accepts http or https URLs/
  );
});

test('ToolRegistry: disconnected browser.extractProduct returns setup_required instead of fake success', async () => {
  const disconnectedBrowserInput = {
    url: 'https://example.com/item/1'
  };
  const result = await toolRegistryInstance.execute('browser.extractProduct', disconnectedBrowserInput, {
    ...userGrant('run-browser-disconnected', 'browser.extractProduct', disconnectedBrowserInput),
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

test('ToolRegistry: confirmed browser inspection and DOM writes require an explicit immutable target', async () => {
  let bridgeCalls = 0;
  const browserBridge = {
    execute: async (command: any) => {
      bridgeCalls += 1;
      return {
        id: command.id,
        status: 'success' as const,
        summary: 'confirmed target handled',
        data: { target: command.target },
        audit: { redacted: true },
      };
    },
  };
  const inspectInput = { includeOcr: true };
  await assert.rejects(
    toolRegistryInstance.execute(
      'browser.inspectPage',
      inspectInput,
      { ...userGrant('run-browser-inspect-target', 'browser.inspectPage', inspectInput), browserBridge },
    ),
    /explicit public http\(s\) target URL/,
  );
  const writeInput = { title: 'Confirmed title', price: '19.99' };
  await assert.rejects(
    toolRegistryInstance.execute(
      'browser.writeBackDom',
      writeInput,
      { ...userGrant('run-browser-write-target', 'browser.writeBackDom', writeInput), browserBridge },
    ),
    /explicit public http\(s\) target URL/,
  );

  for (const [index, target] of ['active_tab', 'CURRENT-TAB', ' current_page ', 'viewport'].entries()) {
    const dynamicInspectInput = { target, includeOcr: true };
    await assert.rejects(toolRegistryInstance.execute(
      'browser.inspectPage',
      dynamicInspectInput,
      {
        ...userGrant(`run-browser-dynamic-target-${index}`, 'browser.inspectPage', dynamicInspectInput),
        browserBridge,
      },
    ), /Browser Bridge requires a valid URL/);
  }
  assert.equal(bridgeCalls, 0);

  const explicitUrl = 'https://example.com/catalog/item?id=1';
  const validInspectInput = { target: explicitUrl, includeOcr: true };
  const inspectResult = await toolRegistryInstance.execute(
    'browser.inspectPage',
    validInspectInput,
    {
      ...userGrant('run-browser-explicit-inspect', 'browser.inspectPage', validInspectInput),
      browserBridge,
    },
  );
  assert.equal(inspectResult.data.target, explicitUrl);

  const validWriteInput = { target: explicitUrl, title: 'Confirmed title', price: '19.99' };
  await toolRegistryInstance.execute(
    'browser.writeBackDom',
    validWriteInput,
    {
      ...userGrant('run-browser-explicit-write', 'browser.writeBackDom', validWriteInput),
      browserBridge,
    },
  );
  assert.equal(bridgeCalls, 2);
});

test('ToolRegistry: browser side effects coalesce repeated idempotency keys', async () => {
  const observedCommands: any[] = [];
  const input = {
    prompt: 'one external poster',
    platformId: 'leonardo',
    count: 1,
    idempotencyKey: 'run-browser-idempotency:generate:1',
  };
  const context = {
    ...userGrant('run-browser-idempotency', 'browser.generateExternal', input),
    browserBridge: {
      execute: async (command: any) => {
        observedCommands.push(command);
        return {
          id: command.id,
          status: 'success' as const,
          summary: 'queued once',
          data: { jobId: 'external-job-1' },
          audit: { redacted: true },
        };
      },
    },
  };
  const first = await toolRegistryInstance.execute('browser.generateExternal', input, context);
  const second = await toolRegistryInstance.execute('browser.generateExternal', input, context);

  assert.equal(first.id, second.id);
  assert.equal(observedCommands.length, 1);
  assert.equal(observedCommands[0]?.idempotencyKey, input.idempotencyKey);
  assert.equal(observedCommands[0]?.payload?.idempotencyKey, input.idempotencyKey);
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
  assert.equal(resultGemini.multimodal, false);
  assert.equal(resultGemini.fallback, 'undeclared');

  const resultDeclared = await toolRegistryInstance.execute('provider.getModelCapabilities', {
    modelId: 'declared-vision-model'
  }, {
    getModelRouteMeta: async () => ({
      modelId: 'declared-vision-model',
      multimodal: true,
      image_understanding: true,
      generationCapabilities: { imageGeneration: true }
    })
  });
  assert.equal(resultDeclared.multimodal, true);

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

test('ToolRegistry: UI action tools report capability_unavailable when host handlers are missing', async () => {
  const successMessages: string[] = [];
  const baseCtx = {
    ...userGrant('run-ui-capability-missing', 'submitPromptComposer', {}),
    notify: {
      success: (title: string) => successMessages.push(title),
      warning: () => {}
    }
  };

  const cases: Array<{ toolName: string; input: any; expectedCode?: string }> = [
    { toolName: 'locateApiCard', input: { idOrName: 'deepseek' } },
    { toolName: 'openSettings', input: { tab: 'api-management' } },
    { toolName: 'ui.navigateToSurface', input: { surface: 'workspace' } },
    { toolName: 'fillInputPrompt', input: { prompt: 'optimized prompt' } },
    { toolName: 'changeMode', input: { mode: 'image' } },
    { toolName: 'ui.switchPptEditorMode', input: { mode: 'outline' } },
    { toolName: 'submitPromptComposer', input: {}, expectedCode: 'DIRECT_USER_ACTION_REQUIRED' },
    { toolName: 'ui.openToolWindow', input: { toolId: 'calculator' } },
    { toolName: 'ui.pinTool', input: { toolId: 'calculator', pinned: true } },
    { toolName: 'ui.updateWindowLayout', input: { instanceId: 'missing-window', x: 10 } },
    { toolName: 'audio.playbackControl', input: { nodeId: 'missing-audio', action: 'PLAY' } }
  ];

  for (const item of cases) {
    const result = await toolRegistryInstance.execute(item.toolName, item.input, baseCtx);
    assert.equal(result.success, false, `${item.toolName} must not be logged as a successful action`);
    assert.equal(result.code, item.expectedCode || 'CAPABILITY_UNAVAILABLE');
  }

  assert.deepEqual(successMessages, []);
});

test('ToolRegistry: canvas creation tools report capability_unavailable when canvas mutators are missing', async () => {
  const successMessages: string[] = [];
  const result = await toolRegistryInstance.execute('canvas.createAudioCard', {
    prompt: 'voice over',
    url: 'https://example.test/audio.mp3'
  }, {
    runId: 'run-canvas-capability-missing',
    getNextCardPosition: () => ({ x: 100, y: 100 }),
    notify: {
      success: (title: string) => successMessages.push(title),
      warning: () => {}
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'CAPABILITY_UNAVAILABLE');
  assert.deepEqual(successMessages, []);
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

test('ToolRegistry: optimizePromptLocally performs real local prompt optimization', async () => {
  const result = await toolRegistryInstance.execute('optimizePromptLocally', {
    subject: 'cyberpunk tea poster',
    style: 'retro'
  }, {});

  assert.ok(result.optimizedPrompt);
  assert.match(result.optimizedPrompt, /cyberpunk tea poster/);
  assert.match(result.optimizedPrompt, /retro style/);
  assert.match(result.optimizedPrompt, /highly detailed/);
});

test('ToolRegistry: generation.createAudioTask uses the unified durable audio queue', async () => {
  const legacyAudioInput = {
    prompt: 'test audio prompt'
  };
  const result = await toolRegistryInstance.execute('generation.createAudioTask', legacyAudioInput, {
    ...userGrant(
      'run-legacy-audio-tool',
      'generation.createAudioTask',
      legacyAudioInput,
      { activeCanvas: { id: 'canvas-audio' }, selectedModel: { id: 'audio-model' } },
    ),
    activeCanvas: { id: 'canvas-audio' },
    selectedModel: { id: 'audio-model' },
    notify: {
      info: () => {},
      success: () => {},
      error: () => {}
    }
  });

  assert.equal(result.taskType, 'audio');
  assert.equal(result.status, 'queued');

  // 验证日志状态
  const logs = toolRegistryInstance.getLogs();
  const latestLog = logs[logs.length - 1];
  assert.equal(latestLog.toolName, 'generation.createAudioTask');
  assert.equal(latestLog.status, 'success');
});

test('ToolRegistry: each execution and verification resolve the latest canvas context', async () => {
  const registry = new AgentToolRegistry();
  let liveContext = {
    activeCanvas: { id: 'canvas-live-1', lastModified: 11 },
    selectedNodeIds: ['node-live-1'],
    canvasRuntimeState: { canvasId: 'canvas-live-1', revision: 11 },
  };
  const handlerSnapshots: any[] = [];
  const verificationSnapshots: any[] = [];

  registry.register({
    name: 'read-live-context',
    description: 'captures the live canvas context',
    permission: 'safe',
    control: { effect: 'read' },
    inputSchema: {},
    handler: async (_input, ctx) => {
      handlerSnapshots.push({
        canvasId: ctx.activeCanvas.id,
        selectedNodeIds: [...ctx.selectedNodeIds],
        runtimeCanvasId: ctx.canvasRuntimeState.canvasId,
        canvasRevision: ctx.canvasRevision,
      });
      liveContext = {
        activeCanvas: { id: `${ctx.activeCanvas.id}-verified`, lastModified: ctx.canvasRevision + 1 },
        selectedNodeIds: [`${ctx.selectedNodeIds[0]}-verified`],
        canvasRuntimeState: {
          canvasId: `${ctx.canvasRuntimeState.canvasId}-verified`,
          revision: ctx.canvasRevision + 1,
        },
      };
      return { success: true };
    },
    verify: async (_output, _input, ctx) => {
      verificationSnapshots.push({
        canvasId: ctx.activeCanvas.id,
        selectedNodeIds: [...ctx.selectedNodeIds],
        runtimeCanvasId: ctx.canvasRuntimeState.canvasId,
        canvasRevision: ctx.canvasRevision,
      });
      return true;
    },
  });

  const staleSnapshot = {
    activeCanvas: { id: 'canvas-stale', lastModified: 1 },
    selectedNodeIds: ['node-stale'],
    canvasRuntimeState: { canvasId: 'canvas-stale', revision: 1 },
    getActiveCanvas: () => liveContext.activeCanvas,
    getSelectedNodeIds: () => liveContext.selectedNodeIds,
    getCanvasRuntimeState: () => liveContext.canvasRuntimeState,
  };

  await registry.execute('read-live-context', {}, staleSnapshot);

  liveContext = {
    activeCanvas: { id: 'canvas-live-2', lastModified: 22 },
    selectedNodeIds: ['node-live-2'],
    canvasRuntimeState: { canvasId: 'canvas-live-2', revision: 22 },
  };
  await registry.execute('read-live-context', {}, staleSnapshot);

  assert.deepEqual(handlerSnapshots, [
    {
      canvasId: 'canvas-live-1',
      selectedNodeIds: ['node-live-1'],
      runtimeCanvasId: 'canvas-live-1',
      canvasRevision: 11,
    },
    {
      canvasId: 'canvas-live-2',
      selectedNodeIds: ['node-live-2'],
      runtimeCanvasId: 'canvas-live-2',
      canvasRevision: 22,
    },
  ]);
  assert.deepEqual(verificationSnapshots, [
    {
      canvasId: 'canvas-live-1-verified',
      selectedNodeIds: ['node-live-1-verified'],
      runtimeCanvasId: 'canvas-live-1-verified',
      canvasRevision: 12,
    },
    {
      canvasId: 'canvas-live-2-verified',
      selectedNodeIds: ['node-live-2-verified'],
      runtimeCanvasId: 'canvas-live-2-verified',
      canvasRevision: 23,
    },
  ]);
});
