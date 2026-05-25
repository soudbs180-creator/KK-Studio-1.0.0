import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildChannelSurfaceView } from "../../apps/web/src/services/api/providerChannelSurfaceView.ts";
import { resolveProviderRuntime } from "../../apps/web/src/services/api/providerStrategy.ts";

describe("provider channel surface view", () => {
  test("builds documented discovery and async image visibility for 12AI channels", () => {
    const runtime = resolveProviderRuntime({
      provider: "12AI",
      baseUrl: "https://cdn.12ai.org",
      format: "gemini",
    });

    const surfaces = buildChannelSurfaceView({
      runtime,
      documentedModels: ["gemini-3.1-flash-image-preview"],
    });

    assert.equal(surfaces.modelDiscovery, "documented-static-models");
    assert.equal(surfaces.preferredChat, "gemini-native-chat");
    assert.ok(surfaces.image.includes("async-image"));
    assert.ok(surfaces.available.includes("documented-static-models"));
  });

  test("keeps Suxi image surfaces independent from chat compatibility", () => {
    const runtime = resolveProviderRuntime({
      provider: "New Suxi AI",
      baseUrl: "https://new.suxi.ai",
      compatibilityMode: "chat",
    });

    const surfaces = buildChannelSurfaceView({ runtime });

    assert.equal(surfaces.preferredChat, "openai-chat");
    assert.equal(surfaces.preferredImage, "provider-images");
    assert.ok(!surfaces.image.includes("chat-image"));
    assert.ok(surfaces.chat.includes("openai-responses"));
  });

  test("keeps generic chat-first channels on chat-image", () => {
    const runtime = resolveProviderRuntime({
      provider: "Custom",
      baseUrl: "https://example.com/v1",
      compatibilityMode: "chat",
    });

    const surfaces = buildChannelSurfaceView({ runtime });

    assert.equal(surfaces.modelDiscovery, "openai-models");
    assert.ok(surfaces.image.includes("chat-image"));
    assert.equal(surfaces.preferredImage, "provider-images");
  });
});
