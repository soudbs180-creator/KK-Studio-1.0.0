import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { resolveProviderRuntime } from "../../src/services/api/providerStrategy.ts";
import { resolveOpenAICompatibleImageDispatch } from "../../src/services/llm/openAICompatibleImageDispatch.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

describe("OpenAI-compatible image dispatch plan", () => {
  test("keeps surface router output separate from endpoint execution methods", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const helperSource = readSource("src/services/llm/openAICompatibleImageDispatch.ts");

    assert.match(adapterSource, /resolveOpenAICompatibleImageDispatch\(\{/);
    assert.match(helperSource, /export function resolveOpenAICompatibleImageDispatch/);
    assert.doesNotMatch(helperSource, /generateImageStandard_|generateImageViaChat|generateImageGeminiNative|fetch\(/);
  });

  test("preserves post-surface route priority for provider image generation", () => {
    const gptBestRuntime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gpt-best.example.com/v1",
      format: "openai",
    });
    const suxiRuntime = resolveProviderRuntime({
      provider: "New Suxi AI",
      baseUrl: "https://new.suxi.ai",
      format: "openai",
      compatibilityMode: "chat",
    });
    const antigravityRuntime = resolveProviderRuntime({
      provider: "Antigravity",
      baseUrl: "https://antigravity.example.com/v1",
      format: "openai",
    });

    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: gptBestRuntime,
        imageSurface: "provider-images",
        isGeminiImage: true,
      }),
      { kind: "gpt-best-native" },
    );
    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: gptBestRuntime,
        imageSurface: "gemini-native-image",
        isGeminiImage: true,
      }),
      { kind: "gemini-native" },
    );
    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: suxiRuntime,
        imageSurface: "provider-images",
        isGeminiImage: true,
        useChatEndpoint: true,
      }),
      { kind: "suxi-openai-strict" },
    );
    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: antigravityRuntime,
        imageSurface: "provider-images",
        isGeminiImage: true,
        antigravityUsesChat: true,
      }),
      { kind: "antigravity-chat" },
    );
  });

  test("keeps chat-surface strictness and default billing-safe error branches explicit", () => {
    const genericRuntime = resolveProviderRuntime({
      provider: "Custom",
      baseUrl: "https://example.com/v1",
      format: "openai",
      compatibilityMode: "chat",
    });
    const openAIRuntime = resolveProviderRuntime({
      provider: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      format: "openai",
    });

    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: genericRuntime,
        imageSurface: "chat-image",
        isGeminiImage: true,
      }),
      { kind: "chat-strict" },
    );
    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: genericRuntime,
        imageSurface: "chat-image",
        isGeminiImage: true,
        legacyGeminiChatGateway: true,
      }),
      { kind: "chat" },
    );
    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: genericRuntime,
        imageSurface: "provider-images",
        isGeminiImage: false,
        useChatEndpoint: true,
      }),
      { kind: "provider-chat" },
    );
    assert.deepEqual(
      resolveOpenAICompatibleImageDispatch({
        runtime: openAIRuntime,
        imageSurface: "provider-images",
        isGeminiImage: false,
      }),
      { kind: "openai-strict" },
    );
  });
});
