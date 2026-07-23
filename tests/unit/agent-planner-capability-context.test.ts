import assert from 'node:assert/strict';
import test from 'node:test';
import { CapabilityGraphSnapshotDtoSchema } from '../../packages/shared/src/index.ts';

import {
  applyAgentPlannerCapabilityContext,
  buildAgentPlannerCapabilityContext,
  enforceAgentPlannerCapabilityPolicy,
  resolveAgentPlannerCapabilityContext,
} from '../../apps/web/src/features/ai-takeover/core/agentPlannerCapabilityContext.ts';
import { buildAgentPlannerLlmMessages } from '../../apps/web/src/features/ai-takeover/core/agentPlannerContext.ts';
import type {
  AssistantPlan,
  SanitizedProjectContext,
} from '../../apps/web/src/features/ai-takeover/types.ts';
import { readSource } from '../support/workspacePaths.js';

const TIMESTAMP = '2026-07-22T00:00:00.000Z';
const CONNECTION_ID = '550e8400-e29b-41d4-a716-446655440000';

function createSnapshot() {
  return CapabilityGraphSnapshotDtoSchema.parse({
    version: 'v1',
    generatedAt: TIMESTAMP,
    nodes: [
      {
        id: 'provider:google', type: 'Provider', providerId: 'google', displayName: 'Google',
        status: 'available', ownerScope: 'global', source: 'catalog', version: '1', updatedAt: TIMESTAMP,
      },
      {
        id: `connection:${CONNECTION_ID}`, type: 'ProviderConnection', connectionId: CONNECTION_ID,
        providerId: 'google', displayName: 'Private connection name', hasSecret: true,
        status: 'connected', ownerScope: 'user', source: 'connections', version: '1', updatedAt: TIMESTAMP,
      },
      {
        id: 'model:google:gemini-image', type: 'Model', modelId: 'gemini-image', providerId: 'google',
        displayName: 'Gemini Image', status: 'available', ownerScope: 'user', source: 'bindings',
        version: '1', updatedAt: TIMESTAMP,
      },
      {
        id: 'capability:image.generate', type: 'Capability', capabilityId: 'image.generate',
        displayName: 'Image generation', mediaType: 'image', status: 'available', ownerScope: 'user',
        source: 'bindings', version: '1', updatedAt: TIMESTAMP,
      },
    ],
    edges: [
      {
        from: `connection:${CONNECTION_ID}`, to: 'model:google:gemini-image', relation: 'binds',
        status: 'active', source: 'bindings',
        constraints: { channel: 'byok', requestProfile: 'google-v1beta', credential: 'must-not-project' },
        permissions: 'safe', version: '1',
      },
      {
        from: 'model:google:gemini-image', to: 'capability:image.generate', relation: 'supports',
        status: 'active', source: 'bindings', constraints: {}, permissions: 'confirm', version: '1',
      },
    ],
  });
}

function createProjectContext(): SanitizedProjectContext {
  return {
    currentPage: 'canvas',
    aiTakeover: { enabled: true, mode: 'local', collaborationMode: 'assist' },
    agent: { enabled: true },
    canvas: { id: 'canvas-capability', selectedNodeIds: [], promptNodes: [], imageNodes: [] },
    assets: { imageCollections: [], images: [], files: [], outputs: [] },
    settings: { apiKeyStatus: 'configured_masked', providerCount: 1 },
    billing: { balanceKnown: false, canEstimateCost: false },
    errors: [],
  };
}

function createPlan(): AssistantPlan {
  return {
    id: 'plan-capability-policy',
    reply: 'Plan ready.',
    intent: 'generate_images',
    confidence: 0.9,
    actions: [
      {
        type: 'generation.createBatchJob',
        payload: { prompts: [{ prompt: 'poster' }], options: { modelId: 'gemini-image' } },
      },
      {
        type: 'generation.createVideoJob',
        payload: { prompt: 'motion', modelId: 'gemini-image' },
      },
      {
        type: 'generation.createAudioJob',
        payload: { prompt: 'soundtrack', modelId: 'guessed-audio-model' },
      },
    ],
    steps: [{
      stepId: 'legacy-model-step',
      action: {
        type: 'generation.start',
        payload: { prompt: 'legacy', count: 1, options: { modelId: 'guessed-legacy-model' } },
      },
      dependsOn: [],
      idempotencyKey: 'legacy-model-step',
      verification: { required: true, rule: 'queue_job' },
    }],
    requiresConfirmation: true,
  };
}

test('projects only active, bounded and secret-free capability routes for Planner input', () => {
  const context = buildAgentPlannerCapabilityContext(createSnapshot());

  assert.deepEqual(context, {
    version: 'v1',
    generatedAt: TIMESTAMP,
    authority: 'discovery_only',
    routes: [{
      connectionId: CONNECTION_ID,
      providerId: 'google',
      modelId: 'gemini-image',
      capabilityId: 'image.generate',
      mediaType: 'image',
      channel: 'byok',
      requestProfile: 'google-v1beta',
      permission: 'confirm',
    }],
  });
  assert.doesNotMatch(JSON.stringify(context), /must-not-project|Private connection name|hasSecret/);
});

test('queries capabilities.listAvailable through an owner-bound abortable ToolRegistry port', async () => {
  let observedTool = '';
  let observedOwner = '';
  let observedSignal: AbortSignal | undefined;
  const context = await resolveAgentPlannerCapabilityContext('owner-capability-a', {
    executeTool: async (toolName, _input, executionContext) => {
      observedTool = toolName;
      observedOwner = executionContext.executionOwnerId;
      observedSignal = executionContext.signal;
      return createSnapshot();
    },
    getOwnerId: () => 'owner-capability-a',
  });

  assert.equal(observedTool, 'capabilities.listAvailable');
  assert.equal(observedOwner, 'owner-capability-a');
  assert.ok(observedSignal instanceof AbortSignal);
  assert.equal(context?.routes[0]?.modelId, 'gemini-image');
});

test('drops a capability response after owner change or timeout', async () => {
  let ownerId = 'owner-capability-a';
  const changedOwner = await resolveAgentPlannerCapabilityContext(ownerId, {
    executeTool: async () => {
      ownerId = 'owner-capability-b';
      return createSnapshot();
    },
    getOwnerId: () => ownerId,
  });
  assert.equal(changedOwner, undefined);

  const timedOut = await resolveAgentPlannerCapabilityContext('owner-capability-a', {
    executeTool: async () => new Promise<never>(() => {}),
    getOwnerId: () => 'owner-capability-a',
    timeoutMs: 5,
  });
  assert.equal(timedOut, undefined);
});

test('adds the capability summary to Planner input without requiring a bound Session', () => {
  const plannerContext = applyAgentPlannerCapabilityContext(
    createProjectContext(),
    buildAgentPlannerCapabilityContext(createSnapshot()),
  );
  const messages = buildAgentPlannerLlmMessages('system-policy', plannerContext, 'Generate a poster.');

  assert.equal(messages.length, 2);
  assert.match(messages[1].content, /"capabilityGraph"/);
  assert.match(messages[1].content, /"modelId": "gemini-image"/);
  assert.doesNotMatch(messages[1].content, /must-not-project|Private connection name/);
});

test('keeps only model hints backed by the matching media capability', () => {
  const guarded = enforceAgentPlannerCapabilityPolicy(
    createPlan(),
    buildAgentPlannerCapabilityContext(createSnapshot()),
  );
  const batchOptions = guarded.actions[0]?.payload as { options?: Record<string, unknown> };
  const videoPayload = guarded.actions[1]?.payload as { modelId?: string };
  const audioPayload = guarded.actions[2]?.payload as { modelId?: string };
  const legacyPayload = guarded.steps?.[0]?.action.payload as { options?: Record<string, unknown> };

  assert.equal(batchOptions.options?.modelId, 'gemini-image');
  assert.equal(videoPayload.modelId, undefined);
  assert.equal(audioPayload.modelId, undefined);
  assert.equal(legacyPayload.options?.modelId, undefined);
  assert.equal(guarded.requiresConfirmation, true);
});

test('AgentRuntime resolves capability context before both Planners and enforces it before safety checks', () => {
  const runtimeSource = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');
  const llmSource = readSource('apps/web/src/features/ai-takeover/core/llmBrain.ts');

  assert.match(runtimeSource, /resolveAgentPlannerCapabilityContext\(planningOwnerId\)/);
  assert.match(runtimeSource, /applyAgentPlannerCapabilityContext\(/);
  assert.match(runtimeSource, /enforceAgentPlannerCapabilityPolicy\(/);
  assert.match(llmSource, /Only use a generation modelId present in context\.capabilityGraph\.routes/);
  assert.doesNotMatch(llmSource, /context\.settings\.selectedModel \|\| "gemini-2\.5-flash"/);
});
