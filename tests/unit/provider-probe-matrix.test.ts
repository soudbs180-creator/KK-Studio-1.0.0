import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveProviderRuntime } from "../../src/services/api/providerStrategy.ts";
import { resolveProviderProbeMatrix } from "../../src/services/api/providerProbeMatrix.ts";

describe("provider probe matrix", () => {
  test("uses documented static model discovery for 12AI and keeps async image in available surfaces", () => {
    const runtime = resolveProviderRuntime({
      provider: "12AI",
      baseUrl: "https://cdn.12ai.org",
      format: "gemini",
      modelId: "gemini-3.1-flash-image-preview",
    });

    const matrix = resolveProviderProbeMatrix({
      runtime,
      modelId: "gemini-3.1-flash-image-preview",
      compatibilityMode: "standard",
      documentedModels: ["gemini-3.1-flash-image-preview"],
      isImageOnlyNativeModel: true,
      isAsyncImageModel: () => true,
    });

    assert.equal(matrix.modelDiscoverySurface, "documented-static-models");
    assert.equal(matrix.protocolProbeSurface, "documented-static-models");
    assert.equal(matrix.skipReason, "native-image-billing-risk");
    assert.ok(matrix.availableSurfaces.includes("async-image"));
  });

  test("uses model discovery as the probe surface for standard OpenAI-compatible channels", () => {
    const runtime = resolveProviderRuntime({
      provider: "Custom",
      baseUrl: "https://example.com/v1",
      format: "openai",
    });

    const matrix = resolveProviderProbeMatrix({
      runtime,
      modelId: "gpt-4o-mini",
      compatibilityMode: "standard",
    });

    assert.equal(matrix.modelDiscoverySurface, "openai-models");
    assert.equal(matrix.protocolProbeSurface, "openai-models");
    assert.equal(matrix.skipReason, "standard-mode-billing-risk");
    assert.ok(matrix.availableSurfaces.includes("openai-chat"));
  });

  test("keeps response-only models on the responses probe surface", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gpt-best.example.com/v1",
      format: "openai",
    });

    const matrix = resolveProviderProbeMatrix({
      runtime,
      modelId: "o3-pro",
      compatibilityMode: "chat",
    });

    assert.equal(matrix.protocolProbeSurface, "openai-responses");
    assert.equal(matrix.skipReason, null);
    assert.ok(matrix.availableSurfaces.includes("openai-responses"));
  });

  test("uses GPT Best model discovery before image or video probe surfaces", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gateway.example.com/v1",
      format: "openai",
    });

    const imageMatrix = resolveProviderProbeMatrix({
      runtime,
      modelId: "nano-banana-2",
      compatibilityMode: "standard",
    });
    const videoMatrix = resolveProviderProbeMatrix({
      runtime,
      modelId: "sora-2",
      compatibilityMode: "chat",
      isVideoModel: true,
    });

    assert.equal(imageMatrix.modelDiscoverySurface, "openai-models");
    assert.equal(imageMatrix.protocolProbeSurface, "openai-models");
    assert.equal(imageMatrix.skipReason, "standard-mode-billing-risk");
    assert.equal(videoMatrix.protocolProbeSurface, "openai-models");
    assert.equal(videoMatrix.skipReason, "video-billing-risk");
  });
});
