import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { extractImageUrlsFromPayload } from "../../src/services/llm/openAICompatibleImagePayload.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

describe("OpenAI-compatible image payload parsing", () => {
  test("extracts URLs from nested provider payload shapes without duplicates", () => {
    const urls = extractImageUrlsFromPayload({
      data: [{ url: " https://cdn.example.com/data-a.png " }],
      result: {
        images: [
          { image_url: "https://cdn.example.com/result-image.png" },
          { url: "https://cdn.example.com/data-a.png" },
        ],
      },
      output: {
        outputs: ["https://cdn.example.com/output.png"],
      },
    });

    assert.deepEqual(urls, [
      "https://cdn.example.com/data-a.png",
      "https://cdn.example.com/result-image.png",
      "https://cdn.example.com/output.png",
    ]);
  });

  test("preserves provider mime types when normalizing base64 image fields", () => {
    const urls = extractImageUrlsFromPayload({
      data: [
        {
          b64_json: "data:image/webp;base64, YmFzZTY0 ",
          mime_type: "image/webp",
        },
        {
          image: {
            b64_json: "YWJj",
            mimeType: "image/jpeg",
          },
        },
      ],
    });

    assert.deepEqual(urls, [
      "data:image/webp;base64,YmFzZTY0",
      "data:image/jpeg;base64,YWJj",
    ]);
  });

  test("extracts image data URLs and markdown URLs from text responses", () => {
    const urls = extractImageUrlsFromPayload({
      choices: [
        {
          message: {
            content: "![img](https://cdn.example.com/markdown.png) data:image/png;base64,YWJj",
          },
        },
      ],
    });

    assert.deepEqual(urls, [
      "data:image/png;base64,YWJj",
      "https://cdn.example.com/markdown.png",
    ]);
  });

  test("adapter delegates payload URL extraction to the helper module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /extractImageUrlsFromPayload/);
    assert.doesNotMatch(adapterSource, /private extractImageUrlsFromPayload/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-image-payload-contract\.test\.ts/);
  });
});
