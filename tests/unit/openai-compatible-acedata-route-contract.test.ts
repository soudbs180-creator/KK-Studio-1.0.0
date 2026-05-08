import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import type { ImageGenerationOptions } from "../../src/services/llm/LLMAdapter.ts";
import {
  ACEDATA_DEFAULT_BASE_URL,
  extractAceDataDirectRoute,
  normalizeAceDataBaseUrl,
  normalizeAceDataReferenceImage,
  resolveAceDataCandidateRoutes,
  resolveAceDataImageRoute,
  resolveAceDataImageSize,
} from "../../src/services/llm/openAICompatibleAceDataRoute.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

function imageOptions(partial: Partial<ImageGenerationOptions>): ImageGenerationOptions {
  return {
    prompt: "prompt",
    modelId: "flux-kontext-pro",
    ...partial,
  };
}

describe("OpenAI-compatible AceData route helpers", () => {
  test("normalizes AceData base URLs and direct image/task routes", () => {
    assert.equal(normalizeAceDataBaseUrl(""), ACEDATA_DEFAULT_BASE_URL);
    assert.equal(normalizeAceDataBaseUrl("api.acedata.cloud/flux/images"), "https://api.acedata.cloud");
    assert.equal(
      normalizeAceDataBaseUrl("https://proxy.example.com/root/nano-banana/tasks"),
      "https://proxy.example.com/root",
    );

    assert.equal(extractAceDataDirectRoute("api.acedata.cloud/flux/images")?.serviceId, "flux");
    assert.equal(extractAceDataDirectRoute("https://proxy.example.com/root/nano-banana/tasks")?.serviceId, "nano-banana");
  });

  test("resolves direct, alias, fuzzy, and candidate AceData routes", () => {
    assert.equal(
      resolveAceDataImageRoute("https://proxy.example.com/root/nano-banana/images", "ignored").serviceId,
      "nano-banana",
    );
    assert.equal(resolveAceDataImageRoute("", "Gemini 2.5 Flash Image").serviceId, "nano-banana");
    assert.equal(resolveAceDataImageRoute("", "flux-kontext-max").serviceId, "flux");

    assert.deepEqual(
      resolveAceDataCandidateRoutes("https://api.acedata.cloud/nano-banana/tasks", "flux-pro").map((route) => route.serviceId),
      ["nano-banana", "flux"],
    );
  });

  test("normalizes AceData reference images and image size without adapter state", () => {
    assert.equal(
      normalizeAceDataReferenceImage({ data: "ignored", mimeType: "image/png", url: "https://cdn.example.com/ref.png" }, 0),
      "https://cdn.example.com/ref.png",
    );
    assert.equal(
      normalizeAceDataReferenceImage({ data: "data:image/jpeg;base64,aGVsbG8=", mimeType: "image/jpeg" }, 1),
      "data:image/jpeg;base64,aGVsbG8=",
    );
    assert.equal(
      normalizeAceDataReferenceImage({ data: " aGVs bG8= ", mimeType: "image/png" }, 2),
      "data:image/png;base64,aGVsbG8=",
    );
    assert.throws(
      () => normalizeAceDataReferenceImage({ data: "blob:http://local/ref", mimeType: "image/png" }, 3),
      /local blob URL/,
    );

    assert.equal(resolveAceDataImageSize(imageOptions({ aspectRatio: "16:9" })), "1536x1024");
    assert.equal(
      resolveAceDataImageSize(imageOptions({ providerConfig: { openai: { size: "auto" } } })),
      "auto",
    );
  });

  test("adapter delegates AceData route ownership to the helper module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const helperSource = readSource("src/services/llm/openAICompatibleAceDataRoute.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatibleAceDataRoute/);
    assert.doesNotMatch(adapterSource, /private normalizeAceDataBaseUrl/);
    assert.doesNotMatch(adapterSource, /private extractAceDataDirectRoute/);
    assert.doesNotMatch(adapterSource, /private normalizeAceDataAlias/);
    assert.doesNotMatch(adapterSource, /private resolveAceDataImageRoute/);
    assert.doesNotMatch(adapterSource, /private resolveAceDataCandidateRoutes/);
    assert.doesNotMatch(adapterSource, /private normalizeAceDataReferenceImage/);
    assert.doesNotMatch(adapterSource, /private resolveAceDataImageSize/);
    assert.doesNotMatch(helperSource, /fetchWithTimeout|executeImageRequest|keyManager/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-acedata-route-contract\.test\.ts/);
  });
});
