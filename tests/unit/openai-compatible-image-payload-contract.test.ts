import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  extractImageUrlsFromPayload,
  extractOpenAICompatibleChatImageUrls,
} from "../../src/services/llm/openAICompatibleImagePayload.ts";

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

  test("selects the best chat-image candidate before falling back to message content", () => {
    const urls = extractOpenAICompatibleChatImageUrls({
      choices: [
        {
          message: {
            images: [{ b64_json: "c21hbGw=" }],
            content: "![fallback](https://cdn.example.com/fallback.png)",
          },
        },
      ],
      images: [{ url: "https://cdn.example.com/preview.png" }],
      data: [{ b64_json: "bGFyZ2VyLWNoYXQtaW1hZ2UtY2FuZGlkYXRl" }],
    });

    assert.deepEqual(urls, [
      "data:image/png;base64,bGFyZ2VyLWNoYXQtaW1hZ2UtY2FuZGlkYXRl",
    ]);
  });

  test("filters unsafe structured chat-image URLs before candidate selection", () => {
    const urls = extractOpenAICompatibleChatImageUrls({
      choices: [
        {
          message: {
            images: [
              { url: "javascript:alert('xss')" },
            ],
            content: "![fallback](https://cdn.example.com/fallback.png)",
          },
        },
      ],
      data: [
        { url: "file:///C:/secret.png" },
        { url: "https://cdn.example.com/safe.png" },
      ],
    });

    assert.deepEqual(urls, [
      "https://cdn.example.com/safe.png",
    ]);
  });

  test("normalizes unsafe structured chat-image MIME types to png", () => {
    const urls = extractOpenAICompatibleChatImageUrls({
      choices: [
        {
          message: {
            images: [
              { b64_json: " YWJj ", mime_type: "text/html" },
            ],
          },
        },
      ],
    });

    assert.deepEqual(urls, [
      "data:image/png;base64,YWJj",
    ]);
  });

  test("filters unsafe generic payload URLs and data URL MIME types", () => {
    const urls = extractImageUrlsFromPayload({
      data: [
        { url: "javascript:alert('xss')" },
        { url: "data:text/html;base64,PHNjcmlwdA==" },
        { url: "https://cdn.example.com/safe.png" },
        { b64_json: " ZGVm ", mimeType: "text/html" },
      ],
    });

    assert.deepEqual(urls, [
      "https://cdn.example.com/safe.png",
      "data:image/png;base64,ZGVm",
    ]);
  });

  test("adapter delegates payload URL extraction to the helper module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /extractImageUrlsFromPayload/);
    assert.match(adapterSource, /extractOpenAICompatibleChatImageUrls/);
    assert.doesNotMatch(adapterSource, /private extractImageUrlsFromPayload/);
    assert.doesNotMatch(adapterSource, /const allImages = \[/);
    assert.doesNotMatch(adapterSource, /let bestImage = null;/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-image-payload-contract\.test\.ts/);
  });
});
