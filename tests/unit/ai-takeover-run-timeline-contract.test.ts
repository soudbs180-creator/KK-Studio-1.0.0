import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { readSource, workspacePath } from '../support/workspacePaths.js';

const timelineRelativePath = 'apps/web/src/features/ai-assistant-runtime/runtime/agentRunTimeline.ts';

async function loadTimelineModule() {
  assert.equal(
    existsSync(workspacePath(timelineRelativePath)),
    true,
    'agentRunTimeline.ts must exist and convert AgentRunRecord into user-visible execution steps'
  );

  return await import('../../apps/web/src/features/ai-assistant-runtime/runtime/agentRunTimeline.ts');
}

function makeRecord(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'run_contract_1',
    userMessage: 'organize this canvas',
    intent: 'organize_canvas',
    plan: {
      intent: 'organize_canvas',
      reply: 'Planning complete',
      actions: [{ type: 'canvas.arrangeSelection', payload: { mode: 'grid' } }],
      requiresConfirmation: false,
    },
    status: 'running',
    toolCalls: [],
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:01.000Z',
    ...overrides,
  };
}

test('buildAgentRunTimeline maps AgentRunRecord status into the canonical takeover steps', async () => {
  const { buildAgentRunTimeline } = await loadTimelineModule();

  const emptySteps = buildAgentRunTimeline(null);
  assert.deepEqual(emptySteps.map(step => step.label), [
    'IntentGate',
    'Planner',
    'PermissionPolicy',
    'Executor',
    'Verification / Memory',
  ]);
  assert.deepEqual(emptySteps.map(step => step.status), [
    'pending',
    'pending',
    'pending',
    'pending',
    'pending',
  ]);

  const waitingSteps = buildAgentRunTimeline(makeRecord({
    status: 'waiting_confirmation',
    plan: {
      intent: 'batch_generate_from_folder',
      actions: [{ type: 'generation.createBatchJob', payload: { count: 8 } }],
      requiresConfirmation: true,
    },
  }));
  assert.equal(waitingSteps.find(step => step.id === 'permission')?.status, 'needs_confirmation');
  assert.equal(waitingSteps.find(step => step.id === 'executor')?.status, 'pending');

  const runningSteps = buildAgentRunTimeline(makeRecord({
    status: 'running',
    toolCalls: [{ toolName: 'canvas.arrangeSelection', status: 'success' }],
  }));
  assert.equal(runningSteps.find(step => step.id === 'executor')?.status, 'active');

  const completedSteps = buildAgentRunTimeline(makeRecord({
    status: 'completed',
    toolCalls: [{ toolName: 'canvas.arrangeSelection', status: 'success' }],
  }));
  assert.equal(completedSteps.find(step => step.id === 'executor')?.status, 'done');
  assert.equal(completedSteps.find(step => step.id === 'verification')?.status, 'done');

  const failedSteps = buildAgentRunTimeline(makeRecord({
    status: 'failed',
    nextStep: 'Execution failed: tool unavailable',
  }));
  assert.equal(failedSteps.find(step => step.id === 'executor')?.status, 'failed');
  assert.equal(failedSteps.find(step => step.id === 'verification')?.status, 'failed');
});

test('AI takeover context exposes currentRun and derived timeline from AgentRunStore', () => {
  const contextSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');

  assert.match(contextSource, /currentRun:\s*AgentRunRecord \| null/);
  assert.match(contextSource, /agentRunTimeline:\s*AgentRunTimelineStep\[\]/);
  assert.match(contextSource, /buildAgentRunTimeline\(currentRun\)/);
  assert.match(contextSource, /agentRunStore\.getRun\(runId\)/);
  assert.match(contextSource, /cancelPendingRun\(runId\)/);
});

test('AI takeover dock renders the canonical run timeline without adding a parallel assistant entry', () => {
  const dockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');

  assert.match(dockSource, /agentRunTimeline/);
  assert.match(dockSource, /ai-takeover-run-timeline/);
  assert.match(dockSource, /data-status=\{step\.status\}/);
  assert.match(dockSource, /Verification \/ Memory/);
  assert.doesNotMatch(dockSource, /new AgentRuntime\(/);
});

test('ai-assistant-runtime barrel exports the timeline helper as part of the existing runtime surface', () => {
  const indexSource = readSource('apps/web/src/features/ai-assistant-runtime/index.ts');

  assert.match(indexSource, /buildAgentRunTimeline/);
  assert.match(indexSource, /AgentRunTimelineStep/);
});
