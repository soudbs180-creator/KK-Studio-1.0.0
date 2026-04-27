import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import type { SecureProxyUserRouteConfigDto } from "../../../../../../packages/contracts/src/index.ts";
import { LocalUserRouteProxyService } from "./local-user-route-proxy-service.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("local user-route proxy always calls the direct provider route with VPS runtime config", async () => {
  const requests: Array<{
    url: string;
    method: string;
    authorization?: string;
  }> = [];

  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: String(init?.method || "GET"),
      authorization: typeof init?.headers === "object" && init?.headers
        ? String((init.headers as Record<string, string>).Authorization || (init.headers as Record<string, string>).authorization || "")
        : "",
    });

    return new Response(JSON.stringify({
      output_text: "direct-route-ok",
      choices: [
        {
          message: {
            content: "direct-route-ok",
          },
        },
      ],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 4,
        total_tokens: 7,
      },
    }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  };

  const routeConfig: SecureProxyUserRouteConfigDto = {
    routeId: "route-direct-openai",
    provider: "openai",
    baseUrl: "https://provider.example/v1",
    apiKey: "sk-test-direct",
    format: "openai",
    authMethod: "header",
    headerName: "Authorization",
    compatibilityMode: "standard",
  };

  const service = new LocalUserRouteProxyService({
    resolveSecureProxyUserRouteConfig: async () => routeConfig,
  } as any, {
    databaseConfigReady: true,
    userApiEncryptionSecret: "direct-route-secret",
  } as any);

  const result = await service.invoke(
    "user-direct-route",
    "user@example.com",
    {
      authorization: "Bearer kk-access-token",
    },
    {
      mode: "chat",
      routeId: routeConfig.routeId,
      modelId: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    },
  );

  assert.equal(result.success, true);
  assert.equal("content" in result ? result.content : undefined, "direct-route-ok");
  assert.equal(requests.length, 1);
  assert.match(requests[0]?.url || "", /provider\.example/);
  assert.equal(requests[0]?.method, "POST");
  assert.match(String(requests[0]?.authorization || ""), /^Bearer /);
});
