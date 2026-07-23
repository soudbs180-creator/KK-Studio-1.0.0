import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  AgentToolRegistry,
  toolRegistryInstance,
} from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { buildAssetZipToolOutcome } from '../../apps/web/src/features/ai-assistant-runtime/tools/assetTools.ts';
import { durableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import { AgentAuditLog } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentAuditLog.ts';
import {
  captureAssistantAuthorizationScope,
  createAssistantConfirmationExpiresAt,
  createAssistantPlanHash,
  createAssistantStepAuthorization,
  createAssistantTargetSnapshotHash,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';

const confirmationContext = (runId: string, toolNames: string[], input: unknown = {}) => {
  const planId = `${runId}:plan`;
  const stepId = toolNames[0] || 'unauthorized-step';
  const baseContext = {
    runId,
    planId,
    stepId,
    currentPage: 'canvas' as const,
    trigger: 'assist-confirmed' as const,
    activeCanvas: { id: 'canvas-test' },
    selectedModel: { id: 'model-test' },
  };
  const authorizationScope = captureAssistantAuthorizationScope(baseContext);
  const grantedAt = new Date().toISOString();
  return {
    ...baseContext,
    confirmationGrant: {
      runId,
      planId,
      planHash: createAssistantPlanHash({ planId, toolNames, input }),
      targetSnapshotHash: createAssistantTargetSnapshotHash(authorizationScope),
      ownerId: authorizationScope.ownerId,
      confirmed: true as const,
      toolNames,
      authorizationScope,
      authorizedSteps: toolNames.map((toolName) => createAssistantStepAuthorization({
        runId,
        stepId,
        toolName,
        input,
        context: baseContext,
        authorizationScope,
      })),
      source: 'user' as const,
      grantedAt,
      expiresAt: createAssistantConfirmationExpiresAt(grantedAt),
    },
  activeCanvas: { id: 'canvas-test' },
  notify: { success() {}, error() {}, warning() {}, info() {} },
  };
};

describe('Agent ToolRegistry execution boundary', () => {
  it('requires a run-scoped grant for confirm tools', async () => {
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'costly.write',
      description: 'test confirm tool',
      permission: 'confirm',
      inputSchema: {},
      handler: async () => ({ ok: true }),
    });
    await assert.rejects(
      registry.execute('costly.write', {}, { runId: 'run-1' }),
      /Confirmation grant required/,
    );
    await assert.rejects(
      registry.execute('costly.write', {}, {
        ...confirmationContext('run-2', ['costly.write']),
        confirmationGrant: confirmationContext('run-1', ['costly.write']).confirmationGrant,
      }),
      /Confirmation grant required/,
    );
    await assert.rejects(
      registry.execute('costly.write', {}, confirmationContext('run-1', [])),
      /Confirmation grant required/,
    );
    await assert.rejects(
      registry.execute('costly.write', {}, {
        ...confirmationContext('run-1', ['costly.write']),
        confirmationGrant: {
          ...confirmationContext('run-1', ['costly.write']).confirmationGrant,
          grantedAt: 'not-a-date',
        },
      }),
      /Confirmation grant required/,
    );
    const expiredContext = confirmationContext('run-1', ['costly.write']);
    expiredContext.confirmationGrant.grantedAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    await assert.rejects(
      registry.execute('costly.write', {}, expiredContext),
      /Confirmation grant required/,
    );
    const futureContext = confirmationContext('run-1', ['costly.write']);
    futureContext.confirmationGrant.grantedAt = new Date(Date.now() + 31 * 1000).toISOString();
    await assert.rejects(
      registry.execute('costly.write', {}, futureContext),
      /Confirmation grant required/,
    );
    await assert.rejects(
      registry.execute(
        'costly.write',
        { target: 'job-b' },
        confirmationContext('run-1', ['costly.write'], { target: 'job-a' }),
      ),
      /Confirmation grant required/,
    );
    const output = await registry.execute('costly.write', {}, confirmationContext('run-1', ['costly.write']));
    assert.deepEqual(output, { ok: true });
    await assert.rejects(
      registry.execute(
        'costly.write',
        {},
        confirmationContext('run-1', ['costly.write'], { target: 'changed-after-cache' }),
      ),
      /Confirmation grant required/,
    );
  });

  it('blocks generation resume before queue lookup unless the user granted it', async () => {
    const resumeTool = toolRegistryInstance.getTool('generation.resumeJob');
    assert.equal(resumeTool?.permission, 'confirm');
    assert.equal(resumeTool?.control.cost.kind, 'variable');

    await assert.rejects(
      toolRegistryInstance.execute(
        'generation.resumeJob',
        { jobId: 'missing-resume-job' },
        { runId: 'run-resume-without-grant' },
      ),
      /Confirmation grant required for tool: generation\.resumeJob/,
    );
  });

  it('does not confuse a domain status with the tool execution outcome', async () => {
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'domain.readStatus',
      description: 'read a cancelled domain object',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: { type: 'object' },
      handler: async () => ({ id: 'job-cancelled', status: 'cancelled' }),
    });

    const output = await registry.execute('domain.readStatus', {}, { runId: 'run-domain-status' });
    assert.equal(output.status, 'cancelled');
    const successLogs = registry.getLogs();
    assert.equal(successLogs[successLogs.length - 1]?.status, 'success');
  });

  it('fails closed when a mutation returns no structured outcome evidence', async () => {
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'mutation.withoutEvidence',
      description: 'mutation with no result evidence',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: { type: 'object' },
      handler: async () => undefined,
    });

    await assert.rejects(
      registry.execute('mutation.withoutEvidence', {}, { runId: 'run-no-evidence' }),
      /outcome evidence/i,
    );
    const failedLogs = registry.getLogs();
    assert.equal(failedLogs[failedLogs.length - 1]?.status, 'verification_failed');
  });

  it('does not let scalar evidence override an explicit ok=false mutation result', async () => {
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'mutation.explicitFailure',
      description: 'explicit failure must win over an id field',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: { type: 'object' },
      handler: async () => ({ ok: false, id: 'misleading-id' }),
    });

    const output = await registry.execute('mutation.explicitFailure', {}, { runId: 'run-explicit-failure' });
    assert.equal(output.ok, false);
    const explicitFailureLogs = registry.getLogs();
    assert.equal(explicitFailureLogs[explicitFailureLogs.length - 1]?.status, 'failed');
  });

  it('rejects whitespace-only scalar mutation evidence', async () => {
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'mutation.whitespaceEvidence',
      description: 'whitespace is not proof of a mutation outcome',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: { type: 'object' },
      handler: async () => ({ id: '   ' }),
    });

    await assert.rejects(
      registry.execute('mutation.whitespaceEvidence', {}, { runId: 'run-whitespace-evidence' }),
      /outcome evidence/i,
    );
    const whitespaceLogs = registry.getLogs();
    assert.equal(whitespaceLogs[whitespaceLogs.length - 1]?.status, 'verification_failed');
  });

  it('rejects malformed explicit idempotency keys before invoking a mutation handler', async () => {
    const invalidKeys: unknown[] = [null, '', '   ', 42, 'x'.repeat(256)];
    for (const [index, idempotencyKey] of invalidKeys.entries()) {
      const registry = new AgentToolRegistry();
      let handlerCalls = 0;
      registry.register({
        name: `mutation.invalidIdempotency${index}`,
        description: 'invalid idempotency key test',
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

      await assert.rejects(
        registry.execute(
          `mutation.invalidIdempotency${index}`,
          { idempotencyKey },
          { runId: `run-invalid-idempotency-${index}` },
        ),
        /Idempotency key/i,
      );
      assert.equal(handlerCalls, 0);
      const invalidKeyLogs = registry.getLogs();
      assert.equal(invalidKeyLogs[invalidKeyLogs.length - 1]?.failureClass, 'validation');
    }
  });

  it('redacts externally supplied AgentAuditLog errors before writing to the console', (t) => {
    const originalConsoleError = console.error;
    const captured: unknown[][] = [];
    console.error = (...args: unknown[]) => { captured.push(args); };
    t.after(() => { console.error = originalConsoleError; });

    new AgentAuditLog().logCall({
      id: 'audit-external-error',
      runId: 'run-audit-external-error',
      toolName: 'external.tool',
      inputSummary: '{}',
      status: 'failed',
      error: 'Bearer short-audit-secret',
      startedAt: '2026-07-19T00:00:00.000Z',
    });

    const serialized = JSON.stringify(captured);
    assert.equal(serialized.includes('short-audit-secret'), false);
    assert.match(serialized, /Bearer \*\*\*/);
  });

  it('validates required schema fields when the caller omits the whole input', async () => {
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'read.requiredInput',
      description: 'required input contract',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: {
        type: 'object',
        properties: { jobId: { type: 'string' } },
        required: ['jobId'],
      },
      handler: async () => ({ ok: true }),
    });

    await assert.rejects(
      registry.execute('read.requiredInput', undefined, { runId: 'run-required-input' }),
      /Missing required tool input field: jobId/,
    );
  });

  it('derives an idempotency key when a mutation omits optional input', async () => {
    const registry = new AgentToolRegistry();
    let observedInput: Record<string, unknown> | undefined;
    registry.register({
      name: 'mutation.optionalInput',
      description: 'mutation with optional input',
      permission: 'confirm',
      inputSchema: { type: 'object' },
      handler: async (input: Record<string, unknown>) => {
        observedInput = input;
        return { ok: true };
      },
    });

    await registry.execute(
      'mutation.optionalInput',
      undefined,
      confirmationContext('run-optional-input', ['mutation.optionalInput']),
    );

    assert.equal(observedInput?.idempotencyKey, 'run-optional-input:mutation.optionalInput');
    assert.equal(registry.getLogs()[0]?.idempotencyKey, 'run-optional-input:mutation.optionalInput');
  });

  it('validates input before invoking a handler', async () => {
    const registry = new AgentToolRegistry();
    let invoked = false;
    registry.register({
      name: 'validated.read',
      description: 'test validation tool',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: {},
      inputValidator: z.object({ count: z.number().int().min(1).max(4) }),
      handler: async () => {
        invoked = true;
        return true;
      },
    });
    await assert.rejects(registry.execute('validated.read', { count: 9 }, { runId: 'run-validation' }));
    assert.equal(invoked, false);
  });

  it('does not mark a tool successful until verification passes', async () => {
    const registry = new AgentToolRegistry();
    registry.register({
      name: 'verified.write',
      description: 'test verification tool',
      permission: 'safe',
      control: { recovery: { reversible: true } },
      inputSchema: {},
      handler: async () => ({ id: 'missing' }),
      verify: async () => ({ success: false, message: 'canvas node was not persisted' }),
    });
    await assert.rejects(
      registry.execute('verified.write', {}, { runId: 'run-verification' }),
      /canvas node was not persisted/,
    );
    const logs = registry.getLogs();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, 'verification_failed');
  });

  it('records cancellation during asynchronous verification instead of success', async () => {
    const registry = new AgentToolRegistry();
    const abortController = new AbortController();
    let signalVerificationStarted!: () => void;
    let releaseVerification!: () => void;
    const verificationStarted = new Promise<void>((resolve) => { signalVerificationStarted = resolve; });
    const verificationRelease = new Promise<void>((resolve) => { releaseVerification = resolve; });
    registry.register({
      name: 'read.cancelDuringVerification',
      description: 'verifier cancellation boundary',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: { type: 'object' },
      handler: async () => ({ ok: true }),
      verify: async () => {
        signalVerificationStarted();
        await verificationRelease;
        return true;
      },
    });

    const execution = registry.execute('read.cancelDuringVerification', {}, {
      runId: 'run-cancel-verifier',
      signal: abortController.signal,
    });
    await verificationStarted;
    abortController.abort();
    releaseVerification();

    await assert.rejects(execution, /cancelled/i);
    const logs = registry.getLogs();
    const latestLog = logs[logs.length - 1];
    assert.equal(latestLog?.status, 'cancelled');
    assert.equal(latestLog?.outcome, 'cancelled');
  });

  it('lets an aborted signal win when a late handler rejects with a network error', async () => {
    const registry = new AgentToolRegistry();
    const abortController = new AbortController();
    let signalHandlerStarted!: () => void;
    let releaseHandler!: () => void;
    const handlerStarted = new Promise<void>((resolve) => { signalHandlerStarted = resolve; });
    const handlerRelease = new Promise<void>((resolve) => { releaseHandler = resolve; });
    registry.register({
      name: 'read.abortBeforeNetworkFailure',
      description: 'abort must remain the terminal execution reason',
      permission: 'safe',
      control: { effect: 'read' },
      inputSchema: { type: 'object' },
      handler: async () => {
        signalHandlerStarted();
        await handlerRelease;
        throw new Error('network_down');
      },
    });

    const execution = registry.execute('read.abortBeforeNetworkFailure', {}, {
      runId: 'run-abort-network',
      signal: abortController.signal,
    });
    await handlerStarted;
    abortController.abort();
    releaseHandler();

    await assert.rejects(execution, /network_down/);
    const logs = registry.getLogs();
    const latestLog = logs[logs.length - 1];
    assert.equal(latestLog?.status, 'cancelled');
    assert.equal(latestLog?.failureClass, 'cancelled');
    assert.equal(latestLog?.outcome, 'cancelled');
  });

  it('preserves the ZIP manifest and treats an all-failed archive as retryable failure', () => {
    const manifest = {
      projectName: 'KKStudio',
      batchId: 'batch-all-failed',
      scope: 'selected_cards',
      createdAt: '2026-07-15T00:00:00.000Z',
      count: 0,
      failedCount: 1,
      items: [],
      failedItems: [{
        nodeId: 'node-1',
        reason: 'network_down',
        attemptedSources: ['url'] as Array<'url'>,
      }],
    };

    const output = buildAssetZipToolOutcome({ count: 0, failedCount: 1, manifest });

    assert.equal(output.manifest, manifest);
    assert.equal(output.status, 'failed');
    assert.equal(output.executionOutcome, 'retryable_failure');
  });

  it('routes explicit video, audio, and legacy mode inputs to media jobs', async () => {
    durableGenerationQueue.clearAllJobs();
    durableGenerationQueue.registerExecutor(null);

    const videoInput = {
      prompt: 'orbit around the product',
      durationSeconds: 5,
      referenceImageNodeId: 'image-1',
    };
    const video = await toolRegistryInstance.execute(
      'generation.createVideoJob',
      videoInput,
      confirmationContext('run-video', ['generation.createVideoJob'], videoInput),
    );
    const audioInput = {
      prompt: 'soft ambient sound',
      durationSeconds: 30,
    };
    const audio = await toolRegistryInstance.execute(
      'generation.createAudioJob',
      audioInput,
      confirmationContext('run-audio', ['generation.createAudioJob'], audioInput),
    );
    const legacyVideoInput = {
      prompt: 'slow dolly shot',
      count: 4,
      mode: 'video',
      options: { durationSeconds: 5 },
    };
    const legacyVideo = await toolRegistryInstance.execute(
      'startGeneration',
      legacyVideoInput,
      confirmationContext('run-legacy-video', ['startGeneration'], legacyVideoInput),
    );

    assert.equal(video.taskType, 'video');
    assert.equal(video.options.durationSeconds, 5);
    assert.equal(video.prompts[0].referenceImageNodeId, 'image-1');
    assert.equal(audio.taskType, 'audio');
    assert.equal(audio.options.concurrency, 2);
    assert.equal(legacyVideo.taskType, 'video');
    assert.equal(legacyVideo.prompts.length, 1);
  });
});
