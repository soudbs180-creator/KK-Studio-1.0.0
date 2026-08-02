import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentStepOutcome } from '@kk/shared';
import type { AgentPlanStep } from '../../apps/web/src/features/ai-takeover/types.ts';
import {
  summarizeAgentRunCoverage,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentRunProgress.ts';
import {
  selectReadyAgentExecutionGroup,
} from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentPlanCompiler.ts';

const timestamp = '2026-08-02T00:00:00.000Z';

const makeStep = (
  stepId: string,
  actionType: string,
  dependsOn: string[] = [],
): AgentPlanStep => ({
  stepId,
  action: { type: actionType, payload: {} } as AgentPlanStep['action'],
  dependsOn,
  idempotencyKey: `${stepId}:idempotency`,
  verification: { required: true, rule: 'tool' },
});

const makeResult = (
  stepId: string,
  outcome: AgentStepOutcome,
  retryable = outcome === 'retryable_failure',
) => ({
  stepId,
  toolName: 'test.tool',
  outcome,
  verificationRule: 'tool' as const,
  retryable,
  verifiedAt: timestamp,
});

test('coverage summary separates processed, pending, blocked, and retryable steps', () => {
  const steps = [
    makeStep('read-state', 'canvas.getState'),
    makeStep('mutate-canvas', 'canvas.arrangeNodes', ['read-state']),
    makeStep('write-knowledge', 'knowledge.recordChange', ['mutate-canvas']),
  ];
  const summary = summarizeAgentRunCoverage({
    status: 'running',
    totalSteps: steps.length,
    completedStepIds: ['read-state'],
    stepResults: [makeResult('read-state', 'success'), makeResult('mutate-canvas', 'retryable_failure')],
  }, steps);

  assert.equal(summary.totalSteps, 3);
  assert.equal(summary.processedSteps, 2);
  assert.equal(summary.completedSteps, 1);
  assert.equal(summary.failedSteps, 1);
  assert.equal(summary.retryableFailureSteps, 1);
  assert.equal(summary.pendingSteps, 0);
  assert.equal(summary.blockedSteps, 1);
  assert.equal(summary.progressPercent, 67);
  assert.equal(summary.canRetry, true);
  assert.deepEqual(summary.readyStepIds, []);
  assert.deepEqual(summary.blockedStepIds, ['write-knowledge']);
  assert.equal(summary.latestFailure?.stepId, 'mutate-canvas');
});

test('coverage summary treats completed-with-errors as fully processed partial coverage', () => {
  const steps = [makeStep('first', 'canvas.getState'), makeStep('second', 'canvas.arrangeNodes')];
  const summary = summarizeAgentRunCoverage({
    status: 'completed_with_errors',
    totalSteps: 2,
    completedStepIds: ['first', 'second'],
    stepResults: [
      makeResult('first', 'success'),
      makeResult('second', 'partial_success'),
    ],
  }, steps);

  assert.equal(summary.state, 'partial');
  assert.equal(summary.processedSteps, 2);
  assert.equal(summary.partialSuccessSteps, 1);
  assert.equal(summary.progressPercent, 100);
  assert.equal(summary.pendingSteps, 0);
});

test('coverage summary propagates blocked dependencies through the full graph', () => {
  const steps = [
    makeStep('publish', 'knowledge.recordChange', ['write']),
    makeStep('write', 'canvas.arrangeNodes', ['mutate']),
    makeStep('mutate', 'canvas.arrangeNodes'),
  ];
  const summary = summarizeAgentRunCoverage({
    status: 'running',
    totalSteps: steps.length,
    stepResults: [makeResult('mutate', 'retryable_failure')],
  }, steps);

  assert.deepEqual(summary.blockedStepIds, ['publish', 'write']);
  assert.equal(summary.pendingSteps, 0);
  assert.equal(summary.progressPercent, 33);
});

test('remote projections remain safe when the plan graph is unavailable', () => {
  const summary = summarizeAgentRunCoverage({
    status: 'failed',
    totalSteps: 4,
    completedStepIds: ['step-1', 'step-2'],
    stepResults: [makeResult('step-3', 'rolled_back_failure')],
  });

  assert.equal(summary.totalSteps, 4);
  assert.equal(summary.processedSteps, 3);
  assert.equal(summary.pendingSteps, 1);
  assert.equal(summary.blockedSteps, 0);
  assert.equal(summary.progressPercent, 75);
  assert.equal(summary.state, 'failed');
});

test('execution grouping runs ready read-only steps together and mutations serially', () => {
  const steps = [
    makeStep('read-one', 'knowledge.searchProject'),
    makeStep('read-two', 'generation.getJobStatus'),
    makeStep('write-one', 'canvas.arrangeNodes'),
  ];

  const readGroup = selectReadyAgentExecutionGroup(steps, new Set(), 2);
  assert.equal(readGroup?.kind, 'read_only_parallel');
  assert.deepEqual(readGroup?.steps.map((step) => step.stepId), ['read-one', 'read-two']);

  const mutationGroup = selectReadyAgentExecutionGroup(steps, new Set(['read-one', 'read-two']));
  assert.equal(mutationGroup?.kind, 'mutation_serial');
  assert.deepEqual(mutationGroup?.steps.map((step) => step.stepId), ['write-one']);

  const blocked = selectReadyAgentExecutionGroup(
    [makeStep('dependent', 'canvas.arrangeNodes', ['missing'])],
    new Set(),
  );
  assert.equal(blocked, undefined);
});
