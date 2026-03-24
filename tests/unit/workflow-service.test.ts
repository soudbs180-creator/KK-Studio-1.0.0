import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { SaveWorkflowRequestDto } from "../../packages/contracts/src/index.ts";
import {
  InMemoryWorkflowRepository,
  WorkflowService,
} from "../../apps/api/src/modules/workflow/index.ts";

const saveRequestA: SaveWorkflowRequestDto = {
  name: "Workspace A",
  version: 1,
  nodes: [
    {
      id: "node-a",
      nodeType: "prompt",
      position: { x: 0, y: 0 },
      config: { prompt: "hello" },
    },
  ],
  edges: [],
};

const saveRequestB: SaveWorkflowRequestDto = {
  name: "Workspace B",
  version: 2,
  nodes: [
    {
      id: "node-b",
      nodeType: "image",
      position: { x: 20, y: 20 },
      config: { style: "photo" },
    },
  ],
  edges: [],
};

describe("workflow service", () => {
  test("isolates workflows by workspace", async () => {
    const service = new WorkflowService(new InMemoryWorkflowRepository());

    const savedA = await service.saveWorkflow("shared-workflow", "workspace-a", saveRequestA, "req-a");
    const savedB = await service.saveWorkflow("shared-workflow", "workspace-b", saveRequestB, "req-b");

    assert.equal(savedA.success, true);
    assert.equal(savedB.success, true);
    if (!savedA.success || !savedB.success) {
      throw new Error("Expected successful workflow saves.");
    }

    const loadedA = await service.getWorkflow("workspace-a", "shared-workflow", "req-get-a");
    const loadedB = await service.getWorkflow("workspace-b", "shared-workflow", "req-get-b");

    assert.equal(loadedA.success, true);
    assert.equal(loadedB.success, true);
    if (!loadedA.success || !loadedB.success) {
      throw new Error("Expected successful workflow reads.");
    }

    assert.equal(loadedA.data.workspaceId, "workspace-a");
    assert.equal(loadedA.data.name, "Workspace A");
    assert.equal(loadedB.data.workspaceId, "workspace-b");
    assert.equal(loadedB.data.name, "Workspace B");
  });

  test("keeps createdAt stable and advances updatedAt on overwrite", async () => {
    const service = new WorkflowService(new InMemoryWorkflowRepository());

    const first = await service.saveWorkflow("workflow-updated", "workspace-a", saveRequestA, "req-1");
    assert.equal(first.success, true);
    if (!first.success) {
      throw new Error("Expected the first save to succeed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await service.saveWorkflow("workflow-updated", "workspace-a", saveRequestB, "req-2");
    assert.equal(second.success, true);
    if (!second.success) {
      throw new Error("Expected the second save to succeed.");
    }

    assert.equal(second.data.createdAt, first.data.createdAt);
    assert.notEqual(second.data.updatedAt, first.data.updatedAt);
  });
});
