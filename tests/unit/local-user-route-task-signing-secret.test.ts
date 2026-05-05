import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";

import type { SecureProxyUserRouteConfigDto } from "../../packages/contracts/src/index.ts";
import {
  LocalUserRouteProxyError,
  LocalUserRouteProxyService,
} from "../../apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts";

const originalFetch = globalThis.fetch;
const localProxyTaskPrefix = "local_proxy:";
const publicFallbackTaskSecret = "kkai-local-route-task-secret";

type LocalUserRouteAuthDataService = ConstructorParameters<typeof LocalUserRouteProxyService>[0];
type LocalUserRouteRuntimeConfig = ConstructorParameters<typeof LocalUserRouteProxyService>[1];

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signWithPublicFallbackSecret(payload: Record<string, unknown>): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    createHmac("sha256", publicFallbackTaskSecret)
      .update(encodedPayload)
      .digest(),
  );
  return `${localProxyTaskPrefix}${encodedPayload}.${signature}`;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("local user-route proxy rejects public fallback task tokens unless local/test fallback is explicit", async () => {
  let routeResolved = false;
  let upstreamCalled = false;

  globalThis.fetch = async () => {
    upstreamCalled = true;
    return new Response(JSON.stringify({ status: "processing" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const routeConfig: SecureProxyUserRouteConfigDto = {
    routeId: "route-secure-task-token",
    provider: "openai",
    baseUrl: "https://provider.example/v1",
    apiKey: "sk-secure-task-token",
    format: "openai",
    authMethod: "header",
    headerName: "Authorization",
    compatibilityMode: "standard",
  };
  const authDataService = {
    async resolveSecureProxyUserRouteConfig() {
      routeResolved = true;
      return routeConfig;
    },
  } as unknown as LocalUserRouteAuthDataService;
  const runtimeConfig: LocalUserRouteRuntimeConfig & {
    allowInsecureLocalTaskSigningFallback: false;
  } = {
    databaseConfigReady: true,
    blockers: [],
    allowInsecureLocalTaskSigningFallback: false,
  };
  const service = new LocalUserRouteProxyService(authDataService, runtimeConfig);
  const forgedLocalTaskId = signWithPublicFallbackSecret({
    v: 1,
    userId: "user-secure-task-token",
    routeId: routeConfig.routeId,
    taskId: "provider-task-1",
    mode: "image",
    requestId: "req-secure-task-token",
    attemptId: "attempt-secure-task-token",
  });

  await assert.rejects(
    () => service.invoke(
      "user-secure-task-token",
      "user@example.com",
      { authorization: "Bearer kk-access-token" },
      {
        mode: "task_status",
        localTaskId: forgedLocalTaskId,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof LocalUserRouteProxyError);
      assert.equal(error.code, "TASK_SIGNING_SECRET_REQUIRED");
      assert.equal(error.statusCode, 500);
      return true;
    },
  );

  assert.equal(routeResolved, false);
  assert.equal(upstreamCalled, false);
});
