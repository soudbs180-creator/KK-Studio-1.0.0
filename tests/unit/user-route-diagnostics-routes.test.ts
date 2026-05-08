import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import {
  AUTHENTICATED_USER_EMAIL_HEADER,
  AUTHENTICATED_USER_ID_HEADER,
} from "../../packages/shared/src/index.ts";
import { AuthDataService } from "../../apps/api/src/modules/auth/application/auth-data-service.ts";
import { UserRouteDiagnosticsService } from "../../apps/api/src/modules/auth/application/user-route-diagnostics-service.ts";
import { InMemoryAuthDataRepository } from "../../apps/api/src/modules/auth/infrastructure/in-memory-auth-data-repository.ts";
import {
  handleCheckUserRouteConnectivity,
  handleSyncUserRoutePricing,
} from "../../apps/api/src/modules/auth/presentation/http-user-route-diagnostics-routes.ts";

describe("user route diagnostics routes", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("checks connectivity with the persisted provider secret", async () => {
    const repository = new InMemoryAuthDataRepository();
    const authDataService = new AuthDataService(repository);
    const diagnosticsService = new UserRouteDiagnosticsService(authDataService);
    const headers = {
      "x-request-id": "req-connectivity-check",
      [AUTHENTICATED_USER_ID_HEADER]: "user-diagnostics-1",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-diagnostics-1@example.com",
    };

    await authDataService.replaceKeyManagerCloudState(
      "user-diagnostics-1",
      "user-diagnostics-1@example.com",
      {
        version: 2,
        slots: [],
        providers: [
          {
            id: "provider-1",
            name: "Proxy Provider",
            baseUrl: "https://provider.example.com/v1",
            apiKey: "provider-secret",
            format: "openai",
            models: [],
            isActive: true,
          },
        ],
      },
      "req-seed-connectivity",
    );

    let receivedAuthHeader = "";
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      receivedAuthHeader = headers.get("authorization") || "";

      return new Response(JSON.stringify({
        data: [
          { id: "gpt-4.1" },
          { id: "gpt-4.1-mini" },
        ],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    };

    const result = await handleCheckUserRouteConnectivity(
      diagnosticsService,
      "provider-1",
      headers,
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(receivedAuthHeader, "Bearer provider-secret");
    assert.equal(result.body.data.routeId, "provider-1");
    assert.equal(result.body.data.ok, true);
    assert.deepEqual(result.body.data.models, ["gpt-4.1", "gpt-4.1-mini"]);
  });

  test("normalizes successful connectivity checks when a local route returns a top-level model array", async () => {
    const repository = new InMemoryAuthDataRepository();
    const authDataService = new AuthDataService(repository);
    const diagnosticsService = new UserRouteDiagnosticsService(authDataService);
    const headers = {
      "x-request-id": "req-connectivity-array-models",
      [AUTHENTICATED_USER_ID_HEADER]: "user-diagnostics-array",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-diagnostics-array@example.com",
    };

    await authDataService.replaceKeyManagerCloudState(
      "user-diagnostics-array",
      "user-diagnostics-array@example.com",
      {
        version: 2,
        slots: [],
        providers: [
          {
            id: "provider-array",
            name: "Local Array Provider",
            baseUrl: "http://127.0.0.1:1234/v1",
            apiKey: "local-secret",
            format: "openai",
            models: [],
            isActive: true,
          },
        ],
      },
      "req-seed-connectivity-array-models",
    );

    globalThis.fetch = async () => new Response(JSON.stringify([
      { id: "qwen3-32b" },
      { name: "deepseek-r1" },
      "glm-4.5-air",
    ]), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

    const result = await handleCheckUserRouteConnectivity(
      diagnosticsService,
      "provider-array",
      headers,
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(result.body.data.ok, true);
    assert.deepEqual(result.body.data.models, ["qwen3-32b", "deepseek-r1", "glm-4.5-air"]);
  });

  test("checks GPT Best Gemini diagnostics with the same bearer header auth as the local proxy", async () => {
    const repository = new InMemoryAuthDataRepository();
    const authDataService = new AuthDataService(repository);
    const diagnosticsService = new UserRouteDiagnosticsService(authDataService);
    const headers = {
      "x-request-id": "req-connectivity-gpt-best-gemini",
      [AUTHENTICATED_USER_ID_HEADER]: "user-diagnostics-gpt-best",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-diagnostics-gpt-best@example.com",
    };

    await authDataService.replaceKeyManagerCloudState(
      "user-diagnostics-gpt-best",
      "user-diagnostics-gpt-best@example.com",
      {
        version: 2,
        slots: [],
        providers: [
          {
            id: "provider-gpt-best-gemini",
            name: "GPT Best Gemini",
            baseUrl: "https://gpt-best.example",
            apiKey: "gb-token",
            format: "gemini",
            authMethod: "query",
            models: [],
            isActive: true,
          },
        ],
      },
      "req-seed-connectivity-gpt-best-gemini",
    );

    let requestedUrl = "";
    let receivedAuthHeader = "";
    let receivedGoogleHeader: string | null = "";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      const requestHeaders = new Headers(init?.headers);
      receivedAuthHeader = requestHeaders.get("authorization") || "";
      receivedGoogleHeader = requestHeaders.get("x-goog-api-key");

      return new Response(JSON.stringify({
        data: [
          { id: "gemini-2.5-pro" },
        ],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    };

    const result = await handleCheckUserRouteConnectivity(
      diagnosticsService,
      "provider-gpt-best-gemini",
      headers,
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.doesNotMatch(requestedUrl, /[?&]key=/);
    assert.equal(receivedAuthHeader, "Bearer gb-token");
    assert.equal(receivedGoogleHeader, null);
    assert.equal(result.body.data.ok, true);
    assert.deepEqual(result.body.data.models, ["gemini-2.5-pro"]);
  });

  test("keeps 12AI auto-format diagnostics on the documented OpenAI action probe", async () => {
    const repository = new InMemoryAuthDataRepository();
    const authDataService = new AuthDataService(repository);
    const diagnosticsService = new UserRouteDiagnosticsService(authDataService);
    const headers = {
      "x-request-id": "req-connectivity-12ai-auto",
      [AUTHENTICATED_USER_ID_HEADER]: "user-diagnostics-12ai-auto",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-diagnostics-12ai-auto@example.com",
    };

    await authDataService.replaceKeyManagerCloudState(
      "user-diagnostics-12ai-auto",
      "user-diagnostics-12ai-auto@example.com",
      {
        version: 2,
        slots: [],
        providers: [
          {
            id: "provider-12ai-auto",
            name: "12AI",
            baseUrl: "https://api.12ai.org",
            apiKey: "twelve-token",
            format: "auto",
            authMethod: undefined,
            models: [],
            isActive: true,
          },
        ],
      },
      "req-seed-connectivity-12ai-auto",
    );

    let requestedUrl = "";
    let requestMethod = "";
    let requestBody = "";
    let receivedAuthHeader = "";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestMethod = String(init?.method || "");
      requestBody = String(init?.body || "");
      const requestHeaders = new Headers(init?.headers);
      receivedAuthHeader = requestHeaders.get("authorization") || "";

      return new Response(JSON.stringify({
        id: "chatcmpl-connectivity",
        choices: [],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    };

    const result = await handleCheckUserRouteConnectivity(
      diagnosticsService,
      "provider-12ai-auto",
      headers,
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(requestMethod, "POST");
    assert.match(requestedUrl, /\/v1\/chat\/completions$/);
    assert.equal(receivedAuthHeader, "Bearer twelve-token");
    assert.match(requestBody, /"model":"gpt-5\.1"/);
    assert.equal(result.body.data.resolvedFormat, "openai");
    assert.equal(result.body.data.models.includes("gpt-5.1"), true);
    assert.equal(result.body.data.models.includes("gemini-2.5-flash"), true);
  });

  test("syncs pricing with the persisted provider secret", async () => {
    const repository = new InMemoryAuthDataRepository();
    const authDataService = new AuthDataService(repository);
    const diagnosticsService = new UserRouteDiagnosticsService(authDataService);
    const headers = {
      "x-request-id": "req-pricing-sync",
      [AUTHENTICATED_USER_ID_HEADER]: "user-diagnostics-2",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-diagnostics-2@example.com",
    };

    await authDataService.replaceKeyManagerCloudState(
      "user-diagnostics-2",
      "user-diagnostics-2@example.com",
      {
        version: 2,
        slots: [],
        providers: [
          {
            id: "provider-2",
            name: "Pricing Provider",
            baseUrl: "https://pricing.example.com/v1",
            apiKey: "pricing-secret",
            format: "openai",
            models: [],
            isActive: true,
          },
        ],
      },
      "req-seed-pricing",
    );

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(input);
      const headers = new Headers(init?.headers);

      if (requestUrl.includes("/pricing")) {
        assert.equal(headers.get("authorization"), "Bearer pricing-secret");

        return new Response(JSON.stringify({
          data: [
            {
              model: "gpt-4.1",
              model_name: "GPT-4.1",
              model_price: 2,
              completion_ratio: 1.5,
            },
          ],
        }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      return new Response("not found", { status: 404 });
    };

    const result = await handleSyncUserRoutePricing(
      diagnosticsService,
      "provider-2",
      headers,
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(result.body.data.routeId, "provider-2");
    assert.equal(result.body.data.ok, true);
    assert.equal(result.body.data.count, 1);
    assert.equal(result.body.data.pricingData[0]?.model, "gpt-4.1");
  });

  test("syncs GPT Best Gemini pricing with the same bearer header auth as the local proxy", async () => {
    const repository = new InMemoryAuthDataRepository();
    const authDataService = new AuthDataService(repository);
    const diagnosticsService = new UserRouteDiagnosticsService(authDataService);
    const headers = {
      "x-request-id": "req-pricing-gpt-best-gemini",
      [AUTHENTICATED_USER_ID_HEADER]: "user-pricing-gpt-best",
      [AUTHENTICATED_USER_EMAIL_HEADER]: "user-pricing-gpt-best@example.com",
    };

    await authDataService.replaceKeyManagerCloudState(
      "user-pricing-gpt-best",
      "user-pricing-gpt-best@example.com",
      {
        version: 2,
        slots: [],
        providers: [
          {
            id: "provider-pricing-gpt-best-gemini",
            name: "GPT Best Gemini Pricing",
            baseUrl: "https://gpt-best.example",
            apiKey: "gb-pricing-token",
            format: "gemini",
            authMethod: "query",
            models: [],
            isActive: true,
          },
        ],
      },
      "req-seed-pricing-gpt-best-gemini",
    );

    let requestedUrl = "";
    let receivedAuthHeader = "";
    let receivedGoogleHeader: string | null = "";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      const requestHeaders = new Headers(init?.headers);
      receivedAuthHeader = requestHeaders.get("authorization") || "";
      receivedGoogleHeader = requestHeaders.get("x-goog-api-key");

      return new Response(JSON.stringify({
        data: [
          {
            model: "gemini-2.5-pro",
            model_name: "Gemini 2.5 Pro",
            model_price: 3,
            completion_ratio: 2,
          },
        ],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    };

    const result = await handleSyncUserRoutePricing(
      diagnosticsService,
      "provider-pricing-gpt-best-gemini",
      headers,
      {
        endpointUrl: "https://gpt-best.example/v1/pricing",
      },
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    if (!result.body.success) {
      return;
    }

    assert.equal(requestedUrl, "https://gpt-best.example/v1/pricing");
    assert.doesNotMatch(requestedUrl, /[?&]key=/);
    assert.equal(receivedAuthHeader, "Bearer gb-pricing-token");
    assert.equal(receivedGoogleHeader, null);
    assert.equal(result.body.data.ok, true);
    assert.equal(result.body.data.count, 1);
    assert.equal(result.body.data.pricingData[0]?.model, "gemini-2.5-pro");
  });
});
