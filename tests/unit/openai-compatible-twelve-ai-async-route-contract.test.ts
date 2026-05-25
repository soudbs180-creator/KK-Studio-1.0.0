import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import type { ImageGenerationOptions } from "../../apps/web/src/services/llm/LLMAdapter.ts";
import {
  is12AIAsyncImageModel,
  normalize12AIAsyncReferenceImage,
  normalize12AIBaseUrl,
  resolve12AIAsyncImageQuality,
  resolve12AIAsyncImageSize,
  shouldUse12AIAsyncImageRoute,
} from "../../apps/web/src/services/llm/openAICompatible12AIAsyncRoute.ts";

const ROOT_DIR = process.cwd();



function imageOptions(partial: Partial<ImageGenerationOptions>): ImageGenerationOptions {
  return {
    prompt: "prompt",
    modelId: "gemini-2.5-flash-image",
    ...partial,
  };
}

describe("OpenAI-compatible 12AI async route helpers", () => {
  test("normalizes 12AI async base URLs without owning headers or fetch behavior", () => {
    assert.equal(
      normalize12AIBaseUrl("https://proxy.example.com/root/v1/images/async/generations"),
      "https://proxy.example.com/root",
    );
    assert.equal(normalize12AIBaseUrl("https://api.12ai.org/api/v1/generate"), "https://api.12ai.org");
  });

  test("resolves 12AI async model, route, size, quality, and reference helpers", () => {
    assert.equal(is12AIAsyncImageModel("gemini-2.5-flash-image"), true);
    assert.equal(is12AIAsyncImageModel("gemini-3-pro-image-preview"), true);
    assert.equal(is12AIAsyncImageModel("unknown-model"), false);

    assert.equal(shouldUse12AIAsyncImageRoute(imageOptions({ imageCount: 2 })), true);
    assert.equal(shouldUse12AIAsyncImageRoute(imageOptions({ imageCount: 1 })), false);
    assert.equal(shouldUse12AIAsyncImageRoute(imageOptions({ modelId: "not-an-async-model", imageCount: 2 })), false);

    assert.equal(resolve12AIAsyncImageSize(imageOptions({ aspectRatio: "16:9" })), "16:9");
    assert.equal(resolve12AIAsyncImageSize(imageOptions({ providerConfig: { openai: { size: "auto" } } })), "auto");

    assert.equal(resolve12AIAsyncImageQuality(imageOptions({ providerConfig: { openai: { quality: "hd" } } })), "hd");
    assert.equal(resolve12AIAsyncImageQuality(imageOptions({ imageSize: "4K" })), "4K");
    assert.equal(resolve12AIAsyncImageQuality(imageOptions({ imageSize: "2K" })), "hd");

    assert.equal(
      normalize12AIAsyncReferenceImage({ data: "", mimeType: "image/png" }),
      "",
    );
    assert.equal(
      normalize12AIAsyncReferenceImage({ data: "data:image/jpeg;base64,aGVsbG8=", mimeType: "image/jpeg" }),
      "data:image/jpeg;base64,aGVsbG8=",
    );
    assert.equal(
      normalize12AIAsyncReferenceImage({ data: "aGVs bG8=", mimeType: "image/png" }),
      "data:image/png;base64,aGVs bG8=",
    );
  });

  test("adapter delegates 12AI async route ownership to the helper module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const helperSource = readSource("src/services/llm/openAICompatible12AIAsyncRoute.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatible12AIAsyncRoute/);
    assert.doesNotMatch(adapterSource, /private normalize12AIBaseUrl/);
    assert.doesNotMatch(adapterSource, /private is12AIAsyncImageModel/);
    assert.doesNotMatch(adapterSource, /private shouldUse12AIAsyncImageRoute/);
    assert.doesNotMatch(adapterSource, /private resolve12AIAsyncImageSize/);
    assert.doesNotMatch(adapterSource, /private resolve12AIAsyncImageQuality/);
    assert.doesNotMatch(adapterSource, /private normalize12AIAsyncReferenceImage/);
    assert.match(helperSource, /getOpenAIImageProfile\(options\.modelId\)/);
    assert.doesNotMatch(helperSource, /fetchWithTimeout|build12AIAsyncImageHeaders|keyManager/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-twelve-ai-async-route-contract\.test\.ts/);
  });
});
