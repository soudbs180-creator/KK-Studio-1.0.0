import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import type { ImageGenerationOptions } from "../../apps/web/src/services/llm/LLMAdapter.ts";
import {
  buildNewApiGoogleExtraBody,
  mergeExtraBody,
} from "../../apps/web/src/services/llm/openAICompatibleGoogleExtraBody.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

function imageOptions(partial: Partial<ImageGenerationOptions>): ImageGenerationOptions {
  return {
    prompt: "prompt",
    modelId: "gemini-2.5-flash-image",
    ...partial,
  };
}

describe("OpenAI-compatible Google extra_body helpers", () => {
  test("merges shallow nested extra_body records without adapter state", () => {
    assert.equal(mergeExtraBody(undefined, undefined), undefined);
    assert.deepEqual(
      mergeExtraBody(
        {
          google: {
            response_modalities: ["TEXT"],
          },
          metadata: {
            traceId: "trace-1",
          },
        },
        {
          google: {
            image_config: {
              aspect_ratio: "16:9",
            },
          },
          metadata: "replace-metadata",
        },
      ),
      {
        google: {
          response_modalities: ["TEXT"],
          image_config: {
            aspect_ratio: "16:9",
          },
        },
        metadata: "replace-metadata",
      },
    );
  });

  test("builds New API Google extra_body from provider image and thinking config", () => {
    assert.deepEqual(
      buildNewApiGoogleExtraBody(imageOptions({
        aspectRatio: "auto",
        imageSize: "1K",
        providerConfig: {
          google: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: " 9:16 ",
              imageSize: "hd",
            },
            thinkingConfig: {
              thinkingLevel: "high",
            },
          },
        },
      })),
      {
        google: {
          response_modalities: ["IMAGE"],
          image_config: {
            aspect_ratio: "9:16",
            image_size: "4K",
          },
          thinking_config: {
            thinking_level: "high",
            include_thoughts: false,
          },
        },
      },
    );

    assert.deepEqual(
      buildNewApiGoogleExtraBody(imageOptions({})),
      {
        google: {
          response_modalities: ["TEXT", "IMAGE"],
        },
      },
    );
  });

  test("adapter delegates New API Google extra_body helpers to the focused module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatibleGoogleExtraBody/);
    assert.doesNotMatch(adapterSource, /private mergeExtraBody/);
    assert.doesNotMatch(adapterSource, /private buildNewApiGoogleExtraBody/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-google-extra-body-contract\.test\.ts/);
  });
});
