import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AUTHENTICATED_USER_EMAIL_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
} from "../../packages/shared/src/index.ts";
import { AuthDataService } from "../../apps/api/src/modules/auth/application/auth-data-service.ts";
import { InMemoryAuthDataRepository } from "../../apps/api/src/modules/auth/infrastructure/in-memory-auth-data-repository.ts";
import type { UserScopedAuthDataMirror } from "../../apps/api/src/modules/auth/infrastructure/supabase-user-scoped-auth-data-mirror.ts";
import {
  handleCreateTempUser,
  handleGetKeyManagerCloudState,
  handleGetUserApiEntries,
  handleReplaceUserApisPayload,
  handleReplaceKeyManagerCloudState,
  handleReplaceUserApiEntries,
} from "../../apps/api/src/modules/auth/presentation/http-auth-data-routes.ts";

const REDACTED_KEY_PREFIX = "__kk_redacted__:key:";
const REDACTED_API_KEY_PREFIX = "__kk_redacted__:apiKey:";

class FakeUserScopedAuthDataMirror implements UserScopedAuthDataMirror {
  public payload: unknown | null = null;
  public lastSaved:
    | {
        accessToken: string;
        userId: string;
        email?: string;
        payload: unknown;
      }
    | null = null;

  async loadUserApisPayload(_accessToken: string, _userId: string): Promise<unknown | null> {
    return this.payload;
  }

  async saveUserApisPayload(
    accessToken: string,
    userId: string,
    email: string | undefined,
    payload: unknown,
  ): Promise<void> {
    this.lastSaved = {
      accessToken,
      userId,
      email,
      payload,
    };
    this.payload = payload;
  }
}

class FailingUserScopedAuthDataMirror implements UserScopedAuthDataMirror {
  async loadUserApisPayload(): Promise<unknown | null> {
    return null;
  }

  async saveUserApisPayload(): Promise<void> {
    throw new Error("mirror unavailable");
  }
}

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

    const unauthorizedReplacePayload = await handleReplaceUserApisPayload(service, {
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    }, {
      "x-request-id": "req-user-apis-payload-replace-unauthorized",
    });
    assert.equal(unauthorizedReplacePayload.statusCode, 401);
    assert.equal(unauthorizedReplacePayload.body.success, false);
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
    assert.equal(replace.body.data.entries[0].key, `${REDACTED_KEY_PREFIX}entry-1`);

    const listed = await handleGetUserApiEntries(service, {
      ...headers,
      "x-request-id": "req-user-apis-list-after",
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (listed.body.success) {
      assert.equal(listed.body.data.entries.length, 1);
      assert.equal(listed.body.data.entries[0].id, "entry-1");
      assert.equal(listed.body.data.entries[0].key, "__kk_redacted__:key:entry-1");
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
      version: 3,
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
    assert.equal(replace.body.data.version, 3);
    assert.equal(replace.body.data.slots.length, 1);
    assert.equal(replace.body.data.providers.length, 1);
    assert.equal(replace.body.data.entries.length, 0);
    assert.equal(replace.body.data.slots[0].key, `${REDACTED_KEY_PREFIX}slot-1`);
    assert.equal(replace.body.data.providers[0].apiKey, `${REDACTED_API_KEY_PREFIX}provider-1`);

    const listed = await handleGetKeyManagerCloudState(service, {
      ...headers,
      "x-request-id": "req-key-manager-state-get-after",
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (listed.body.success) {
      assert.equal(listed.body.data.version, 3);
      assert.equal(listed.body.data.slots.length, 1);
      assert.equal(listed.body.data.providers.length, 1);
      assert.equal(listed.body.data.entries.length, 0);
      assert.equal(listed.body.data.providers[0].id, "provider-1");
      assert.equal(listed.body.data.slots[0].key, `${REDACTED_KEY_PREFIX}slot-1`);
      assert.equal(listed.body.data.providers[0].apiKey, `${REDACTED_API_KEY_PREFIX}provider-1`);
    }
  });

  test("preserves user api entries when key-manager state syncs", async () => {
    const service = new AuthDataService(new InMemoryAuthDataRepository());
    const headers = {
      "x-request-id": "req-user-apis-preserved",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-3",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-3@example.com",
    };

    const replaceUserApis = await handleReplaceUserApiEntries(service, {
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
      "x-request-id": "req-user-apis-preserved-write-entries",
    });

    assert.equal(replaceUserApis.statusCode, 200);
    assert.equal(replaceUserApis.body.success, true);

    const replaceKeyManager = await handleReplaceKeyManagerCloudState(service, {
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
      "x-request-id": "req-user-apis-preserved-write-slots",
    });

    assert.equal(replaceKeyManager.statusCode, 200);
    assert.equal(replaceKeyManager.body.success, true);
    if (replaceKeyManager.body.success) {
      assert.equal(replaceKeyManager.body.data.slots.length, 1);
      assert.equal(replaceKeyManager.body.data.entries.length, 1);
      assert.equal(replaceKeyManager.body.data.entries[0].id, "entry-1");
      assert.equal(replaceKeyManager.body.data.entries[0].key, `${REDACTED_KEY_PREFIX}entry-1`);
    }

    const listedUserApis = await handleGetUserApiEntries(service, {
      ...headers,
      "x-request-id": "req-user-apis-preserved-list",
    });

    assert.equal(listedUserApis.statusCode, 200);
    assert.equal(listedUserApis.body.success, true);
    if (listedUserApis.body.success) {
      assert.equal(listedUserApis.body.data.entries.length, 1);
      assert.equal(listedUserApis.body.data.entries[0].id, "entry-1");
      assert.equal(listedUserApis.body.data.entries[0].key, "__kk_redacted__:key:entry-1");
    }
  });

  test("replaces the full user api payload in one request and preserves stored secrets", async () => {
    const service = new AuthDataService(new InMemoryAuthDataRepository());
    const headers = {
      "x-request-id": "req-user-apis-payload-write",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-4",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-4@example.com",
    };

    const seedEntries = await handleReplaceUserApiEntries(service, {
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
    }, headers);
    assert.equal(seedEntries.statusCode, 200);

    const replacePayload = await handleReplaceUserApisPayload(service, {
      version: 5,
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
      entries: [
        {
          id: "entry-1",
          key: `${REDACTED_KEY_PREFIX}entry-1`,
          name: "Updated Google Key",
          provider: "Google",
          type: "official",
          format: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com",
          supportedModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
          disabled: true,
          createdAt: 1700000000000,
          updatedAt: 1700000005000,
          status: "valid",
          failCount: 0,
          successCount: 3,
          totalCost: 12,
          budgetLimit: -1,
          tokenLimit: -1,
          usedTokens: 100,
          lastUsed: 1700000005000,
          lastError: null,
        },
      ],
    }, {
      ...headers,
      "x-request-id": "req-user-apis-payload-write-2",
    });

    assert.equal(replacePayload.statusCode, 200);
    assert.equal(replacePayload.body.success, true);
    if (!replacePayload.body.success) {
      return;
    }

    assert.equal(replacePayload.body.data.version, 5);
    assert.equal(replacePayload.body.data.slots.length, 1);
    assert.equal(replacePayload.body.data.providers.length, 1);
    assert.equal(replacePayload.body.data.entries.length, 1);
    assert.equal(replacePayload.body.data.entries[0].name, "Updated Google Key");
    assert.equal(replacePayload.body.data.entries[0].key, `${REDACTED_KEY_PREFIX}entry-1`);
    assert.equal(replacePayload.body.data.providers[0].apiKey, `${REDACTED_API_KEY_PREFIX}provider-1`);

    const listed = await handleGetKeyManagerCloudState(service, {
      ...headers,
      "x-request-id": "req-user-apis-payload-read-after",
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (listed.body.success) {
      assert.equal(listed.body.data.version, 5);
      assert.equal(listed.body.data.entries.length, 1);
      assert.equal(listed.body.data.entries[0].key, `${REDACTED_KEY_PREFIX}entry-1`);
      assert.equal(listed.body.data.entries[0].status, "valid");
      assert.equal(listed.body.data.entries[0].disabled, true);
    }
  });

  test("rejects invalid auth-data payloads before they can be persisted", async () => {
    const service = new AuthDataService(new InMemoryAuthDataRepository());
    const headers = {
      "x-request-id": "req-user-apis-invalid-payload",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-invalid-1",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-invalid-1@example.com",
    };

    const response = await handleReplaceUserApisPayload(service, {
      version: 0,
      slots: [
        {
          key: "sk-slot-secret",
        },
      ],
      providers: [
        {
          id: "provider-1",
          apiKey: 123,
        },
      ],
      entries: [
        {
          id: "entry-1",
          key: "sk-entry-secret",
          name: "Broken Entry",
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
        } as any,
      ],
    } as any, headers);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
    if (response.body.success) {
      return;
    }

    const detailFields = (response.body.error.details || []).map((detail) => detail.field);
    assert.ok(detailFields.includes("version"));
    assert.ok(detailFields.includes("slots[0].id"));
    assert.ok(detailFields.includes("providers[0].apiKey"));
    assert.ok(detailFields.includes("entries[0].lastError"));
  });

  test("mirrors local auth data to the user-scoped cloud profile when a bearer token is present", async () => {
    const mirror = new FakeUserScopedAuthDataMirror();
    const service = new AuthDataService(new InMemoryAuthDataRepository(), {
      cloudMirror: mirror,
    });
    const headers = {
      authorization: "Bearer supabase-user-token-1",
      "x-request-id": "req-user-apis-mirror-write",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-mirror-1",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-mirror-1@example.com",
    };

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
    }, headers);

    assert.equal(replace.statusCode, 200);
    assert.ok(mirror.lastSaved);
    assert.equal(mirror.lastSaved?.accessToken, "supabase-user-token-1");
    assert.equal(mirror.lastSaved?.userId, "user-auth-data-mirror-1");
    assert.equal(mirror.lastSaved?.email, "user-auth-data-mirror-1@example.com");
    assert.equal(
      (mirror.lastSaved?.payload as { entries?: Array<{ key?: string }> }).entries?.[0]?.key,
      "sk-entry-1-secret",
    );
  });

  test("returns a failure response when the cloud mirror write fails", async () => {
    const mirror = new FailingUserScopedAuthDataMirror();
    const repository = new InMemoryAuthDataRepository();
    const service = new AuthDataService(repository, {
      cloudMirror: mirror,
    });
    const headers = {
      authorization: "Bearer supabase-user-token-1",
      "x-request-id": "req-user-apis-mirror-fail",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-mirror-fail-1",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-mirror-fail-1@example.com",
    };

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
    }, headers);

    assert.equal(replace.statusCode, 503);
    assert.equal(replace.body.success, false);
    if (!replace.body.success) {
      assert.equal(replace.body.error.code, "CLOUD_MIRROR_FAILED");
      assert.deepEqual(replace.body.error.details, [{ rollbackSucceeded: true }]);
    }

    const localPayload = await repository.getUserApisPayload("user-auth-data-mirror-fail-1", "user-auth-data-mirror-fail-1@example.com");
    assert.deepEqual(localPayload, {
      version: 2,
      slots: [],
      providers: [],
      entries: [],
    });
  });

  test("hydrates local auth data from the user-scoped cloud profile on read", async () => {
    const mirror = new FakeUserScopedAuthDataMirror();
    mirror.payload = {
      version: 2,
      slots: [],
      providers: [],
      entries: [
        {
          id: "entry-cloud-1",
          key: "sk-cloud-secret",
          name: "Cloud Key",
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
    };

    const repository = new InMemoryAuthDataRepository();
    const service = new AuthDataService(repository, {
      cloudMirror: mirror,
    });
    const headers = {
      authorization: "Bearer supabase-user-token-2",
      "x-request-id": "req-user-apis-mirror-read",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-mirror-2",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-mirror-2@example.com",
    };

    const listed = await handleGetUserApiEntries(service, headers);
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (!listed.body.success) {
      return;
    }

    assert.equal(listed.body.data.entries.length, 1);
    assert.equal(listed.body.data.entries[0].id, "entry-cloud-1");
    assert.equal(listed.body.data.entries[0].key, `${REDACTED_KEY_PREFIX}entry-cloud-1`);

    const localPayload = await repository.getUserApisPayload("user-auth-data-mirror-2", "user-auth-data-mirror-2@example.com");
    assert.equal(
      (localPayload as { entries?: Array<{ key?: string }> }).entries?.[0]?.key,
      "sk-cloud-secret",
    );
  });

  test("prefers the denser cloud payload when local storage has fewer user api records", async () => {
    const mirror = new FakeUserScopedAuthDataMirror();
    mirror.payload = {
      version: 2,
      slots: [],
      providers: [],
      entries: [
        {
          id: "entry-cloud-1",
          key: "sk-cloud-secret",
          name: "Cloud Key",
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
        {
          id: "entry-cloud-2",
          key: "sk-cloud-secret-2",
          name: "Cloud Key Two",
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
    };

    const repository = new InMemoryAuthDataRepository();
    await repository.replaceUserApiEntries("user-auth-data-mirror-3", "user-auth-data-mirror-3@example.com", [
      {
        id: "entry-local-1",
        key: "sk-local-secret",
        name: "Local Key",
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
    ]);

    const service = new AuthDataService(repository, {
      cloudMirror: mirror,
    });
    const headers = {
      authorization: "Bearer supabase-user-token-3",
      "x-request-id": "req-user-apis-mirror-dense-cloud",
      [AUTHENTICATED_USER_ID_HEADER]: "user-auth-data-mirror-3",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-auth-data-mirror-3@example.com",
    };

    const listed = await handleGetUserApiEntries(service, headers);
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.success, true);
    if (!listed.body.success) {
      return;
    }

    assert.equal(listed.body.data.entries.length, 2);
    assert.equal(listed.body.data.entries[0].key, `${REDACTED_KEY_PREFIX}entry-cloud-1`);

    const localPayload = await repository.getUserApisPayload("user-auth-data-mirror-3", "user-auth-data-mirror-3@example.com");
    assert.equal(
      (localPayload as { entries?: Array<{ key?: string }> }).entries?.length,
      2,
    );
  });

  test("heals a local provider placeholder from the cloud mirror before resolving a secure proxy route", async () => {
    const mirror = new FakeUserScopedAuthDataMirror();
    mirror.payload = {
      version: 2,
      slots: [],
      providers: [
        {
          id: "provider-cloud-1",
          name: "Cloud Provider",
          baseUrl: "https://provider.example.com/v1",
          apiKey: "sk-cloud-provider-secret",
          format: "openai",
          isActive: true,
        },
      ],
      entries: [],
    };

    const repository = new InMemoryAuthDataRepository();
    await repository.replaceKeyManagerCloudState("user-auth-data-mirror-4", "user-auth-data-mirror-4@example.com", {
      version: 2,
      slots: [],
      providers: [
        {
          id: "provider-cloud-1",
          name: "Cloud Provider",
          baseUrl: "https://provider.example.com/v1",
          apiKey: `${REDACTED_API_KEY_PREFIX}provider-cloud-1`,
          format: "openai",
          isActive: true,
        } as any,
      ],
    });

    const service = new AuthDataService(repository, {
      cloudMirror: mirror,
    });

    const resolved = await service.resolveSecureProxyUserRouteConfig(
      "user-auth-data-mirror-4",
      "user-auth-data-mirror-4@example.com",
      "provider-cloud-1",
      "supabase-user-token-4",
    );

    assert.equal(resolved?.routeId, "provider-cloud-1");
    assert.equal(resolved?.apiKey, "sk-cloud-provider-secret");

    const localPayload = await repository.getUserApisPayload("user-auth-data-mirror-4", "user-auth-data-mirror-4@example.com");
    const providers = (localPayload as { providers?: Array<{ id?: string; apiKey?: string }> }).providers || [];
    assert.equal(
      providers.find((provider) => provider.id === "provider-cloud-1")?.apiKey,
      "sk-cloud-provider-secret",
    );
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
