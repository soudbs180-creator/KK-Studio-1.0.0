import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { detectRequestProfileEvidence } from "../../apps/web/src/services/api/requestProfileRegistry.ts";
import { resolveProviderRuntime } from "../../apps/web/src/services/api/providerStrategy.ts";
import { resolveChatSurface } from "../../apps/web/src/services/api/providerSurfaceRouter.ts";
import { resolveProviderImageRoute } from "../../apps/web/src/services/api/providerRequestRegistry.ts";

describe("third-party request registry entrypoints", () => {
  test("marks documentation URLs as profile evidence but not usable API base URLs", () => {
    assert.deepEqual(detectRequestProfileEvidence({
      baseUrl: "https://gpt-best.apifox.cn/llms.txt",
    }), {
      profileId: "gpt-best",
      sourceType: "docs-url",
      isDocumentationUrl: true,
      canUseAsApiBaseUrl: false,
    });

    assert.deepEqual(detectRequestProfileEvidence({
      baseUrl: "https://doc.12ai.org/docs/api",
    }), {
      profileId: "12ai",
      sourceType: "docs-url",
      isDocumentationUrl: true,
      canUseAsApiBaseUrl: false,
    });

    assert.deepEqual(detectRequestProfileEvidence({
      baseUrl: "https://api.wuyinkeji.com/type/all",
    }), {
      profileId: "wuyinkeji",
      sourceType: "docs-url",
      isDocumentationUrl: true,
      canUseAsApiBaseUrl: false,
    });

    assert.deepEqual(detectRequestProfileEvidence({
      baseUrl: "https://docs.apimart.ai/cn",
    }), {
      profileId: "apimart",
      sourceType: "docs-url",
      isDocumentationUrl: true,
      canUseAsApiBaseUrl: false,
    });
  });

  test("recognizes APIMart API hosts as OpenAI-compatible runtime-supplied API bases", () => {
    assert.deepEqual(detectRequestProfileEvidence({
      baseUrl: "https://api.apimart.ai/v1",
    }), {
      profileId: "apimart",
      sourceType: "api-base",
      isDocumentationUrl: false,
      canUseAsApiBaseUrl: true,
    });

    const runtime = resolveProviderRuntime({
      provider: "APIMart",
      baseUrl: "https://api.apimart.ai/v1",
      format: "openai",
    });

    assert.equal(runtime.requestProfileId, "apimart");
    assert.equal(runtime.protocolFamily, "openai-compatible");
    assert.equal(runtime.authMethod, "header");
    assert.equal(runtime.headerName, "Authorization");
    assert.equal(runtime.authorizationValueFormat, "bearer");
  });

  test("keeps APIMart chat and image requests on OpenAI-compatible surfaces", () => {
    const runtime = resolveProviderRuntime({
      provider: "APIMart",
      baseUrl: "https://api.apimart.ai/v1",
      format: "openai",
      compatibilityMode: "chat",
    });

    assert.equal(
      resolveChatSurface({ runtime, modelId: "gpt-4o-mini" }),
      "openai-chat",
    );

    const imageRoute = resolveProviderImageRoute({
      runtime,
      modelId: "gpt-image-1",
      compatibilityMode: runtime.compatibilityMode,
    });

    assert.equal(imageRoute.surface, "provider-images");
    assert.equal(imageRoute.routeFamily, "openai-compatible");
    assert.equal(imageRoute.reason, "apimart-openai-compatible-provider-images");
  });
});
