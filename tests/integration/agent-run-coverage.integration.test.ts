import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeTaskCenterActivity } from '../../apps/web/src/components/workspace/taskCenterSummary.ts';
import { summarizeAgentRunCoverage } from '../../apps/web/src/features/ai-assistant-runtime/runtime/agentRunProgress.ts';
import { projectAgentRunTask } from '../../apps/web/src/features/tasks/publicTaskProjection.ts';
import type { AgentRunRecord } from '../../apps/web/src/features/ai-assistant-runtime/runtime/AgentRunStore.ts';

test('Task Center and Agent Runtime expose the same deterministic run progress', () => {
  const coverageInput = {
    status: 'running' as const,
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
  const run: AgentRunRecord = {
    id: 'run-coverage',
    userMessage: 'private input',
    intent: 'create',
    plan: {},
    toolCalls: [],
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    ...coverageInput,
  };

  const runtimeSummary = summarizeAgentRunCoverage(run);
  const taskCenterSummary = summarizeTaskCenterActivity([projectAgentRunTask(run)]);

  assert.equal(runtimeSummary.progressPercent, 75);
  assert.equal(taskCenterSummary.averageProgress, runtimeSummary.progressPercent);
  assert.equal(taskCenterSummary.hasAttentionRequired, false);
});
