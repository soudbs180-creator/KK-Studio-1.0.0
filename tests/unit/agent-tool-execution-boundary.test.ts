import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  AgentToolRegistry,
  toolRegistryInstance,
} from '../../apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts';
import { durableGenerationQueue } from '../../apps/web/src/features/ai-assistant-runtime/queue/DurableGenerationQueue.ts';

const confirmationContext = (runId: string, toolNames: string[]) => ({
  runId,
  confirmationGrant: { runId, confirmed: true, toolNames },
  activeCanvas: { id: 'canvas-test' },
  selectedModel: { id: 'model-test' },
  notify: { success() {}, error() {}, warning() {}, info() {} },
});

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
        confirmationGrant: { runId: 'run-1', confirmed: true, toolNames: ['costly.write'] },
      }),
      /Confirmation grant required/,
    );
    const output = await registry.execute('costly.write', {}, confirmationContext('run-1', ['costly.write']));
    assert.deepEqual(output, { ok: true });
  });

  it('validates input before invoking a handler', async () => {
    const registry = new AgentToolRegistry();
    let invoked = false;
    registry.register({
      name: 'validated.read',
      description: 'test validation tool',
      permission: 'safe',
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

  it('routes explicit video, audio, and legacy mode inputs to media jobs', async () => {
    durableGenerationQueue.clearAllJobs();
    durableGenerationQueue.registerExecutor(null);

    const video = await toolRegistryInstance.execute('generation.createVideoJob', {
      prompt: 'orbit around the product',
      durationSeconds: 5,
      referenceImageNodeId: 'image-1',
    }, confirmationContext('run-video', ['generation.createVideoJob']));
    const audio = await toolRegistryInstance.execute('generation.createAudioJob', {
      prompt: 'soft ambient sound',
      durationSeconds: 30,
    }, confirmationContext('run-audio', ['generation.createAudioJob']));
    const legacyVideo = await toolRegistryInstance.execute('startGeneration', {
      prompt: 'slow dolly shot',
      count: 4,
      mode: 'video',
      options: { durationSeconds: 5 },
    }, confirmationContext('run-legacy-video', ['startGeneration']));

    assert.equal(video.taskType, 'video');
    assert.equal(video.options.durationSeconds, 5);
    assert.equal(video.prompts[0].referenceImageNodeId, 'image-1');
    assert.equal(audio.taskType, 'audio');
    assert.equal(audio.options.concurrency, 2);
    assert.equal(legacyVideo.taskType, 'video');
    assert.equal(legacyVideo.prompts.length, 1);
  });
});
