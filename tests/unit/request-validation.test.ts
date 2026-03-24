import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validateCreateGenerationTaskRequest } from "../../apps/api/src/modules/generation/presentation/http-generation-routes.ts";
import { validateSaveWorkflowRequest } from "../../apps/api/src/modules/workflow/presentation/http-workflow-routes.ts";

describe("request validators", () => {
  test("rejects incomplete generation task payloads", () => {
    const errors = validateCreateGenerationTaskRequest({
      prompt: "missing most fields",
    });

    assert.ok(errors.length >= 4);
    assert.ok(errors.some((item) => item.field === "workspaceId"));
    assert.ok(errors.some((item) => item.field === "workflowId"));
    assert.ok(errors.some((item) => item.field === "modelCode"));
    assert.ok(errors.some((item) => item.field === "idempotencyKey"));
  });

  test("rejects malformed workflow nodes", () => {
    const errors = validateSaveWorkflowRequest({
      name: "Broken Workflow",
      version: 1,
      nodes: [
        {
          id: "node-1",
          nodeType: "unknown",
          position: { x: "zero", y: 0 },
          config: [],
        },
      ],
    });

    assert.ok(errors.some((item) => item.field === "nodes[0].nodeType"));
    assert.ok(errors.some((item) => item.field === "nodes[0].position"));
    assert.ok(errors.some((item) => item.field === "nodes[0].config"));
  });
});
