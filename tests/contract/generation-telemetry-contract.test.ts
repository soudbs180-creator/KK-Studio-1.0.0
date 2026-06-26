// tests/contract/generation-telemetry-contract.test.ts
// 中文注释：GenerationTelemetry 遥测度量标准模型字段完整性验证

import assert from "node:assert/strict";
import { test } from "node:test";
import type { GenerationTelemetry } from "@kk/shared";

test("Generation Telemetry - 数据结构与契约完整性验证", () => {
  // 构造符合 GenerationTelemetry 契约的数据对象，确保没有字段错漏或拼写问题
  const mockTelemetry: GenerationTelemetry = {
    jobId: "job-12345",
    taskType: "ecommerce",
    model: {
      id: "flux-schnell",
      name: "Flux Schnell Pro",
      provider: "acedata",
      providerName: "AceData Proxy",
    },
    route: {
      sourceType: "api-user-local",
      executionSide: "local",
      keySlotId: "slot-user-key-0",
    },
    timing: {
      queuedAt: "2026-06-27T00:00:00.000Z",
      startedAt: "2026-06-27T00:00:00.050Z",
      firstByteAt: "2026-06-27T00:00:00.200Z",
      completedAt: "2026-06-27T00:00:04.200Z",
      queueDurationMs: 50,
      generationDurationMs: 4150,
      totalDurationMs: 4200,
    },
    usage: {
      promptTokens: 1200,
      completionTokens: 2500,
      totalTokens: 3700,
      apiDurationMs: 4150,
    },
    cost: {
      chargedCredits: 10,
      refundedCredits: 0,
      estimatedAmount: 0.05,
      chargedAmount: 0.05,
      ledgerId: "ledger_transaction_9823",
      billingTransactionId: "tx_pay_90831",
      balanceAfter: 480,
    },
    settings: {
      prompt: "E-commerce product mock context",
      negativePrompt: "low quality, text flaws",
      aspectRatio: "1:1",
      size: "1K",
      imageCount: 1,
    },
    result: {
      assetIds: ["asset-abc"],
      canvasNodeIds: ["node-xyz"],
      urls: ["https://api.kkstudio.com/v1/storage/asset-abc.png"],
    },
    error: undefined,
    retry: {
      previousJobIds: [],
      retryCount: 0,
    }
  };

  assert.equal(mockTelemetry.jobId, "job-12345");
  assert.equal(mockTelemetry.taskType, "ecommerce");
  assert.equal(mockTelemetry.model.provider, "acedata");
  assert.equal(mockTelemetry.route.executionSide, "local");
  assert.equal(mockTelemetry.cost?.chargedCredits, 10);
  assert.equal(mockTelemetry.result?.assetIds[0], "asset-abc");
});
