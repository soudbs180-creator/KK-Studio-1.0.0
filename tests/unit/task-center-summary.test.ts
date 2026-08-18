import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicTaskProjectionDto } from '../../packages/shared/src/index.ts';

import { summarizeTaskCenterActivity } from '../../apps/web/src/components/workspace/taskCenterSummary.ts';

const NOW = '2026-08-13T00:00:00.000Z';

const createTask = (
  id: string,
  phase: PublicTaskProjectionDto['phase'],
  progress?: { completed: number; total: number },
): PublicTaskProjectionDto => ({
  schemaVersion: 1,
  projectionId: `local:${id}`,
  source: 'local_task',
  localTaskId: id,
  phase,
  terminalOutcome: phase === 'terminal' ? 'completed' : undefined,
  title: '本地任务',
  allowedActions: [],
  progress,
  createdAt: NOW,
  updatedAt: NOW,
});

test('task center summary counts active queue and agent work without duplicating either store', () => {
  const summary = summarizeTaskCenterActivity([
    createTask('running', 'running', { completed: 2, total: 5 }),
    createTask('completed', 'terminal', { completed: 1, total: 1 }),
    createTask('queued', 'queued', { completed: 0, total: 1 }),
    createTask('confirmation', 'waiting_confirmation', { completed: 1, total: 4 }),
  ]);

  assert.deepEqual(summary, {
    activeCount: 3,
    averageProgress: 22,
    hasAttentionRequired: true,
  });
});

test('task center summary is idle when both authoritative stores are idle', () => {
  assert.deepEqual(summarizeTaskCenterActivity([]), {
    activeCount: 0,
    averageProgress: 0,
    hasAttentionRequired: false,
  });
});
