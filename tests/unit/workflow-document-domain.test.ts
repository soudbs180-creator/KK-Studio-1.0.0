import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { WorkflowNodeType, type WorkflowDocumentDto } from "../../packages/contracts/src/index.ts";
import { normalizeWorkflowDocument } from "../../apps/api/src/modules/workflow/domain/workflow-document.ts";

describe("workflow document domain", () => {
  test("dedupes duplicate nodes by id", () => {
    const document: WorkflowDocumentDto = {
      id: "workflow-1",
      workspaceId: "workspace-1",
      canvasId: "canvas-1",
      name: "Demo",
      status: "draft",
      version: 1,
      createdAt: "2026-03-23T12:00:00.000Z",
      updatedAt: "2026-03-23T12:00:00.000Z",
      nodes: [
        {
          id: "node-1",
          nodeType: WorkflowNodeType.Prompt,
          position: { x: 0, y: 0 },
          config: { prompt: "hello" },
        },
        {
          id: "node-1",
          nodeType: WorkflowNodeType.Prompt,
          position: { x: 10, y: 10 },
          config: { prompt: "updated" },
        },
      ],
      edges: [],
    };

    const normalized = normalizeWorkflowDocument(document);
    assert.equal(normalized.nodes.length, 1);
    assert.deepEqual(normalized.nodes[0].position, { x: 10, y: 10 });
  });

  test("filters invalid edges and dedupes valid ones", () => {
    const document: WorkflowDocumentDto = {
      id: "workflow-1",
      workspaceId: "workspace-1",
      canvasId: "canvas-1",
      name: "Demo",
      status: "draft",
      version: 1,
      createdAt: "2026-03-23T12:00:00.000Z",
      updatedAt: "2026-03-23T12:00:00.000Z",
      nodes: [
        {
          id: "node-1",
          nodeType: WorkflowNodeType.Prompt,
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: "node-2",
          nodeType: WorkflowNodeType.Image,
          position: { x: 20, y: 20 },
          config: {},
        },
      ],
      edges: [
        { id: "edge-1", from: "node-1", to: "node-2", role: "result", state: "active" },
        { id: "edge-1", from: "node-1", to: "node-2", role: "result", state: "active" },
        { id: "edge-2", from: "node-1", to: "missing-node", role: "result", state: "active" },
      ],
    };

    const normalized = normalizeWorkflowDocument(document);
    assert.equal(normalized.edges.length, 1);
    assert.equal(normalized.edges[0].id, "edge-1");
  });
});
