import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createApiServer } from "../../apps/api/src/server.ts";
import { InMemoryCreditAccountRepository } from "../../apps/api/src/modules/billing/infrastructure/in-memory-credit-account-repository.ts";

function getBaseUrl(server: ReturnType<typeof createApiServer>): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose a TCP port.");
  }

  return `http://127.0.0.1:${address.port}`;
}

describe("api server contract", () => {
  let currentAdminPassword = "123456";
  const authenticatedTokens = new Map([
    ["contract-user-token", { userId: "contract-user-1", role: "user" }],
    ["contract-admin-token", { userId: "admin-user-1", email: "admin@example.com", role: "admin" }],
    ["contract-asset-token", { userId: "asset-contract-user", role: "user" }],
  ]);
  const server = createApiServer(0, {
    creditAccountRepository: new InMemoryCreditAccountRepository(),
    resolveAccessToken: (accessToken) => authenticatedTokens.get(accessToken),
    verifyTurnstileToken: async () => ({ success: true }),
  });

  let baseUrl = "";

  before(async () => {
    if (server.listening) {
      baseUrl = getBaseUrl(server);
      return;
    }

    await new Promise<void>((resolve) => {
      server.once("listening", () => {
        baseUrl = getBaseUrl(server);
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  async function createAdminSessionToken(requestId: string): Promise<string> {
    const verifyResponse = await fetch(`${baseUrl}/api/v1/admin/session/verify-password`, {
      method: "POST",
      headers: {
        authorization: "Bearer contract-admin-token",
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        password: currentAdminPassword,
      }),
    });

    assert.equal(verifyResponse.status, 200);
    const verifyPayload = await verifyResponse.json();
    assert.equal(verifyPayload.success, true);
    return verifyPayload.data.adminSessionToken;
  }

  test("register returns the documented auth envelope", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-contract-register",
      },
      body: JSON.stringify({
        email: "contract@example.com",
        password: "password-123",
        turnstileToken: "turnstile-ok",
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.email, "contract@example.com");
    assert.equal(payload.meta.requestId, "req-contract-register");
  });

  test("bad json is surfaced as a 400 envelope", async () => {
    const response = await fetch(`${baseUrl}/api/v1/generation-tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-contract-json",
      },
      body: "{invalid-json",
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "INVALID_JSON_BODY");
  });

  test("billing routes expose authenticated balance and idempotent debit", async () => {
    const authHeaders = {
      authorization: "Bearer contract-user-token",
      "x-request-id": "req-contract-billing-balance",
    };

    const balanceResponse = await fetch(`${baseUrl}/api/v1/billing/credits/balance`, {
      headers: authHeaders,
    });
    assert.equal(balanceResponse.status, 200);
    const balancePayload = await balanceResponse.json();
    assert.equal(balancePayload.success, true);
    assert.equal(balancePayload.data.balance, 100);

    const debitRequest = {
      businessRefType: "generation_task",
      businessRefId: "task-contract-1",
      creditAmount: 9,
      idempotencyKey: "idem-contract-1",
    };

    const firstDebit = await fetch(`${baseUrl}/api/v1/billing/credits/debit`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
        "x-request-id": "req-contract-billing-debit-1",
      },
      body: JSON.stringify(debitRequest),
    });

    const secondDebit = await fetch(`${baseUrl}/api/v1/billing/credits/debit`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
        "x-request-id": "req-contract-billing-debit-2",
      },
      body: JSON.stringify(debitRequest),
    });

    assert.equal(firstDebit.status, 200);
    assert.equal(secondDebit.status, 200);

    const firstPayload = await firstDebit.json();
    const secondPayload = await secondDebit.json();
    assert.equal(firstPayload.success, true);
    assert.equal(secondPayload.success, true);
    assert.equal(firstPayload.data.ledgerId, secondPayload.data.ledgerId);
    assert.equal(firstPayload.data.balanceAfter, 91);
    assert.equal(secondPayload.data.balanceAfter, 91);

    const transactionsResponse = await fetch(`${baseUrl}/api/v1/billing/credits/transactions?transactionType=consumption&limit=10`, {
      headers: {
        ...authHeaders,
        "x-request-id": "req-contract-billing-transactions",
      },
    });

    assert.equal(transactionsResponse.status, 200);
    const transactionsPayload = await transactionsResponse.json();
    assert.equal(transactionsPayload.success, true);
    assert.equal(transactionsPayload.data.items.length, 1);
    assert.equal(transactionsPayload.data.items[0].transactionType, "consumption");
    assert.equal(transactionsPayload.data.items[0].balanceAfter, 91);

    const refundResponse = await fetch(`${baseUrl}/api/v1/billing/credits/refunds`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
        "x-request-id": "req-contract-billing-refund",
      },
      body: JSON.stringify({
        transactionId: firstPayload.data.ledgerId,
        reason: "contract refund",
      }),
    });

    assert.equal(refundResponse.status, 200);
    const refundPayload = await refundResponse.json();
    assert.equal(refundPayload.success, true);
    assert.equal(refundPayload.data.originalTransactionId, firstPayload.data.ledgerId);
    assert.equal(refundPayload.data.balanceAfter, 100);
  });

  test("protected routes ignore spoofed client identity headers", async () => {
    const balanceResponse = await fetch(`${baseUrl}/api/v1/billing/credits/balance`, {
      headers: {
        "x-request-id": "req-contract-spoofed-balance",
        "x-user-id": "contract-user-1",
      },
    });

    assert.equal(balanceResponse.status, 401);
    const balancePayload = await balanceResponse.json();
    assert.equal(balancePayload.success, false);
    assert.equal(balancePayload.error.code, "AUTH_REQUIRED");

    const rechargeResponse = await fetch(`${baseUrl}/api/v1/admin/billing/recharges`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-contract-spoofed-admin",
        "x-user-role": "admin",
      },
      body: JSON.stringify({
        identity: "user-1@example.com",
        creditAmount: 30,
      }),
    });

    assert.equal(rechargeResponse.status, 401);
    const rechargePayload = await rechargeResponse.json();
    assert.equal(rechargePayload.success, false);
    assert.equal(rechargePayload.error.code, "AUTH_REQUIRED");
  });

  test("admin billing recharge endpoint honors the contract shape", async () => {
    const adminSessionToken = await createAdminSessionToken("req-contract-admin-recharge-verify");
    const response = await fetch(`${baseUrl}/api/v1/admin/billing/recharges`, {
      method: "POST",
      headers: {
        authorization: "Bearer contract-admin-token",
        "content-type": "application/json",
        "x-admin-session-token": adminSessionToken,
        "x-request-id": "req-contract-admin-recharge",
      },
      body: JSON.stringify({
        identity: "contract-admin-target-1",
        creditAmount: 30,
        description: "contract recharge",
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.data.identity, "contract-admin-target-1");
    assert.equal(payload.data.creditedAmount, 30);
    assert.equal(payload.data.balanceAfter, 130);
  });

  test("admin console endpoints honor the contract shape", async () => {
    const authHeaders = {
      authorization: "Bearer contract-admin-token",
      "x-request-id": "req-contract-admin-access",
    };

    const accessResponse = await fetch(`${baseUrl}/api/v1/admin/access`, {
      headers: authHeaders,
    });

    assert.equal(accessResponse.status, 200);
    const accessPayload = await accessResponse.json();
    assert.equal(accessPayload.success, true);
    assert.equal(accessPayload.data.userId, "admin-user-1");
    assert.equal(accessPayload.data.isAdmin, true);
    assert.equal(accessPayload.data.adminSessionActive, false);
    assert.equal(accessPayload.data.requiresPasswordChange, true);

    const adminSessionToken = await createAdminSessionToken("req-contract-admin-verify");

    const accessWithSessionResponse = await fetch(`${baseUrl}/api/v1/admin/access`, {
      headers: {
        ...authHeaders,
        "x-admin-session-token": adminSessionToken,
        "x-request-id": "req-contract-admin-access-session",
      },
    });

    assert.equal(accessWithSessionResponse.status, 200);
    const accessWithSessionPayload = await accessWithSessionResponse.json();
    assert.equal(accessWithSessionPayload.success, true);
    assert.equal(accessWithSessionPayload.data.adminSessionActive, true);
    assert.ok(accessWithSessionPayload.data.adminSessionExpiresAt);

    const changeResponse = await fetch(`${baseUrl}/api/v1/admin/password`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
        "x-admin-session-token": adminSessionToken,
        "x-request-id": "req-contract-admin-password-change",
      },
      body: JSON.stringify({
        oldPassword: currentAdminPassword,
        newPassword: "contract-new-password-1",
      }),
    });

    assert.equal(changeResponse.status, 200);
    const changePayload = await changeResponse.json();
    assert.equal(changePayload.success, true);
    assert.equal(changePayload.data.changed, true);
    currentAdminPassword = "contract-new-password-1";

    const refreshedAdminSessionToken = await createAdminSessionToken("req-contract-admin-reverify");

    const setRoleResponse = await fetch(`${baseUrl}/api/v1/admin/users/roles`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
        "x-admin-session-token": refreshedAdminSessionToken,
        "x-request-id": "req-contract-admin-set-role",
      },
      body: JSON.stringify({
        identity: "user-1@example.com",
        role: "admin",
      }),
    });

    assert.equal(setRoleResponse.status, 200);
    const setRolePayload = await setRoleResponse.json();
    assert.equal(setRolePayload.success, true);
    assert.equal(setRolePayload.data.identity, "user-1@example.com");
    assert.equal(setRolePayload.data.role, "admin");
  });

  test("profile endpoints resolve the current session and allow patch updates", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-contract-profile-login",
      },
      body: JSON.stringify({
        email: "profile-contract@example.com",
        password: "password-123",
      }),
    });

    const loginPayload = await loginResponse.json();
    assert.equal(loginResponse.status, 200);
    assert.equal(loginPayload.success, true);

    const authorization = `Bearer ${loginPayload.data.accessToken}`;

    const profileResponse = await fetch(`${baseUrl}/api/v1/profile`, {
      headers: {
        authorization,
        "x-request-id": "req-contract-profile-get",
      },
    });
    assert.equal(profileResponse.status, 200);
    const profilePayload = await profileResponse.json();
    assert.equal(profilePayload.success, true);
    assert.equal(profilePayload.data.email, "profile-contract@example.com");

    const patchResponse = await fetch(`${baseUrl}/api/v1/profile`, {
      method: "PATCH",
      headers: {
        authorization,
        "content-type": "application/json",
        "x-request-id": "req-contract-profile-patch",
      },
      body: JSON.stringify({
        nickname: "Contract Tester",
      }),
    });

    assert.equal(patchResponse.status, 200);
    const patchPayload = await patchResponse.json();
    assert.equal(patchPayload.success, true);
    assert.equal(patchPayload.data.nickname, "Contract Tester");
  });

  test("profile user api entries and guest temp-user endpoints honor the contract shape", async () => {
    const tempUserResponse = await fetch(`${baseUrl}/api/v1/auth/temp-users`, {
      method: "POST",
      headers: {
        "x-request-id": "req-contract-temp-user",
      },
    });

    assert.equal(tempUserResponse.status, 201);
    const tempUserPayload = await tempUserResponse.json();
    assert.equal(tempUserPayload.success, true);
    assert.equal(tempUserPayload.data.isTempUser, true);
    assert.match(tempUserPayload.data.email, /@temp\.local$/);

    const unauthorizedEntries = await fetch(`${baseUrl}/api/v1/profile/user-apis`, {
      headers: {
        "x-request-id": "req-contract-user-apis-unauthorized",
      },
    });
    assert.equal(unauthorizedEntries.status, 401);

    const userApiEntriesResponse = await fetch(`${baseUrl}/api/v1/profile/user-apis`, {
      method: "PUT",
      headers: {
        authorization: "Bearer contract-user-token",
        "content-type": "application/json",
        "x-request-id": "req-contract-user-apis-save",
      },
      body: JSON.stringify({
        entries: [
          {
            id: "contract-entry-1",
            key: "sk-contract-entry-1",
            name: "Contract Key",
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
      }),
    });

    assert.equal(userApiEntriesResponse.status, 200);
    const userApiEntriesPayload = await userApiEntriesResponse.json();
    assert.equal(userApiEntriesPayload.success, true);
    assert.equal(userApiEntriesPayload.data.entries.length, 1);
    assert.equal(userApiEntriesPayload.data.entries[0].id, "contract-entry-1");

    const userApiEntriesGet = await fetch(`${baseUrl}/api/v1/profile/user-apis`, {
      headers: {
        authorization: "Bearer contract-user-token",
        "x-request-id": "req-contract-user-apis-get",
      },
    });

    assert.equal(userApiEntriesGet.status, 200);
    const userApiEntriesGetPayload = await userApiEntriesGet.json();
    assert.equal(userApiEntriesGetPayload.success, true);
    assert.equal(userApiEntriesGetPayload.data.entries.length, 1);
    assert.equal(userApiEntriesGetPayload.data.entries[0].provider, "Google");
  });

  test("profile key-manager cloud-state endpoints honor the contract shape", async () => {
    const unauthorizedState = await fetch(`${baseUrl}/api/v1/profile/key-manager-state`, {
      headers: {
        "x-request-id": "req-contract-key-manager-unauthorized",
      },
    });
    assert.equal(unauthorizedState.status, 401);

    const saveResponse = await fetch(`${baseUrl}/api/v1/profile/key-manager-state`, {
      method: "PUT",
      headers: {
        authorization: "Bearer contract-user-token",
        "content-type": "application/json",
        "x-request-id": "req-contract-key-manager-save",
      },
      body: JSON.stringify({
        version: 2,
        slots: [
          {
            id: "contract-slot-1",
            key: "sk-contract-slot-1",
            name: "Contract Slot",
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
            id: "contract-provider-1",
            name: "Contract Provider",
            baseUrl: "https://provider.contract.local/v1",
            apiKey: "provider-secret-1",
            models: ["gemini-2.5-flash"],
            format: "openai",
            isActive: true,
          },
        ],
      }),
    });

    assert.equal(saveResponse.status, 200);
    const savePayload = await saveResponse.json();
    assert.equal(savePayload.success, true);
    assert.equal(savePayload.data.version, 2);
    assert.equal(savePayload.data.slots.length, 1);
    assert.equal(savePayload.data.providers.length, 1);
    assert.equal(savePayload.data.entries.length, 1);
    assert.equal(savePayload.data.entries[0].id, "contract-slot-1");

    const getResponse = await fetch(`${baseUrl}/api/v1/profile/key-manager-state`, {
      headers: {
        authorization: "Bearer contract-user-token",
        "x-request-id": "req-contract-key-manager-get",
      },
    });

    assert.equal(getResponse.status, 200);
    const getPayload = await getResponse.json();
    assert.equal(getPayload.success, true);
    assert.equal(getPayload.data.version, 2);
    assert.equal(getPayload.data.slots.length, 1);
    assert.equal(getPayload.data.providers.length, 1);
    assert.equal(getPayload.data.entries.length, 1);
    assert.equal(getPayload.data.providers[0].id, "contract-provider-1");
  });

  test("model catalog and admin model endpoints honor the contract shape", async () => {
    const listResponse = await fetch(`${baseUrl}/api/v1/model-catalog/models?kind=image`, {
      headers: {
        "x-request-id": "req-contract-model-list",
      },
    });

    assert.equal(listResponse.status, 200);
    const listPayload = await listResponse.json();
    assert.equal(listPayload.success, true);
    assert.ok(Array.isArray(listPayload.data.items));

    const adminSessionToken = await createAdminSessionToken("req-contract-model-create-verify");

    const createResponse = await fetch(`${baseUrl}/api/v1/admin/models`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-contract-model-create",
        authorization: "Bearer contract-admin-token",
        "x-admin-session-token": adminSessionToken,
      },
      body: JSON.stringify({
        modelCode: "contract-admin-model",
        displayName: "Contract Admin Model",
        kind: "chat",
        availability: "public",
        billingMode: "credits",
        defaultCreditCost: 5,
      }),
    });

    assert.equal(createResponse.status, 201);
    const createPayload = await createResponse.json();
    assert.equal(createPayload.success, true);
    assert.equal(createPayload.data.modelCode, "contract-admin-model");
  });

  test("credit provider endpoints honor the contract shape", async () => {
    const activeResponse = await fetch(`${baseUrl}/api/v1/model-catalog/active-credit-models`, {
      headers: {
        "x-request-id": "req-contract-active-credit-models",
      },
    });

    assert.equal(activeResponse.status, 200);
    const activePayload = await activeResponse.json();
    assert.equal(activePayload.success, true);
    assert.ok(Array.isArray(activePayload.data.items));

    const listForbiddenResponse = await fetch(`${baseUrl}/api/v1/admin/credit-providers`, {
      headers: {
        authorization: "Bearer contract-user-token",
        "x-request-id": "req-contract-credit-provider-list-forbidden",
      },
    });

    assert.equal(listForbiddenResponse.status, 403);

    const adminListResponse = await fetch(`${baseUrl}/api/v1/admin/credit-providers`, {
      headers: {
        authorization: "Bearer contract-admin-token",
        "x-request-id": "req-contract-credit-provider-list",
      },
    });

    assert.equal(adminListResponse.status, 200);
    const adminListPayload = await adminListResponse.json();
    assert.equal(adminListPayload.success, true);
    assert.ok(Array.isArray(adminListPayload.data.items));

    const adminSessionToken = await createAdminSessionToken("req-contract-credit-provider-verify");

    const saveResponse = await fetch(`${baseUrl}/api/v1/admin/credit-providers/contract-provider`, {
      method: "PUT",
      headers: {
        authorization: "Bearer contract-admin-token",
        "content-type": "application/json",
        "x-admin-session-token": adminSessionToken,
        "x-request-id": "req-contract-credit-provider-save",
      },
      body: JSON.stringify({
        providerName: "Contract Provider",
        baseUrl: "https://provider.contract.local/v1",
        apiKeys: ["provider-secret-1"],
        models: [
          {
            modelId: "contract-image-model",
            displayName: "Contract Image Model",
            description: "Contract test provider model",
            endpointType: "openai",
            creditCost: 4,
            advancedEnabled: false,
            mixWithSameModel: false,
            qualityPricing: {
              "1K": {
                enabled: true,
                creditCost: 4,
              },
            },
            priority: 10,
            weight: 1,
            isActive: true,
            color: "#2563EB",
            colorSecondary: "#1D4ED8",
            textColor: "white",
            maxCallsLimit: null,
            autoPauseOnLimit: true,
          },
        ],
      }),
    });

    assert.equal(saveResponse.status, 200);
    const savePayload = await saveResponse.json();
    assert.equal(savePayload.success, true);
    assert.equal(savePayload.data.providerId, "contract-provider");
    assert.equal(savePayload.data.apiKeyCount, 1);

    const deleteResponse = await fetch(`${baseUrl}/api/v1/admin/credit-providers/contract-provider`, {
      method: "DELETE",
      headers: {
        authorization: "Bearer contract-admin-token",
        "x-admin-session-token": adminSessionToken,
        "x-request-id": "req-contract-credit-provider-delete",
      },
    });

    assert.equal(deleteResponse.status, 200);
    const deletePayload = await deleteResponse.json();
    assert.equal(deletePayload.success, true);
    assert.equal(deletePayload.data.deleted, true);
  });

  test("workspace canvas and asset library endpoints honor the contract shape", async () => {
    const workflowResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace-contract-1/workflows/workflow-contract-1`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-contract-workflow-save",
      },
      body: JSON.stringify({
        name: "Contract Workflow",
        version: 1,
        nodes: [
          {
            id: "node-a",
            nodeType: "prompt",
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      }),
    });

    assert.equal(workflowResponse.status, 200);

    const canvasResponse = await fetch(`${baseUrl}/api/v1/workspaces/workspace-contract-1/canvas`, {
      headers: {
        "x-request-id": "req-contract-canvas",
      },
    });

    assert.equal(canvasResponse.status, 200);
    const canvasPayload = await canvasResponse.json();
    assert.equal(canvasPayload.success, true);
    assert.equal(canvasPayload.data.workspaceId, "workspace-contract-1");

    const assetsResponse = await fetch(`${baseUrl}/api/v1/assets?kind=image&limit=1`, {
      headers: {
        authorization: "Bearer contract-asset-token",
        "x-request-id": "req-contract-assets",
      },
    });

    assert.equal(assetsResponse.status, 200);
    const assetsPayload = await assetsResponse.json();
    assert.equal(assetsPayload.success, true);
    assert.equal(assetsPayload.data.items.length, 1);
    assert.equal(assetsPayload.data.items[0].kind, "image");
  });

  test("workspace layout sync endpoints honor the contract shape", async () => {
    const unauthorizedResponse = await fetch(`${baseUrl}/api/v1/workspaces/layout`, {
      headers: {
        "x-request-id": "req-contract-layout-unauthorized",
      },
    });

    assert.equal(unauthorizedResponse.status, 401);

    const saveResponse = await fetch(`${baseUrl}/api/v1/workspaces/layout`, {
      method: "PUT",
      headers: {
        authorization: "Bearer contract-user-token",
        "content-type": "application/json",
        "x-request-id": "req-contract-layout-save",
      },
      body: JSON.stringify({
        canvases: [
          {
            id: "canvas-contract-1",
            name: "Contract Canvas",
            lastModified: 1700000000000,
          },
        ],
      }),
    });

    assert.equal(saveResponse.status, 200);
    const savePayload = await saveResponse.json();
    assert.equal(savePayload.success, true);
    assert.equal(savePayload.data.canvases.length, 1);
    assert.equal(savePayload.data.canvases[0].id, "canvas-contract-1");

    const getResponse = await fetch(`${baseUrl}/api/v1/workspaces/layout`, {
      headers: {
        authorization: "Bearer contract-user-token",
        "x-request-id": "req-contract-layout-get",
      },
    });

    assert.equal(getResponse.status, 200);
    const getPayload = await getResponse.json();
    assert.equal(getPayload.success, true);
    assert.equal(getPayload.data.canvases.length, 1);
    assert.equal(getPayload.data.canvases[0].name, "Contract Canvas");

    const cleanupResponse = await fetch(`${baseUrl}/api/v1/workspaces/layout/cloud-images`, {
      method: "DELETE",
      headers: {
        authorization: "Bearer contract-user-token",
        "x-request-id": "req-contract-layout-cleanup",
      },
    });

    assert.equal(cleanupResponse.status, 200);
    const cleanupPayload = await cleanupResponse.json();
    assert.equal(cleanupPayload.success, true);
    assert.equal(cleanupPayload.data.deletedCount, 0);
    assert.equal(cleanupPayload.data.preservedLayout, true);
  });
});
