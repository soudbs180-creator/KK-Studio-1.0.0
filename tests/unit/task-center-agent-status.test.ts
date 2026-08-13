import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRunStatusSchema } from '../../packages/shared/src/index.ts';
import {
  mapAgentRunStatusToTaskCenterStatus,
  TASK_CENTER_AGENT_STATUS_BY_RUN_STATUS,
} from '../../apps/web/src/components/workspace/taskCenterAgentStatus.ts';

test('Task Center exhaustively projects every Agent Run status into its legacy display states', () => {
  const expected = {
    planning: 'queued',
    waiting_confirmation: 'waiting_confirmation',
    waiting_for_device: 'queued',
    waiting_execution: 'queued',
    running: 'running',
    verifying: 'running',
    verification_required: 'waiting_confirmation',
    manual_reconcile: 'failed',
    completed: 'completed',
    completed_with_errors: 'completed_with_errors',
    failed: 'failed',
    cancelled: 'cancelled',
  } as const;

  assert.deepEqual(TASK_CENTER_AGENT_STATUS_BY_RUN_STATUS, expected);
  assert.deepEqual(
    AgentRunStatusSchema.options.map((status) => [
      status,
      mapAgentRunStatusToTaskCenterStatus(status),
    ]),
    Object.entries(expected),
  );
});
