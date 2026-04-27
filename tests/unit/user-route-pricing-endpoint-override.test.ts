import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryAuthDataRepository } from '../../apps/api/src/modules/auth/infrastructure/in-memory-auth-data-repository.ts';
import { AuthDataService } from '../../apps/api/src/modules/auth/application/auth-data-service.ts';
import { UserRouteDiagnosticsService } from '../../apps/api/src/modules/auth/application/user-route-diagnostics-service.ts';
import { handleSyncUserRoutePricing } from '../../apps/api/src/modules/auth/presentation/http-user-route-diagnostics-routes.ts';
import { AUTHENTICATED_USER_EMAIL_HEADER, AUTHENTICATED_USER_ID_HEADER } from '../../packages/shared/src/index.ts';

test('pricing sync can use a caller-supplied endpoint override when the default candidate path is wrong', async () => {
  const repository = new InMemoryAuthDataRepository();
  const authDataService = new AuthDataService(repository);
  const diagnosticsService = new UserRouteDiagnosticsService(authDataService);
  const headers = {
    "x-request-id": "req-pricing-sync-override",
    [AUTHENTICATED_USER_ID_HEADER]: "user-diagnostics-override",
    [AUTHENTICATED_USER_EMAIL_HEADER]: "user-diagnostics-override@example.com",
  };

  await authDataService.replaceKeyManagerCloudState(
    "user-diagnostics-override",
    "user-diagnostics-override@example.com",
    {
      version: 2,
      slots: [],
      providers: [
        {
          id: "provider-custom-endpoint",
          name: "Custom Endpoint Provider",
          baseUrl: "https://pricing.example.com/v1",
          apiKey: "pricing-secret",
          format: "openai",
          models: [],
          isActive: true,
        },
      ],
    },
    "req-seed-pricing-override",
  );

  const requestedUrls: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = String(input);
    requestedUrls.push(requestUrl);
    const requestHeaders = new Headers(init?.headers);

    assert.equal(requestHeaders.get("authorization"), "Bearer pricing-secret");

    if (requestUrl === "https://pricing.example.com/custom-price-endpoint") {
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
    "provider-custom-endpoint",
    headers,
    {
      endpointUrl: "https://pricing.example.com/custom-price-endpoint",
    },
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  if (!result.body.success) {
    return;
  }

  assert.deepEqual(requestedUrls, ["https://pricing.example.com/custom-price-endpoint"]);
  assert.equal(result.body.data.ok, true);
  assert.equal(result.body.data.endpointUrl, "https://pricing.example.com/custom-price-endpoint");
  assert.equal(result.body.data.count, 1);
});
