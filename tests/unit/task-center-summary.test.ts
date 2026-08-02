import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarizeTaskCenterActivity } from '../../apps/web/src/components/workspace/taskCenterSummary.ts';

test('task center summary counts active queue and agent work without duplicating either store', () => {
  const summary = summarizeTaskCenterActivity(
    [
      { status: 'running', progress: { percent: 40 }, prompts: [] },
      { status: 'completed', progress: { percent: 100 }, prompts: [] },
      { status: 'queued', progress: { percent: 0 }, prompts: [] },
    ],
    [
      { status: 'waiting_confirmation', totalSteps: 4, completedStepIds: ['step-1'] },
      { status: 'completed', totalSteps: 2, completedStepIds: ['step-1', 'step-2'] },
    ],
  );

  assert.deepEqual(summary, {
    activeCount: 3,
    averageProgress: 22,
    hasAttentionRequired: true,
  });
});

test('task center summary is idle when both authoritative stores are idle', () => {
  assert.deepEqual(summarizeTaskCenterActivity([], []), {
    activeCount: 0,
    averageProgress: 0,
    hasAttentionRequired: false,
  });
});
