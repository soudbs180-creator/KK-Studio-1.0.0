import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { CreateGenerationTaskRequestDto } from "../../packages/contracts/src/index.ts";
import {
  GenerationService,
  InMemoryGenerationTaskRepository,
} from "../../apps/api/src/modules/generation/index.ts";

const request: CreateGenerationTaskRequestDto = {
  workspaceId: "workspace-1",
  workflowId: "workflow-1",
  modelCode: "gemini-2.5-flash-image",
  taskType: "image",
  prompt: "Generate a poster",
  idempotencyKey: "idem-shared",
  attemptId: "attempt-shared-1",
};

describe("generation service", () => {
  test("persists request trace metadata on the created generation task", async () => {
    const service = new GenerationService(new InMemoryGenerationTaskRepository());

    const created = await service.createTask(request, "owner-user", "req-trace-1");
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error("Expected successful task creation.");
    }

    assert.equal(created.data.requesterId, "owner-user");
    assert.equal(created.data.requestId, "req-trace-1");
    assert.equal(created.data.attemptId, "attempt-shared-1");
  });

  test("scopes idempotency keys by requester", async () => {
    const service = new GenerationService(new InMemoryGenerationTaskRepository());

    const first = await service.createTask(request, "user-a", "req-1");
    const second = await service.createTask(request, "user-b", "req-2");

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    if (!first.success || !second.success) {
      throw new Error("Expected successful task creation for both requesters.");
    }

    assert.notEqual(first.data.id, second.data.id);
    assert.equal(first.data.requesterId, "user-a");
    assert.equal(second.data.requesterId, "user-b");
  });

  test("does not expose a task to another requester", async () => {
    const service = new GenerationService(new InMemoryGenerationTaskRepository());
    const created = await service.createTask(request, "owner-user", "req-create");
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error("Expected successful task creation.");
    }

    const otherRequesterResult = await service.getTask(created.data.id, "other-user", "req-get");
    assert.equal(otherRequesterResult.success, false);
    if (!otherRequesterResult.success) {
      assert.equal(otherRequesterResult.error.code, "GENERATION_TASK_NOT_FOUND");
    }
  });

  test("reuses the original request trace on idempotent replays for the same requester", async () => {
    const service = new GenerationService(new InMemoryGenerationTaskRepository());

    const first = await service.createTask(request, "owner-user", "req-trace-original");
    const second = await service.createTask(request, "owner-user", "req-trace-replay");

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    if (!first.success || !second.success) {
      throw new Error("Expected successful task creation.");
    }

    assert.equal(second.data.id, first.data.id);
    assert.equal(second.data.requesterId, "owner-user");
    assert.equal(second.data.requestId, "req-trace-original");
    assert.equal(second.data.attemptId, "attempt-shared-1");
  });
});
