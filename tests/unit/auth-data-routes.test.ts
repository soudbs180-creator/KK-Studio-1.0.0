import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AUTHENTICATED_USER_EMAIL_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
} from "../../packages/shared/src/index.ts";
import { AuthDataService } from "../../apps/api/src/modules/auth/application/auth-data-service.ts";
import { InMemoryAuthDataRepository } from "../../apps/api/src/modules/auth/infrastructure/in-memory-auth-data-repository.ts";
import {
  handleCreateTempUser,
  handleGetKeyManagerCloudState,
  handleGetUserApiEntries,
  handleReplaceKeyManagerCloudState,
  handleReplaceUserApiEntries,
} from "../../apps/api/src/modules/auth/presentation/http-auth-data-routes.ts";

describe("auth data routes", () => {
  test("requires authentication to read and replace user api entries", async () => {
    const service = new AuthDataService(new InMemoryAuthDataRepository());

    const unauthorizedList = await handleGetUserApiEntries(service, {
      "x-request-id": "req-user-apis-list-unauthorized",
    });
    assert.equal(unauthorizedList.statusCode, 401);
    assert.equal(unauthorizedList.body.success, false);

    const unauthorizedReplace = await handleReplaceUserApiEntries(service, {
      entries: [],
    }, {
      "x-request-id": "req-user-apis-replace-unauthorized",
    });
    assert.equal(unauthorizedReplace.statusCode, 401);
    assert.equal(unauthorizedReplace.body.success, false);
  });

  test("lists and replaces the current user's api entries", async () => {
    const service = new AuthDataService(new InMemoryAuthDataRepository());
    const headers = {
      "x-request-id": "req-user-apis-list",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-1",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-1@example.com",
    };

    const emptyList = await handleGetUserApiEntries(service, headers);
    assert.equal(emptyList.statusCode, 200);
    assert.equal(emptyList.body.success, true);
    if (emptyList.body.success) {
      assert.deepEqual(emptyList.body.data.entries, []);
    }

    const replace = await handleReplaceUserApiEntries(service, {
      entries: [
        {
          id: "entry-1",
          key: "sk-entry-1-secret",
          name: "Google Key",
          provider: "Google",
          type: "official",
          format: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com",
          supportedModels: ["gemini-2.5-flash"],
          disabled: false,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          status: "unknown",
          failCount: 0,
          successCount: 0,
          totalCost: 0,
          budgetLimit: -1,
          tokenLimit: -1,
          usedTokens: 0,
          lastUsed: null,
          lastError: null,
        },
      ],
    }, {
      ...headers,
      "x-request-id": "req-user-apis-replace",
    });

    assert.equal(replace.statusCode, 200);
    assert.equal(replace.body.success, true);
    if (!replace.body.success) {
      return;
    }
    assert.equal(replace.body.data.entries.length, 1);
    assert.equal(replace.body.data.entries[0].provider, "Google");

    const listed = await handleGetUserApiEntries(service, {
      ...headers,
      "x-request-id": "req-user-apis-list-after",
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (listed.body.success) {
      assert.equal(listed.body.data.entries.length, 1);
      assert.equal(listed.body.data.entries[0].id, "entry-1");
      assert.equal(listed.body.data.entries[0].key, "sk-entry-1-secret");
    }
  });

  test("lists and replaces the current user's key-manager cloud state", async () => {
    const service = new AuthDataService(new InMemoryAuthDataRepository());
    const headers = {
      "x-request-id": "req-key-manager-state-list",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-2",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-2@example.com",
    };

    const emptyState = await handleGetKeyManagerCloudState(service, headers);
    assert.equal(emptyState.statusCode, 200);
    assert.equal(emptyState.body.success, true);
    if (emptyState.body.success) {
      assert.deepEqual(emptyState.body.data.slots, []);
      assert.deepEqual(emptyState.body.data.providers, []);
      assert.deepEqual(emptyState.body.data.entries, []);
      assert.equal(emptyState.body.data.version, 2);
    }

    const replace = await handleReplaceKeyManagerCloudState(service, {
      version: 2,
      slots: [
        {
          id: "slot-1",
          key: "sk-slot-1-secret",
          name: "Primary Slot",
          provider: "Google",
          type: "official",
          format: "gemini",
          supportedModels: ["gemini-2.5-flash"],
          disabled: false,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          status: "unknown",
          failCount: 0,
          successCount: 0,
          totalCost: 0,
          budgetLimit: -1,
          tokenLimit: -1,
          usedTokens: 0,
          lastUsed: null,
          lastError: null,
        },
      ],
      providers: [
        {
          id: "provider-1",
          name: "Custom Provider",
          baseUrl: "https://provider.example.com/v1",
          apiKey: "provider-secret",
          models: ["gemini-2.5-flash"],
          format: "openai",
          isActive: true,
        },
      ],
    }, {
      ...headers,
      "x-request-id": "req-key-manager-state-replace",
    });

    assert.equal(replace.statusCode, 200);
    assert.equal(replace.body.success, true);
    if (!replace.body.success) {
      return;
    }
    assert.equal(replace.body.data.slots.length, 1);
    assert.equal(replace.body.data.providers.length, 1);
    assert.equal(replace.body.data.entries.length, 1);
    assert.equal(replace.body.data.entries[0].id, "slot-1");

    const listed = await handleGetKeyManagerCloudState(service, {
      ...headers,
      "x-request-id": "req-key-manager-state-get-after",
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (listed.body.success) {
      assert.equal(listed.body.data.slots.length, 1);
      assert.equal(listed.body.data.providers.length, 1);
      assert.equal(listed.body.data.entries.length, 1);
      assert.equal(listed.body.data.providers[0].id, "provider-1");
    }
  });

  test("creates guest temp users through the auth module", async () => {
    const service = new AuthDataService(new InMemoryAuthDataRepository());
    const result = await handleCreateTempUser(service, {
      "x-request-id": "req-temp-user",
      "user-agent": "unit-test-agent",
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(result.body.data.isTempUser, true);
    assert.match(result.body.data.email, /@temp\.local$/);
    assert.match(result.body.data.nickname, /^Guest_/);
  });
});
