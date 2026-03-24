import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
  AUTHENTICATED_USER_ROLE_HEADER,
} from "../../packages/shared/src/index.ts";
import { ModelCatalogService } from "../../apps/api/src/modules/model-catalog/application/model-catalog-service.ts";
import { InMemoryModelCatalogRepository } from "../../apps/api/src/modules/model-catalog/infrastructure/in-memory-model-catalog-repository.ts";
import {
  handleCreateAdminModel,
  handleListModels,
} from "../../apps/api/src/modules/model-catalog/presentation/http-model-catalog-routes.ts";

describe("model catalog routes", () => {
  test("lists seeded public models", async () => {
    const service = new ModelCatalogService(new InMemoryModelCatalogRepository());
    const result = await handleListModels(service, "image", {
      "x-request-id": "req-model-list",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (result.body.success) {
      assert.ok(result.body.data.items.length >= 1);
      assert.ok(result.body.data.items.every((item) => item.kind === "image"));
    }
  });

  test("requires an authenticated admin to create a model", async () => {
    const service = new ModelCatalogService(new InMemoryModelCatalogRepository());
    const unauthorized = await handleCreateAdminModel(service, {
      modelCode: "custom-model-1",
      displayName: "Custom Model",
      kind: "chat",
      availability: "public",
    }, {
      "x-request-id": "req-model-unauthorized",
    });

    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.body.success, false);

    const forbidden = await handleCreateAdminModel(service, {
      modelCode: "custom-model-1",
      displayName: "Custom Model",
      kind: "chat",
      availability: "public",
    }, {
      "x-request-id": "req-model-forbidden",
      [AUTHENTICATED_USER_ID_HEADER]: "user-model-actor",
      [AUTHENTICATED_USER_ROLE_HEADER]: "user",
    });

    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.success, false);

    const elevationRequired = await handleCreateAdminModel(service, {
      modelCode: "custom-model-elevation",
      displayName: "Custom Model Elevation",
      kind: "chat",
      availability: "public",
    }, {
      "x-request-id": "req-model-elevation",
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
    });

    assert.equal(elevationRequired.statusCode, 403);
    assert.equal(elevationRequired.body.success, false);
    if (!elevationRequired.body.success) {
      assert.equal(elevationRequired.body.error.code, "ADMIN_ELEVATION_REQUIRED");
    }
  });

  test("creates a model and rejects duplicate modelCode", async () => {
    const service = new ModelCatalogService(new InMemoryModelCatalogRepository());
    const headers = {
      "x-request-id": "req-model-create-1",
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
      [AUTHENTICATED_ADMIN_SESSION_HEADER]: "true",
    };

    const first = await handleCreateAdminModel(service, {
      modelCode: "custom-model-2",
      displayName: "Custom Model 2",
      kind: "chat",
      availability: "public",
      billingMode: "credits",
      defaultCreditCost: 3,
    }, headers);

    const second = await handleCreateAdminModel(service, {
      modelCode: "custom-model-2",
      displayName: "Custom Model 2 Duplicate",
      kind: "chat",
      availability: "public",
    }, {
      ...headers,
      "x-request-id": "req-model-create-2",
    });

    assert.equal(first.statusCode, 201);
    assert.equal(first.body.success, true);
    assert.equal(second.statusCode, 409);
    assert.equal(second.body.success, false);
  });

});
