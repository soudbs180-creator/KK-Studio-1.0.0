import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  buildOpenAICompatibleImageContentParts,
  formatOpenAICompatibleReferenceImage,
  formatOpenAICompatibleReferenceImages,
} from "../../apps/web/src/services/llm/openAICompatibleImageReferences.ts";

const ROOT_DIR = process.cwd();



describe("OpenAI-compatible image reference helpers", () => {
  test("formats raw and data URI references without adapter state", () => {
    assert.equal(
      formatOpenAICompatibleReferenceImage({ data: "abc123", mimeType: "image/webp" }),
      "data:image/webp;base64,abc123",
    );
    assert.equal(
      formatOpenAICompatibleReferenceImage("data:image/jpeg;base64,xyz"),
      "data:image/jpeg;base64,xyz",
    );
  });

  test("preserves legacy http-url behavior only for provider body image fields", () => {
    const url = "https://example.test/ref.png";

    assert.equal(
      formatOpenAICompatibleReferenceImage(url),
      "data:image/png;base64,https://example.test/ref.png",
    );
    assert.equal(
      formatOpenAICompatibleReferenceImage(url, { preserveHttpUrl: true }),
      url,
    );
    assert.deepEqual(
      formatOpenAICompatibleReferenceImages([url, { data: "b64", mimeType: "image/png" }], {
        preserveHttpUrl: true,
      }),
      [url, "data:image/png;base64,b64"],
    );
  });

  test("builds chat-completion image content parts from references", () => {
    assert.deepEqual(
      buildOpenAICompatibleImageContentParts("draw this", [
        { data: "abc123", mimeType: "image/png" },
        "data:image/webp;base64,def456",
      ]),
      [
        { type: "text", text: "draw this" },
        { type: "image_url", image_url: { url: "data:image/png;base64,abc123" } },
        { type: "image_url", image_url: { url: "data:image/webp;base64,def456" } },
      ],
    );
  });

  test("adapter delegates repeated reference formatting to the focused helper", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatibleImageReferences/);
    assert.doesNotMatch(adapterSource, /const toDataUrl = \(ref: string \| \{ data: string; mimeType: string \}\) =>/);
    assert.doesNotMatch(adapterSource, /const dataUrl = imgData\.startsWith\('data:'\)/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-image-references-contract\.test\.ts/);
  });
});
