import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import type { ImageGenerationOptions } from "../../src/services/llm/LLMAdapter.ts";
import {
  clampImageCount,
  getAspectOrientation,
  getOpenAIImageProfile,
  normalizeGeminiImageSize,
  normalizeRequestedAspectRatio,
  resolveOpenAIEditSize,
  resolveOpenAIImageSize,
} from "../../src/services/llm/openAICompatibleImageSizing.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

function imageOptions(partial: Partial<ImageGenerationOptions>): ImageGenerationOptions {
  return {
    prompt: "prompt",
    modelId: "gpt-image-1",
    ...partial,
  };
}

describe("OpenAI-compatible image sizing helpers", () => {
  test("classifies OpenAI image model profiles from model ids", () => {
    assert.equal(getOpenAIImageProfile("gpt-image-1"), "gpt-image-1");
    assert.equal(getOpenAIImageProfile("DALL-E-2"), "dall-e-2");
    assert.equal(getOpenAIImageProfile("dall-e-3-hd"), "dall-e-3");
    assert.equal(getOpenAIImageProfile("provider-image-model"), "generic");
  });

  test("resolves aspect orientation and image counts without adapter state", () => {
    assert.equal(getAspectOrientation("16:9"), "landscape");
    assert.equal(getAspectOrientation("9:16"), "portrait");
    assert.equal(getAspectOrientation("1:1"), "square");
    assert.equal(getAspectOrientation("auto"), "square");
    assert.equal(getAspectOrientation("invalid"), "square");

    assert.equal(clampImageCount(undefined, 10), 1);
    assert.equal(clampImageCount(2.6, 10), 3);
    assert.equal(clampImageCount(0, 10), 1);
    assert.equal(clampImageCount(99, 10), 10);
  });

  test("resolves generation sizes for OpenAI image profiles", () => {
    assert.equal(
      resolveOpenAIImageSize(imageOptions({ aspectRatio: "16:9" }), "gpt-image-1"),
      "1536x1024",
    );
    assert.equal(
      resolveOpenAIImageSize(imageOptions({ aspectRatio: "9:16" }), "gpt-image-1"),
      "1024x1536",
    );
    assert.equal(
      resolveOpenAIImageSize(
        imageOptions({ providerConfig: { openai: { size: "auto" } } }),
        "gpt-image-1",
      ),
      "auto",
    );
    assert.equal(
      resolveOpenAIImageSize(imageOptions({ imageSize: "0.5K" }), "dall-e-2"),
      "512x512",
    );
    assert.equal(
      resolveOpenAIImageSize(imageOptions({ aspectRatio: "16:9" }), "dall-e-3"),
      "1792x1024",
    );
  });

  test("resolves edit sizes through the same helper boundary", () => {
    assert.equal(
      resolveOpenAIEditSize(imageOptions({ providerConfig: { openai: { size: "512x512" } } })),
      "512x512",
    );
    assert.equal(resolveOpenAIEditSize(imageOptions({ imageSize: "0.5K" })), "512x512");
    assert.equal(resolveOpenAIEditSize(imageOptions({ imageSize: "4K" })), "1024x1024");
  });

  test("normalizes Gemini image size and aspect ratio without adapter state", () => {
    assert.equal(normalizeGeminiImageSize("512"), "512px");
    assert.equal(normalizeGeminiImageSize("0.5K"), "512px");
    assert.equal(normalizeGeminiImageSize("hd"), "4K");
    assert.equal(normalizeGeminiImageSize("4k"), "4K");
    assert.equal(normalizeGeminiImageSize("2k"), "2K");
    assert.equal(normalizeGeminiImageSize(undefined), "1K");

    assert.equal(normalizeRequestedAspectRatio("16:9"), "16:9");
    assert.equal(normalizeRequestedAspectRatio(" 9:16 "), "9:16");
    assert.equal(normalizeRequestedAspectRatio("auto"), undefined);
    assert.equal(normalizeRequestedAspectRatio(undefined), undefined);
  });

  test("adapter delegates sizing and count helpers to the focused module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatibleImageSizing/);
    assert.doesNotMatch(adapterSource, /private getOpenAIImageProfile/);
    assert.doesNotMatch(adapterSource, /private getAspectOrientation/);
    assert.doesNotMatch(adapterSource, /private clampImageCount/);
    assert.doesNotMatch(adapterSource, /private resolveOpenAIImageSize/);
    assert.doesNotMatch(adapterSource, /private resolveOpenAIEditSize/);
    assert.doesNotMatch(adapterSource, /private normalizeGeminiImageSize/);
    assert.doesNotMatch(adapterSource, /private normalizeRequestedAspectRatio/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-image-sizing-contract\.test\.ts/);
  });
});
