import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AUTHENTICATED_ADMIN_SESSION_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
  AUTHENTICATED_USER_ROLE_HEADER,
} from "../../packages/shared/src/index.ts";
import { CreditProviderService } from "../../apps/api/src/modules/model-catalog/application/credit-provider-service.ts";
import { InMemoryCreditProviderRepository } from "../../apps/api/src/modules/model-catalog/infrastructure/in-memory-credit-provider-repository.ts";
import {
  handleDeleteAdminCreditProvider,
  handleListActiveCreditModels,
  handleListAdminCreditProviders,
  handleSaveAdminCreditProvider,
} from "../../apps/api/src/modules/model-catalog/presentation/http-credit-provider-routes.ts";

describe("credit provider routes", () => {
  test("lists active credit models without exposing secrets", async () => {
    const service = new CreditProviderService(new InMemoryCreditProviderRepository());
    const result = await handleListActiveCreditModels(service, {
      "x-request-id": "req-credit-provider-public-list",
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (result.body.success) {
      assert.ok(result.body.data.items.length >= 1);
      assert.equal(typeof result.body.data.items[0].providerId, "string");
      assert.equal("apiKeyCount" in result.body.data.items[0], false);
    }
  });

  test("admin provider list requires an authenticated admin", async () => {
    const service = new CreditProviderService(new InMemoryCreditProviderRepository());

    const unauthorized = await handleListAdminCreditProviders(service, {
      "x-request-id": "req-credit-provider-list-unauthorized",
    });

    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.body.success, false);

    const forbidden = await handleListAdminCreditProviders(service, {
      "x-request-id": "req-credit-provider-list-forbidden",
      [AUTHENTICATED_USER_ID_HEADER]: "user-credit-provider-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "user",
    });

    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.success, false);
  });

  test("admin provider mutations require elevation and support save/delete", async () => {
    const service = new CreditProviderService(new InMemoryCreditProviderRepository());
    const baseHeaders = {
      "x-request-id": "req-credit-provider-save",
      [AUTHENTICATED_USER_ID_HEADER]: "admin-user-1",
      [AUTHENTICATED_USER_ROLE_HEADER]: "admin",
    };

    const elevationRequired = await handleSaveAdminCreditProvider(service, "contract-provider", {
      providerName: "Contract Provider",
      baseUrl: "https://provider.contract.local/v1",
      apiKeys: ["provider-secret-1"],
      models: [
        {
          modelId: "contract-model",
          displayName: "Contract Model",
          endpointType: "openai",
          creditCost: 3,
          advancedEnabled: false,
          mixWithSameModel: false,
          qualityPricing: {
            "1K": {
              enabled: true,
              creditCost: 3,
            },
          },
          priority: 10,
          weight: 1,
          isActive: true,
          color: "#2563EB",
          textColor: "white",
        },
      ],
    }, baseHeaders);

    assert.equal(elevationRequired.statusCode, 403);
    assert.equal(elevationRequired.body.success, false);

    const elevatedHeaders = {
      ...baseHeaders,
      "x-request-id": "req-credit-provider-save-elevated",
      [AUTHENTICATED_ADMIN_SESSION_HEADER]: "true",
    };

    const saved = await handleSaveAdminCreditProvider(service, "contract-provider", {
      providerName: "Contract Provider",
      baseUrl: "https://provider.contract.local/v1",
      apiKeys: ["provider-secret-1"],
      models: [
        {
          modelId: "contract-model",
          displayName: "Contract Model",
          endpointType: "openai",
          creditCost: 3,
          advancedEnabled: false,
          mixWithSameModel: false,
          qualityPricing: {
            "1K": {
              enabled: true,
              creditCost: 3,
            },
          },
          priority: 10,
          weight: 1,
          isActive: true,
          color: "#2563EB",
          textColor: "white",
        },
      ],
    }, elevatedHeaders);

    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.success, true);
    if (saved.body.success) {
      assert.equal(saved.body.data.providerId, "contract-provider");
      assert.equal(saved.body.data.modelCount, 1);
      assert.equal(saved.body.data.apiKeyCount, 1);
    }

    const listed = await handleListAdminCreditProviders(service, elevatedHeaders);
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (listed.body.success) {
      const provider = listed.body.data.items.find((item) => item.providerId === "contract-provider");
      assert.ok(provider);
      assert.equal(provider?.apiKeyCount, 1);
      assert.equal(provider?.models[0]?.modelId, "contract-model");
    }

    const deleted = await handleDeleteAdminCreditProvider(service, "contract-provider", {
      ...elevatedHeaders,
      "x-request-id": "req-credit-provider-delete",
    });

    assert.equal(deleted.statusCode, 200);
    assert.equal(deleted.body.success, true);

    const missingDelete = await handleDeleteAdminCreditProvider(service, "missing-provider", {
      ...elevatedHeaders,
      "x-request-id": "req-credit-provider-delete-missing",
    });

    assert.equal(missingDelete.statusCode, 404);
    assert.equal(missingDelete.body.success, false);
  });
});
