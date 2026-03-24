import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AUTHENTICATED_USER_ID_HEADER,
} from "../../packages/shared/src/index.ts";
import { WorkspaceCanvasService } from "../../apps/api/src/modules/workspace-canvas/application/workspace-canvas-service.ts";
import { InMemoryWorkspaceLayoutRepository } from "../../apps/api/src/modules/workspace-canvas/infrastructure/in-memory-workspace-layout-repository.ts";
import {
  handleCleanupCloudImages,
  handleGetWorkspaceLayout,
  handleSaveWorkspaceLayout,
} from "../../apps/api/src/modules/workspace-canvas/presentation/http-workspace-canvas-routes.ts";
import { InMemoryWorkflowRepository } from "../../apps/api/src/modules/workflow/infrastructure/in-memory-workflow-repository.ts";

describe("workspace canvas routes", () => {
  test("requires authentication for workspace layout sync", async () => {
    const service = new WorkspaceCanvasService(
      new InMemoryWorkflowRepository(),
      new InMemoryWorkspaceLayoutRepository(),
    );

    const getResult = await handleGetWorkspaceLayout(service, {
      "x-request-id": "req-layout-get-unauthorized",
    });
    assert.equal(getResult.statusCode, 401);

    const saveResult = await handleSaveWorkspaceLayout(service, {
      canvases: [],
    }, {
      "x-request-id": "req-layout-save-unauthorized",
    });
    assert.equal(saveResult.statusCode, 401);

    const cleanupResult = await handleCleanupCloudImages(service, {
      "x-request-id": "req-layout-cleanup-unauthorized",
    });
    assert.equal(cleanupResult.statusCode, 401);
  });

  test("reads and writes layout snapshots through the authenticated routes", async () => {
    const service = new WorkspaceCanvasService(
      new InMemoryWorkflowRepository(),
      new InMemoryWorkspaceLayoutRepository(),
    );
    const headers = {
      "x-request-id": "req-layout-get",
      [AUTHENTICATED_USER_ID_HEADER]: "workspace-user-1",
    };

    const initial = await handleGetWorkspaceLayout(service, headers);
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.body.success, true);
    if (initial.body.success) {
      assert.deepEqual(initial.body.data.canvases, []);
    }

    const save = await handleSaveWorkspaceLayout(service, {
      canvases: [
        {
          id: "canvas-1",
          name: "My Canvas",
          lastModified: 1700000000000,
        },
      ],
    }, {
      ...headers,
      "x-request-id": "req-layout-save",
    });

    assert.equal(save.statusCode, 200);
    assert.equal(save.body.success, true);
    if (!save.body.success) {
      return;
    }
    assert.equal(save.body.data.canvases.length, 1);

    const cleanup = await handleCleanupCloudImages(service, {
      ...headers,
      "x-request-id": "req-layout-cleanup",
    });
    assert.equal(cleanup.statusCode, 200);
    assert.equal(cleanup.body.success, true);
    if (cleanup.body.success) {
      assert.equal(cleanup.body.data.preservedLayout, true);
    }
  });
});
