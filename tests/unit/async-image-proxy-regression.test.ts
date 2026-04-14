import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type {
  SecureProxyImageTransportDto,
  SecureProxyTaskStatus,
  SecureProxyUsageDto,
} from "../../packages/contracts/src/index.ts";

const ROOT_DIR = process.cwd();
const CONTRACT_USAGE_SAMPLE: SecureProxyUsageDto = {
  promptTokens: 12,
  completionTokens: 34,
  totalTokens: 46,
  cost: 0.78,
};
const CONTRACT_TASK_STATUS_SAMPLE: SecureProxyTaskStatus = "pending";
const CONTRACT_IMAGE_TRANSPORT_SAMPLE: SecureProxyImageTransportDto = {
  success: true,
  urls: ["https://example.com/generated.png"],
  usage: CONTRACT_USAGE_SAMPLE,
  taskId: "task-123",
  status: CONTRACT_TASK_STATUS_SAMPLE,
  requestId: "req-123",
  attemptId: "attempt-123",
};

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("async image transports expose task metadata through contracts, client proxy, and llm service", () => {
  const contractsIndexSource = readSource("packages/contracts/src/index.ts");
  const secureProxyClientSource = readSource("src/services/model/secureModelProxy.ts");
  const llmServiceSource = readSource("src/services/llm/LLMService.ts");

  assert.match(contractsIndexSource, /export \* from "\.\/dto\/generation\.ts";/);
  assert.deepEqual(CONTRACT_IMAGE_TRANSPORT_SAMPLE.urls, ["https://example.com/generated.png"]);
  assert.deepEqual(CONTRACT_IMAGE_TRANSPORT_SAMPLE.usage, CONTRACT_USAGE_SAMPLE);
  assert.equal(CONTRACT_IMAGE_TRANSPORT_SAMPLE.taskId, "task-123");
  assert.equal(CONTRACT_IMAGE_TRANSPORT_SAMPLE.status, "pending");
  assert.equal(CONTRACT_IMAGE_TRANSPORT_SAMPLE.requestId, "req-123");
  assert.equal(CONTRACT_IMAGE_TRANSPORT_SAMPLE.attemptId, "attempt-123");
  assert.match(secureProxyClientSource, /taskId\?: string;/);
  assert.match(secureProxyClientSource, /status\?: 'pending' \| 'success' \| 'failed';/);
  assert.match(
    secureProxyClientSource,
    /taskId: typeof data\.taskId === 'string' \? data\.taskId : undefined,/,
  );
  assert.match(
    secureProxyClientSource,
    /status: data\.status === 'success' \|\| data\.status === 'failed' \? data\.status : 'pending',/,
  );
  assert.match(
    llmServiceSource,
    /taskId: response\.taskId,\s*status: response\.status,/,
  );
  assert.match(
    llmServiceSource,
    /if \(response\.taskId\) \{\s*onTaskId\?\.\(response\.taskId\);\s*\}/,
  );
});

test("local and hosted proxies keep async-image as a first-class execution path instead of collapsing it into sync image routes", () => {
  const localProxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");
  const secureProxySource = readSource("supabase/functions/secure-model-proxy/index.ts");

  assert.match(localProxySource, /type LocalResolvedImageSurface = "chat-image" \| "provider-images" \| "gemini-native-image" \| "async-image";/);
  assert.match(localProxySource, /return "async-image";/);
  assert.match(localProxySource, /if \(effectiveMode === "image"\) \{/);
  assert.match(localProxySource, /taskId: imageResponse\.taskId/);
  assert.match(localProxySource, /mode: "image",/);
  assert.match(localProxySource, /private async invokeDirectImageTaskRoute\(/);
  assert.match(localProxySource, /\/v1\/images\/async\/generations\/\$\{encodeURIComponent\(upstreamTaskId\)\}/);

  assert.match(secureProxySource, /'image' \| 'system-image'/);
  assert.match(secureProxySource, /'user-video' \| 'user-image'/);
  assert.match(secureProxySource, /type CreditRouteSurface = 'provider-images' \| 'gemini-native-image' \| 'async-image';/);
  assert.match(secureProxySource, /function inferCreditRouteSurface\(endpoint: string \| null \| undefined\): CreditRouteSurface \{/);
  assert.match(secureProxySource, /const requestSurface = inferCreditRouteSurface\(creditModel\.endpoint_type\);/);
  assert.match(secureProxySource, /\/v1\/images\/async\/generations/);
  assert.match(secureProxySource, /kind: 'image',/);
  assert.match(secureProxySource, /kind: 'user-image',/);
});
