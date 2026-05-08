import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import type { ChatOptions } from "../../src/services/llm/LLMAdapter.ts";
import {
  buildChatCompletionsBody,
  buildOpenAICompatibleMessages,
  type OpenAICompatibleChatMessage,
} from "../../src/services/llm/openAICompatibleChatPayload.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

function chatOptions(partial: Partial<ChatOptions>): ChatOptions {
  return {
    modelId: "gpt-4o-mini",
    messages: [
      { role: "user", content: "first user" },
      { role: "assistant", content: "assistant reply" },
      { role: "user", content: "last user" },
    ],
    ...partial,
  };
}

describe("OpenAI-compatible chat payload helpers", () => {
  test("builds messages with system prompt and inline images on the last user message", () => {
    const messages = buildOpenAICompatibleMessages(chatOptions({
      systemPrompt: "system instruction",
      inlineData: [
        { mimeType: "image/png", data: "png-data" },
        { mimeType: "image/jpeg", data: "jpeg-data" },
      ],
    }));

    assert.deepEqual(messages[0], { role: "system", content: "system instruction" });
    assert.deepEqual(messages[1], { role: "user", content: "first user" });
    assert.deepEqual(messages[2], { role: "assistant", content: "assistant reply" });
    assert.deepEqual(messages[3], {
      role: "user",
      content: [
        { type: "text", text: "last user" },
        { type: "image_url", image_url: { url: "data:image/png;base64,png-data" } },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,jpeg-data" } },
      ],
    });
  });

  test("builds chat completions body and preserves extraBody top-level overrides", () => {
    const messages: OpenAICompatibleChatMessage[] = [{ role: "user", content: "hello" }];

    assert.deepEqual(
      buildChatCompletionsBody(chatOptions({
        modelId: "custom-model",
        messages: [{ role: "user", content: "hello" }],
        temperature: 0.3,
        extraBody: {
          max_tokens: 32,
          stream: true,
          metadata: { traceId: "trace-1" },
        },
      }), messages),
      {
        model: "custom-model",
        messages,
        temperature: 0.3,
        max_tokens: 32,
        stream: true,
        metadata: { traceId: "trace-1" },
      },
    );

    assert.deepEqual(
      buildChatCompletionsBody(chatOptions({ maxTokens: undefined }), messages),
      {
        model: "gpt-4o-mini",
        messages,
        temperature: undefined,
        max_tokens: 20480,
        stream: false,
      },
    );
  });

  test("adapter delegates chat payload builders to the focused module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatibleChatPayload/);
    assert.doesNotMatch(adapterSource, /private buildOpenAICompatibleMessages/);
    assert.doesNotMatch(adapterSource, /private buildChatCompletionsBody/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-chat-payload-contract\.test\.ts/);
  });
});
