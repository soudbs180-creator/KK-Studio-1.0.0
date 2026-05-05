import assert from "node:assert/strict";
import { test } from "node:test";

import type { SecureProxyUserRouteConfigDto } from "../../../../../../packages/contracts/src/index.ts";
import { CreditAccountService, InMemoryCreditAccountRepository } from "../../billing/index.ts";
import { InMemoryCreditProviderRepository } from "../../model-catalog/index.ts";
import { LocalSystemProxyError, LocalSystemProxyService } from "./local-system-proxy-service.ts";

test("local system proxy fails closed before signed task operations when task signing secret is missing", async () => {
  const creditProviderRepository = new InMemoryCreditProviderRepository();
  const creditAccountService = new CreditAccountService(new InMemoryCreditAccountRepository(20));

  await creditProviderRepository.saveAdminProvider("provider-vps", {
    providerName: "VPS Provider",
    baseUrl: "https://provider.example/v1",
    apiKeys: ["sk-vps-provider"],
    models: [
      {
        modelId: "gpt-image-1",
        displayName: "GPT Image",
        endpointType: "openai",
        creditCost: 4,
        advancedEnabled: false,
        mixWithSameModel: false,
        qualityPricing: {
          "0.5K": { enabled: true, creditCost: 2 },
          "1K": { enabled: true, creditCost: 4 },
          "2K": { enabled: true, creditCost: 8 },
          "4K": { enabled: true, creditCost: 16 },
        },
        priority: 10,
        weight: 1,
        isActive: true,
        color: "#111111",
        textColor: "white",
      },
    ],
  });

  let invoked = false;
  const service = new LocalSystemProxyService({
    creditProviderRepository,
    creditAccountService,
    directRouteInvoker: {
      async invokeResolvedRoute() {
        invoked = true;
        return {
          success: true,
          taskId: "provider-task-1",
          status: "processing",
        } as never;
      },
    },
  });

  await assert.rejects(
    () => service.invoke("user-vps-1", {
      mode: "image",
      modelId: "gpt-image-1@system",
      prompt: "draw a mountain",
      imageSize: "1K",
      requestId: "req-system-image-missing-secret",
      attemptId: "attempt-system-image-missing-secret",
    }),
    (error: unknown) => {
      assert.ok(error instanceof LocalSystemProxyError);
      assert.equal(error.code, "TASK_SIGNING_SECRET_REQUIRED");
      assert.equal(error.statusCode, 500);
      return true;
    },
  );

  assert.equal(invoked, false);
  const balanceResult = await creditAccountService.getBalance("user-vps-1", "balance-check");
  assert.equal(balanceResult.success, true);
  if (!balanceResult.success) {
    throw new Error("Expected the user balance lookup to succeed.");
  }
  assert.equal(balanceResult.data.balance, 20);
});

test("local system proxy uses VPS provider routes and refunds credits when the upstream request fails", async () => {
  const creditProviderRepository = new InMemoryCreditProviderRepository();
  const creditAccountService = new CreditAccountService(new InMemoryCreditAccountRepository(20));

  await creditProviderRepository.saveAdminProvider("provider-vps", {
    providerName: "VPS Provider",
    baseUrl: "https://provider.example/v1",
    apiKeys: ["sk-vps-provider"],
    models: [
      {
        modelId: "gpt-image-1",
        displayName: "GPT Image",
        endpointType: "openai",
        creditCost: 4,
        advancedEnabled: false,
        mixWithSameModel: false,
        qualityPricing: {
          "0.5K": { enabled: true, creditCost: 2 },
          "1K": { enabled: true, creditCost: 4 },
          "2K": { enabled: true, creditCost: 8 },
          "4K": { enabled: true, creditCost: 16 },
        },
        priority: 10,
        weight: 1,
        isActive: true,
        color: "#111111",
        textColor: "white",
      },
    ],
  });

  const routedRequests: Array<{
    routeConfig: SecureProxyUserRouteConfigDto;
    input: Record<string, unknown>;
    options: Record<string, unknown>;
  }> = [];

  const service = new LocalSystemProxyService({
    creditProviderRepository,
    creditAccountService,
    directRouteInvoker: {
      async invokeResolvedRoute(routeConfig, input, options = {}) {
        routedRequests.push({
          routeConfig,
          input: input as unknown as Record<string, unknown>,
          options: options as unknown as Record<string, unknown>,
        });
        throw new Error("upstream image failed");
      },
    },
    taskSigningSecret: "system-proxy-test-secret",
  });

  await assert.rejects(
    () => service.invoke("user-vps-1", {
      mode: "image",
      modelId: "gpt-image-1@system",
      prompt: "draw a mountain",
      imageSize: "1K",
      requestId: "req-system-image-1",
      attemptId: "attempt-system-image-1",
    }),
    (error: unknown) => {
      assert.ok(error instanceof LocalSystemProxyError);
      assert.equal(error.code, "LOCAL_SYSTEM_PROXY_UPSTREAM_ERROR");
      assert.equal(error.statusCode, 502);
      assert.match(error.message, /upstream image failed/i);
      return true;
    },
  );

  assert.equal(routedRequests.length, 1);
  assert.equal(routedRequests[0]?.routeConfig.baseUrl, "https://provider.example/v1");
  assert.equal(routedRequests[0]?.routeConfig.apiKey, "sk-vps-provider");
  assert.equal(routedRequests[0]?.input.modelId, "gpt-image-1");
  assert.equal(routedRequests[0]?.options.imageSurface, "provider-images");

  const balanceResult = await creditAccountService.getBalance("user-vps-1", "balance-check");
  assert.equal(balanceResult.success, true);
  if (!balanceResult.success) {
    throw new Error("Expected the user balance lookup to succeed.");
  }
  assert.equal(balanceResult.data.balance, 20);

  const transactionResult = await creditAccountService.listTransactions("user-vps-1", undefined, "tx-check");
  assert.equal(transactionResult.success, true);
  if (!transactionResult.success) {
    throw new Error("Expected the user transaction lookup to succeed.");
  }
  assert.equal(transactionResult.data.items.length, 2);
  assert.equal(transactionResult.data.items[0]?.transactionType, "refund");
  assert.equal(transactionResult.data.items[1]?.transactionType, "consumption");
  assert.equal(transactionResult.data.items[1]?.status, "refunded");
});
