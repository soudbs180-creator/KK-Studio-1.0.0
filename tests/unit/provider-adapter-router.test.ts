import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveProviderRuntime } from "../../apps/web/src/services/api/providerStrategy.ts";
import { resolveAdapterKind } from "../../apps/web/src/services/llm/providerAdapterRouter.ts";

describe("provider adapter router", () => {
  test("routes claude-native runtimes to the claude adapter", () => {
    const runtime = resolveProviderRuntime({
      provider: "New Suxi AI",
      baseUrl: "https://new.suxi.ai",
      format: "claude",
    });

    assert.equal(resolveAdapterKind(runtime), "claude-native");
  });

  test("routes gemini-native runtimes to the gemini adapter", () => {
    const runtime = resolveProviderRuntime({
      provider: "12AI",
      baseUrl: "https://cdn.12ai.org",
      format: "gemini",
    });

    assert.equal(resolveAdapterKind(runtime), "gemini-native");
  });

  test("routes OpenAI-compatible runtimes to the openai-compatible adapter", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gpt-best.example.com/v1",
      format: "openai",
    });

    assert.equal(resolveAdapterKind(runtime), "openai-compatible");
  });
});
