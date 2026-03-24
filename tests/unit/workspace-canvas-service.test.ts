import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { WorkspaceCanvasService } from "../../apps/api/src/modules/workspace-canvas/application/workspace-canvas-service.ts";
import { InMemoryWorkspaceLayoutRepository } from "../../apps/api/src/modules/workspace-canvas/infrastructure/in-memory-workspace-layout-repository.ts";
import { InMemoryWorkflowRepository } from "../../apps/api/src/modules/workflow/infrastructure/in-memory-workflow-repository.ts";
import { createWorkflowDocument } from "../../apps/api/src/modules/workflow/domain/workflow-document.ts";

describe("workspace canvas service", () => {
  test("summarizes workflow nodes and edges for a workspace", async () => {
    const repository = new InMemoryWorkflowRepository();
    const service = new WorkspaceCanvasService(repository, new InMemoryWorkspaceLayoutRepository());

    const workflow = createWorkflowDocument({
      name: "Workspace Canvas",
      version: 1,
      nodes: [
        {
          id: "node-1",
          nodeType: "prompt",
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: "node-2",
          nodeType: "image",
          position: { x: 120, y: 40 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge-1",
          from: "node-1",
          to: "node-2",
        },
      ],
    }, {
      workflowId: "workflow-canvas-1",
      workspaceId: "workspace-canvas-1",
      canvasId: "canvas-1",
    });

    await repository.save(workflow);

    const result = await service.getCanvasSummary("workspace-canvas-1", "req-canvas-1");

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.canvasId, "canvas-1");
      assert.equal(result.data.nodeCount, 2);
      assert.equal(result.data.connectionCount, 1);
    }
  });

  test("saves, reads, and cleans up user canvas layout snapshots", async () => {
    const service = new WorkspaceCanvasService(
      new InMemoryWorkflowRepository(),
      new InMemoryWorkspaceLayoutRepository(),
    );

    const saveResult = await service.saveCanvasLayout("user-layout-1", {
      canvases: [
        {
          id: "canvas-1",
          name: "Workspace 1",
          lastModified: 1700000000000,
        },
      ],
    }, "req-layout-save-1");

    assert.equal(saveResult.success, true);
    if (!saveResult.success) {
      return;
    }
    assert.equal(saveResult.data.canvases.length, 1);

    const getResult = await service.getCanvasLayout("user-layout-1", "req-layout-get-1");
    assert.equal(getResult.success, true);
    if (!getResult.success) {
      return;
    }
    assert.equal(getResult.data.canvases.length, 1);
    assert.equal(getResult.data.canvases[0].id, "canvas-1");

    const cleanupResult = await service.cleanupCloudImages("user-layout-1", "req-layout-cleanup-1");
    assert.equal(cleanupResult.success, true);
    if (cleanupResult.success) {
      assert.equal(cleanupResult.data.deletedCount, 0);
      assert.equal(cleanupResult.data.preservedLayout, true);
    }
  });
});
