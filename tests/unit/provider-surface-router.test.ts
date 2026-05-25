import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveProviderRuntime } from "../../apps/web/src/services/api/providerStrategy.ts";
import { resolveChatSurface, resolveImageSurface } from "../../apps/web/src/services/api/providerSurfaceRouter.ts";

describe("provider surface router", () => {
  test("routes New Suxi image models to provider images even when chat compatibility is stored", () => {
    const runtime = resolveProviderRuntime({
      provider: "New Suxi AI",
      baseUrl: "https://new.suxi.ai",
      compatibilityMode: "chat",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "gemini-2.5-flash-image",
        compatibilityMode: "chat",
      }),
      "provider-images",
    );
  });

  test("keeps generic chat-compatible providers on chat-image by default", () => {
    const runtime = resolveProviderRuntime({
      provider: "Custom",
      baseUrl: "https://example.com/v1",
      compatibilityMode: "chat",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "gemini-2.5-flash-image",
        compatibilityMode: "chat",
      }),
      "chat-image",
    );
  });

  test("routes Flow2API image models to chat-image so OpenAI-compatible image calls hit chat/completions", () => {
    const runtime = resolveProviderRuntime({
      provider: "Flow2API",
      baseUrl: "http://127.0.0.1:8000",
      format: "openai",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "gemini-3.1-flash-image-landscape",
        compatibilityMode: runtime.compatibilityMode,
      }),
      "chat-image",
    );
  });

  test("keeps 12AI image models on Gemini native by default", () => {
    const runtime = resolveProviderRuntime({
      provider: "12AI",
      baseUrl: "https://cdn.12ai.org",
      format: "gemini",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "gemini-3.1-flash-image-preview",
        compatibilityMode: "standard",
        isAsyncImageModel: () => true,
        preferAsync: false,
      }),
      "gemini-native-image",
    );
  });

  test("routes documented 12AI async image models to the async surface only when explicitly preferred", () => {
    const runtime = resolveProviderRuntime({
      provider: "12AI",
      baseUrl: "https://cdn.12ai.org",
      format: "gemini",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "gemini-3.1-flash-image-preview",
        compatibilityMode: "standard",
        isAsyncImageModel: () => true,
        preferAsync: true,
      }),
      "async-image",
    );
  });

  test("routes GPT Best image models to Gemini native when endpoint types only expose generateContent", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gpt-best.example.com/v1",
      format: "openai",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "nano-banana-2",
        compatibilityMode: "standard",
        endpointTypes: ["v1beta/models/gemini-3-pro-image-preview:generateContent"],
      }),
      "gemini-native-image",
    );
  });

  test("prefers sync provider images when a model exposes both sync and async image surfaces", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gateway.example.com/v1",
      format: "openai",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "nano-banana-2",
        compatibilityMode: "standard",
        endpointTypes: ["image-generation", "image-generation-async", "gemini"],
      }),
      "provider-images",
    );
  });

  test("keeps gemini-native routing when image models expose gemini plus chat only", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gateway.example.com/v1",
      format: "openai",
    });

    assert.equal(
      resolveImageSurface({
        runtime,
        modelId: "nano-banana-2",
        compatibilityMode: "chat",
        endpointTypes: ["gemini", "openai:/v1/chat/completions"],
      }),
      "gemini-native-image",
    );
  });

  test("routes response-only models to the responses surface", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gpt-best.example.com/v1",
      format: "openai",
    });

    assert.equal(
      resolveChatSurface({
        runtime,
        modelId: "o3-pro",
      }),
      "openai-responses",
    );
  });

  test("resolves native chat surfaces for Gemini and Claude providers", () => {
    const geminiRuntime = resolveProviderRuntime({
      provider: "12AI",
      baseUrl: "https://cdn.12ai.org",
      format: "gemini",
    });
    const claudeRuntime = resolveProviderRuntime({
      provider: "New Suxi AI",
      baseUrl: "https://new.suxi.ai",
      format: "claude",
    });

    assert.equal(
      resolveChatSurface({
        runtime: geminiRuntime,
        modelId: "gemini-2.5-flash",
      }),
      "gemini-native-chat",
    );
    assert.equal(
      resolveChatSurface({
        runtime: claudeRuntime,
        modelId: "claude-3-5-sonnet-latest",
      }),
      "claude-messages",
    );
  });
});
