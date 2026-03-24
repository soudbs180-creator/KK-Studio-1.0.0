import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GenerationTaskStatus,
  type CreateGenerationTaskRequestDto,
} from "../../packages/contracts/src/index.ts";
import {
  canTransitionGenerationTask,
  createGenerationTask,
  normalizeLegacyGenerationStatus,
  transitionGenerationTask,
} from "../../apps/api/src/modules/generation/domain/generation-task.ts";

const sampleRequest: CreateGenerationTaskRequestDto = {
  workspaceId: "workspace-1",
  workflowId: "workflow-1",
  modelCode: "gemini-2.5-flash-image",
  taskType: "image",
  prompt: "Draw a city skyline at dusk",
  idempotencyKey: "idem-1",
};

describe("generation task domain", () => {
  test("creates queued tasks from request dto", () => {
    const task = createGenerationTask(sampleRequest, {
      requesterId: "user-1",
      now: "2026-03-23T12:00:00.000Z",
    });

    assert.equal(task.status, GenerationTaskStatus.Queued);
    assert.equal(task.requesterId, "user-1");
    assert.equal(task.prompt, sampleRequest.prompt);
  });

  test("allows queued to running to succeeded transitions", () => {
    const task = createGenerationTask(sampleRequest, {
      requesterId: "user-1",
      now: "2026-03-23T12:00:00.000Z",
    });

    assert.equal(canTransitionGenerationTask(task.status, GenerationTaskStatus.Running), true);
    const runningTask = transitionGenerationTask(task, GenerationTaskStatus.Running, {}, "2026-03-23T12:01:00.000Z");
    const doneTask = transitionGenerationTask(runningTask, GenerationTaskStatus.Succeeded, {}, "2026-03-23T12:02:00.000Z");

    assert.equal(doneTask.status, GenerationTaskStatus.Succeeded);
    assert.equal(doneTask.startedAt, "2026-03-23T12:01:00.000Z");
    assert.equal(doneTask.completedAt, "2026-03-23T12:02:00.000Z");
  });

  test("rejects invalid state transitions", () => {
    const task = createGenerationTask(sampleRequest, {
      requesterId: "user-1",
    });

    assert.throws(() => {
      transitionGenerationTask(task, GenerationTaskStatus.Succeeded);
    }, /Invalid generation task transition/);
  });

  test("normalizes legacy persisted statuses", () => {
    assert.equal(normalizeLegacyGenerationStatus("pending"), GenerationTaskStatus.Queued);
    assert.equal(normalizeLegacyGenerationStatus("processing"), GenerationTaskStatus.Running);
    assert.equal(normalizeLegacyGenerationStatus("completed"), GenerationTaskStatus.Succeeded);
    assert.equal(normalizeLegacyGenerationStatus("failed"), GenerationTaskStatus.Failed);
  });
});
