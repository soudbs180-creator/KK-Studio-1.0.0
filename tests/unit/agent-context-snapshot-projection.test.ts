import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AgentContextSnapshotInputDtoSchema,
  type AgentContextSnapshotDto,
  type AgentContextSnapshotInputDto,
  type AgentSessionDto,
} from '@kk/shared';

import {
  buildAgentContextSnapshotInput,
} from '../../apps/web/src/features/ai-takeover/core/agentContextSnapshot.ts';
import type { SanitizedProjectContext } from '../../apps/web/src/features/ai-takeover/types.ts';
import {
  appendAgentContextSnapshotProjection,
  hydrateAgentContextSnapshotProjection,
  type AgentContextSnapshotProjectionClient,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentContextSnapshotProjection.ts';
import {
  resolveAgentPlannerSessionContext,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentPlannerSessionContext.ts';
import {
  AgentSessionProjectionStore,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentSessionProjection.ts';
import { readSource } from '../support/workspacePaths.js';
import { APP_VERSION } from '../../apps/web/src/config/appInfo.ts';

const OWNER_ID = 'snapshot-owner-a';
const SESSION_ID = 'snapshot-session-1';
const CREATED_AT = '2026-07-22T01:00:00.000Z';
const SUMMARY_AT = '2026-07-22T01:10:00.000Z';
const CAPTURED_AT = '2026-07-22T01:11:00.000Z';
const SERVER_AT = '2026-07-22T01:11:01.000Z';

function createSession(overrides: Partial<AgentSessionDto> = {}): AgentSessionDto {
  return {
    sessionId: SESSION_ID,
    ownerId: OWNER_ID,
    collaborationMode: 'assist',
    messages: [{ id: 'message-1', role: 'user', content: 'continue', createdAt: SUMMARY_AT }],
    summary: { text: 'bounded summary', coveredMessageCount: 0, updatedAt: SUMMARY_AT },
    toolResults: [],
    knowledgeRefs: [],
    tokenBudget: { maxTokens: 32_000, usedTokens: 2_000, reservedTokens: 1_600 },
    confirmations: [],
    checkpoints: [],
    lastHeartbeatAt: SERVER_AT,
    createdAt: CREATED_AT,
    updatedAt: SERVER_AT,
    ...overrides,
  };
}

function createProjectContext(canvasId = 'canvas-authoritative'): SanitizedProjectContext {
  return {
    currentPage: 'canvas',
    aiTakeover: { enabled: true, mode: 'api', collaborationMode: 'assist' },
    agent: { enabled: true },
    canvas: {
      id: canvasId,
      name: 'Secret canvas title',
      selectedNodeIds: ['node-1'],
      promptNodes: [{
        id: 'prompt-1',
        prompt: 'RAW_PROMPT_MUST_NOT_PERSIST',
        status: 'idle',
        hasReferenceImages: false,
        childImageCount: 0,
      }],
      imageNodes: [{ id: 'image-1', name: 'private image', hasOriginalUrl: true }],
    },
    assets: { imageCollections: [], images: [], files: [], outputs: [] },
    settings: { apiKeyStatus: 'configured_masked', providerCount: 1 },
    billing: { balanceKnown: true, canEstimateCost: true },
    errors: [],
    promptBarInput: {
      prompt: 'RAW_INPUT_MUST_NOT_PERSIST',
      referenceImagesCount: 2,
      mode: 'image',
    },
    runtime: {
      projectVersion: APP_VERSION,
      currentPage: 'canvas',
      canvas: {
        id: canvasId,
        name: 'Secret canvas title',
        promptCount: 1,
        imageCount: 1,
        groupCount: 0,
        noteCount: 0,
        workflowPanelCount: 0,
        cardKinds: {},
        layoutModes: [],
      },
      viewport: { x: 20, y: 30, scale: 1.25, center: { x: 400, y: 300 }, rect: { width: 800, height: 600 } },
      selection: {
        selectedNodeIds: ['node-1'],
        promptNodeIds: ['node-1'],
        imageNodeIds: [],
        childImageNodeIdsFromSelectedPrompts: [],
        groupIds: [],
        noteNodeIds: [],
        workflowNodeIds: [],
        capabilities: {
          canArrange: true,
          canConvertDrawingsToNote: false,
          canCreateCard: true,
          canCreateWorkflowPanel: true,
        },
        count: 1,
      },
      groups: [],
      selectedNodes: { prompts: [], images: [], notes: [], workflowPanels: [] },
      promptBarInput: { prompt: 'RAW_INPUT_MUST_NOT_PERSIST', mode: 'image', referenceImagesCount: 2 },
      recentEvents: [{
        id: 'event-1',
        type: 'prompt_created',
        targetIds: ['prompt-1'],
        timestamp: Date.parse(CAPTURED_AT),
        summary: 'RAW_EVENT_SUMMARY_MUST_NOT_PERSIST',
      }],
    },
  };
}

function createSnapshotInput(): AgentContextSnapshotInputDto {
  const input = buildAgentContextSnapshotInput(createProjectContext(), {
    snapshotId: 'snapshot-authoritative-1',
    capturedAt: CAPTURED_AT,
    availableTools: ['canvas.getState', 'generation.createBatchJob'],
  });
  assert.ok(input);
  return input;
}

function createSnapshot(overrides: Partial<AgentContextSnapshotDto> = {}): AgentContextSnapshotDto {
  return {
    ...createSnapshotInput(),
    sessionId: SESSION_ID,
    sequence: 4,
    createdAt: SERVER_AT,
    ...overrides,
  };
}

function ok(data: unknown) {
  return Promise.resolve({ success: true, data: { ok: true, data } });
}

function createClient(snapshot: unknown): AgentContextSnapshotProjectionClient {
  return {
    getLatestAgentContextSnapshot: async () => ok(snapshot),
    appendAgentContextSnapshot: async () => ok(snapshot),
  };
}

test('captures only metadata from the current sanitized canvas state', () => {
  const input = createSnapshotInput();

  assert.equal(AgentContextSnapshotInputDtoSchema.safeParse(input).success, true);
  assert.deepEqual(input.canvasSummary, { nodeCount: 2, selectedNodeCount: 1, generatedAssetCount: 1 });
  assert.deepEqual(input.viewport, { x: 20, y: 30, width: 800, height: 600, zoom: 1.25 });
  assert.deepEqual(input.recentEvents.map((event) => event.type), ['node_created']);
  assert.deepEqual(input.inputBox, { hasText: true, attachmentCount: 2 });

  const serialized = JSON.stringify(input);
  for (const forbidden of [
    'RAW_PROMPT_MUST_NOT_PERSIST',
    'RAW_INPUT_MUST_NOT_PERSIST',
    'RAW_EVENT_SUMMARY_MUST_NOT_PERSIST',
    'Secret canvas title',
    'private image',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test('drops an invalid event timestamp instead of blocking the metadata capture', () => {
  const context = createProjectContext();
  context.runtime!.recentEvents[0].timestamp = Number.MAX_VALUE;

  const input = buildAgentContextSnapshotInput(context, {
    snapshotId: 'snapshot-invalid-event-time',
    capturedAt: CAPTURED_AT,
    availableTools: [],
  });

  assert.ok(input);
  assert.deepEqual(input.recentEvents, []);
});

test('hydrates and appends only exact owner-stable Snapshot responses', async () => {
  let ownerId = OWNER_ID;
  const store = new AgentSessionProjectionStore(() => ownerId);
  assert.equal(store.storeOwnerSession(ownerId, createSession()), true);
  const expectedSubjects: string[] = [];
  const snapshot = createSnapshot();
  const client: AgentContextSnapshotProjectionClient = {
    getLatestAgentContextSnapshot: async (_sessionId, options) => {
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      return ok(snapshot);
    },
    appendAgentContextSnapshot: async (_sessionId, _input, options) => {
      expectedSubjects.push(String(options?.expectedAuthSubject || ''));
      return ok(snapshot);
    },
  };

  const hydrated = await hydrateAgentContextSnapshotProjection(SESSION_ID, {
    ownerId, store, client, getOwnerId: () => ownerId,
  });
  const appended = await appendAgentContextSnapshotProjection(SESSION_ID, createSnapshotInput(), {
    ownerId, store, client, getOwnerId: () => ownerId,
  });

  assert.equal(hydrated.outcome, 'hydrated');
  assert.equal(appended.outcome, 'hydrated');
  assert.deepEqual(expectedSubjects, [OWNER_ID, OWNER_ID]);
  assert.equal(store.getContextSnapshot(SESSION_ID)?.snapshotId, 'snapshot-authoritative-1');

  ownerId = 'snapshot-owner-b';
  assert.equal(store.getContextSnapshot(SESSION_ID), undefined);
});

test('rejects substituted Session ids and malformed Snapshot payloads without changing the store', async () => {
  const store = new AgentSessionProjectionStore(() => OWNER_ID);
  assert.equal(store.storeOwnerSession(OWNER_ID, createSession()), true);

  const substituted = await hydrateAgentContextSnapshotProjection(SESSION_ID, {
    ownerId: OWNER_ID,
    store,
    client: createClient(createSnapshot({ sessionId: 'snapshot-session-substituted' })),
    getOwnerId: () => OWNER_ID,
  });
  const malformed = await hydrateAgentContextSnapshotProjection(SESSION_ID, {
    ownerId: OWNER_ID,
    store,
    client: createClient({ ...createSnapshot(), sequence: 0 }),
    getOwnerId: () => OWNER_ID,
  });

  assert.equal(substituted.outcome, 'invalid_payload');
  assert.equal(malformed.outcome, 'invalid_payload');
  assert.equal(store.getContextSnapshot(SESSION_ID), undefined);
});

test('keeps the authoritative Session projection when Snapshot transport is unavailable', async () => {
  const store = new AgentSessionProjectionStore(() => OWNER_ID);
  assert.equal(store.storeOwnerSession(OWNER_ID, createSession()), true);
  const unavailableClient: AgentContextSnapshotProjectionClient = {
    getLatestAgentContextSnapshot: async () => { throw new Error('offline'); },
    appendAgentContextSnapshot: async () => { throw new Error('offline'); },
  };

  const hydrated = await hydrateAgentContextSnapshotProjection(SESSION_ID, {
    ownerId: OWNER_ID, store, client: unavailableClient, getOwnerId: () => OWNER_ID,
  });
  const appended = await appendAgentContextSnapshotProjection(SESSION_ID, createSnapshotInput(), {
    ownerId: OWNER_ID, store, client: unavailableClient, getOwnerId: () => OWNER_ID,
  });

  assert.equal(hydrated.outcome, 'unavailable');
  assert.equal(appended.outcome, 'unavailable');
  assert.equal(store.getSession(SESSION_ID)?.sessionId, SESSION_ID);
});

test('adds only fresh canvas-compatible Snapshot metadata to the bounded Planner context', () => {
  const store = new AgentSessionProjectionStore(() => OWNER_ID);
  assert.equal(store.storeOwnerSession(OWNER_ID, createSession()), true);
  assert.equal(store.storeOwnerContextSnapshot(OWNER_ID, createSnapshot()), true);

  const accepted = resolveAgentPlannerSessionContext(
    SESSION_ID,
    store,
    createProjectContext(),
    () => Date.parse(SERVER_AT),
  );
  const canvasMismatch = resolveAgentPlannerSessionContext(
    SESSION_ID,
    store,
    createProjectContext('canvas-other'),
    () => Date.parse(SERVER_AT),
  );

  assert.equal(accepted?.canvasSnapshot?.sequence, 4);
  assert.deepEqual(accepted?.canvasSnapshot?.canvasSummary, {
    nodeCount: 2, selectedNodeCount: 1, generatedAssetCount: 1,
  });
  assert.equal(canvasMismatch?.canvasSnapshot, undefined);
});

test('excludes a Snapshot older than the rolling summary or too far in the future', () => {
  const store = new AgentSessionProjectionStore(() => OWNER_ID);
  assert.equal(store.storeOwnerSession(OWNER_ID, createSession()), true);
  assert.equal(store.storeOwnerContextSnapshot(OWNER_ID, createSnapshot({
    capturedAt: '2026-07-22T01:09:00.000Z',
  })), true);
  assert.equal(resolveAgentPlannerSessionContext(
    SESSION_ID, store, createProjectContext(), () => Date.parse(SERVER_AT),
  )?.canvasSnapshot, undefined);

  assert.equal(store.storeOwnerContextSnapshot(OWNER_ID, createSnapshot({
    snapshotId: 'snapshot-future',
    sequence: 5,
    capturedAt: '2026-07-22T02:00:00.000Z',
  })), true);
  assert.equal(resolveAgentPlannerSessionContext(
    SESSION_ID, store, createProjectContext(), () => Date.parse(SERVER_AT),
  )?.canvasSnapshot, undefined);
});

test('AgentRuntime hydrates prior Snapshot metadata and asynchronously records the current safe capture', () => {
  const source = readSource('apps/web/src/features/ai-assistant-runtime/runtime/AgentRuntime.ts');

  assert.match(source, /hydrateAgentContextSnapshotProjection/);
  assert.match(source, /buildAgentContextSnapshotInput/);
  assert.match(source, /appendAgentContextSnapshotProjection/);
  assert.match(source, /resolveAgentPlannerSessionContext\(sessionId, agentSessionProjectionStore, context\)/);
  assert.doesNotMatch(source, /appendAgentContextSnapshotProjection\([^)]*text/);
});
