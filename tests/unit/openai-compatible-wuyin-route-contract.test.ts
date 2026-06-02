import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  extractWuyinDirectEndpointPath,
  extractWuyinStatusCode,
  extractWuyinTaskId,
  mapWuyinStatus,
  normalizeWuyinAspectRatio,
  normalizeWuyinBaseUrl,
  normalizeWuyinImageSize,
  normalizeWuyinReferenceImage,
  resolveWuyinRequestRoute,
} from "../../apps/web/src/services/llm/openAICompatibleWuyinRoute.ts";

const ROOT_DIR = process.cwd();



describe("OpenAI-compatible Wuyin route helpers", () => {
  test("normalizes Wuyin base URLs and direct async endpoint paths", () => {
    assert.equal(normalizeWuyinBaseUrl(""), "https://api.wuyinkeji.com");
    assert.equal(normalizeWuyinBaseUrl("api.wuyinkeji.com/doc/123"), "https://api.wuyinkeji.com");
    assert.equal(
      normalizeWuyinBaseUrl("https://proxy.example.com/root/api/async/image_nanoBanana2"),
      "https://proxy.example.com/root",
    );
    assert.equal(extractWuyinDirectEndpointPath("api.wuyinkeji.com/api/async/image_sora"), "/api/async/image_sora");
  });

  test("resolves direct, pricing-snapshot, and alias Wuyin image routes", () => {
    assert.deepEqual(
      resolveWuyinRequestRoute({
        baseUrl: "https://api.wuyinkeji.com/api/async/image_sora",
        modelId: "ignored-model",
      }),
      {
        endpointPath: "/api/async/ignored-model",
        endpointModelId: "ignored-model",
      },
    );

    assert.deepEqual(
      resolveWuyinRequestRoute({
        baseUrl: "https://api.wuyinkeji.com/doc/777",
        modelId: "Gemini 3.1 Flash Image Preview",
        provider: {
          pricingSnapshot: {
            fetchedAt: 1,
            rows: [
              {
                model: "Gemini 3.1 Flash Image Preview",
                endpointPath: "/api/async/image_nanoBanana2",
              },
            ],
          },
        },
      }),
      {
        endpointPath: "/api/async/image_nanoBanana2",
        endpointModelId: "image_nanoBanana2",
        endpointUrl: undefined,
      },
    );

    assert.deepEqual(
      resolveWuyinRequestRoute({
        baseUrl: "",
        modelId: "nano-banana-pro",
      }),
      {
        endpointPath: "/api/async/image_nanoBanana_pro",
        endpointModelId: "image_nanoBanana_pro",
      },
    );

    assert.deepEqual(
      resolveWuyinRequestRoute({
        baseUrl: "https://api.wuyinkeji.com",
        modelId: "GPT-Image-2",
      }),
      {
        endpointPath: "/api/async/image_gpt",
        endpointModelId: "image_gpt",
      },
    );

    assert.deepEqual(
      resolveWuyinRequestRoute({
        baseUrl: "https://api.wuyinkeji.com",
        modelId: "image_wan2.6",
      }),
      {
        endpointPath: "/api/async/image_wan2.6",
        endpointModelId: "image_wan2.6",
      },
    );
  });

  test("normalizes Wuyin size, aspect ratio, reference images, and task status", () => {
    assert.equal(normalizeWuyinImageSize("hd"), "4K");
    assert.equal(normalizeWuyinImageSize("2k"), "2K");
    assert.equal(normalizeWuyinImageSize(undefined), "1K");
    assert.equal(normalizeWuyinAspectRatio("16:9"), "16:9");
    assert.equal(normalizeWuyinAspectRatio("99:1"), "auto");

    assert.deepEqual(
      normalizeWuyinReferenceImage({ data: "ignored", mimeType: "image/png", url: "https://cdn.example.com/ref.png" }, 0),
      { value: "https://cdn.example.com/ref.png", kind: "url" },
    );
    assert.deepEqual(
      normalizeWuyinReferenceImage({ data: "data:image/jpeg;base64, aGVs bG8= ", mimeType: "image/jpeg" }, 1),
      { value: "aGVsbG8=", kind: "base64" },
    );
    assert.throws(
      () => normalizeWuyinReferenceImage({ data: "blob:http://local/ref", mimeType: "image/png" }, 2),
      /本地预览地址/,
    );

    assert.equal(extractWuyinTaskId({ data: { id: " task-1 " } }), "task-1");
    assert.equal(extractWuyinStatusCode({ data: { status: "2" } }), 2);
    assert.equal(mapWuyinStatus(2), "success");
    assert.equal(mapWuyinStatus(3), "failed");
    assert.equal(mapWuyinStatus(1), "processing");
    assert.equal(mapWuyinStatus(undefined), "pending");
  });

  test("adapter delegates Wuyin route ownership to the helper module", () => {
    const adapterSource = readSource("apps/web/src/services/llm/OpenAICompatibleAdapter.ts");
    const helperSource = readSource("apps/web/src/services/llm/openAICompatibleWuyinRoute.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatibleWuyinRoute/);
    assert.doesNotMatch(adapterSource, /private normalizeWuyinBaseUrl/);
    assert.doesNotMatch(adapterSource, /private extractWuyinDirectEndpointPath/);
    assert.doesNotMatch(adapterSource, /private resolveWuyinImageEndpoint/);
    assert.doesNotMatch(adapterSource, /private normalizeWuyinReferenceImage/);
    assert.match(adapterSource, /forwardUserRouteGenericRequest/);
    assert.doesNotMatch(adapterSource, /detailUrl\.searchParams\.set\('key'/);
    assert.doesNotMatch(adapterSource, /target\.url.*key=/);
    assert.doesNotMatch(helperSource, /fetchWithTimeout|executeImageRequest|keyManager/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-wuyin-route-contract\.test\.ts/);
  });
});
