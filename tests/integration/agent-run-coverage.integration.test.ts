import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeTaskCenterActivity } from '../../apps/web/src/components/workspace/taskCenterSummary.ts';
import { summarizeAgentRunCoverage } from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentRunProgress.ts';

test('Task Center and Agent Runtime expose the same deterministic run progress', () => {
  const run = {
    status: 'running',
    totalSteps: 4,
    completedStepIds: ['step-1', 'step-2'],
    stepResults: [{
      stepId: 'step-3',
      toolName: 'canvas.arrangeNodes',
      outcome: 'retryable_failure' as const,
      verificationRule: 'canvas_state' as const,
      retryable: true,
      verifiedAt: '2026-08-02T00:00:00.000Z',
    }],
  };

  const runtimeSummary = summarizeAgentRunCoverage(run);
  const taskCenterSummary = summarizeTaskCenterActivity([], [run]);

  assert.equal(runtimeSummary.progressPercent, 75);
  assert.equal(taskCenterSummary.averageProgress, runtimeSummary.progressPercent);
  assert.equal(taskCenterSummary.hasAttentionRequired, false);
});
