import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("Suxi image routing stays on dedicated surfaces instead of being swallowed by chat compatibility", () => {
  const strategySource = readSource("src/services/api/providerStrategy.ts");
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    strategySource,
    /id: 'suxi'[\s\S]*?imageRoutingPolicy: 'surface-first'/,
  );
  assert.match(
    adapterSource,
    /const imageSurface = resolveImageSurface\(\{/,
  );
  assert.match(
    adapterSource,
    /if \(imageSurface === 'chat-image'\)/,
  );
});

test("12AI image routing requires an explicit async preference instead of blanket async short-circuiting", () => {
  const routerSource = readSource("src/services/api/providerSurfaceRouter.ts");
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    routerSource,
    /preferAsync\?: boolean/,
  );
  assert.match(
    routerSource,
    /input\.runtime\.strategyId === '12ai' && input\.preferAsync && input\.isAsyncImageModel\?\.\(input\.modelId\)/,
  );
  assert.match(
    adapterSource,
    /const prefer12AIAsync = this\.shouldUse12AIAsyncImageRoute\(options\);/,
  );
});

test("GPT Best defaults to the doc-safe native images payload instead of the local extended payload", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
  const gptBestBlockMatch = adapterSource.match(/if \(isGptBest\) \{[\s\S]*?\n        \}/);

  assert.ok(gptBestBlockMatch, "expected to find the GPT Best routing block");
  assert.match(
    gptBestBlockMatch[0],
    /return this\.generateImageStandard_GPT_Best_Native\(options, keySlot\);/,
  );
  assert.doesNotMatch(
    gptBestBlockMatch[0],
    /generateImageStandard_GPT_Best_Extended/,
  );
});

test("GPT Best native images payload stays aligned with the documented images surface", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
  const nativeBlockMatch = adapterSource.match(/private async generateImageStandard_GPT_Best_Native[\s\S]*?return this\.executeImageRequest\(url, body, keySlot, options\);/);

  assert.ok(nativeBlockMatch, "expected to find the GPT Best native images helper");
  assert.match(
    nativeBlockMatch[0],
    /aspect_ratio: aspectRatioStr/,
  );
  assert.match(
    nativeBlockMatch[0],
    /response_format: 'url'/,
  );
  assert.doesNotMatch(
    nativeBlockMatch[0],
    /imageSize:/,
  );
});

test("model endpoint types flow from key metadata into image surface routing", () => {
  const keyManagerSource = readSource("src/services/auth/keyManager.ts");
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    keyManagerSource,
    /endpointTypes\?: string\[];/,
  );
  assert.match(
    keyManagerSource,
    /type ModelMetadata = \{[\s\S]*endpointTypes\?: string\[];/,
  );
  assert.match(
    keyManagerSource,
    /const GOOGLE_MODEL_METADATA = new Map<string, ModelMetadata>/,
  );
  assert.match(
    keyManagerSource,
    /pricingMeta\?\.endpointTypes/,
  );
  assert.match(
    keyManagerSource,
    /endpointTypes: exactModel\.endpointTypes/,
  );
  assert.match(
    adapterSource,
    /const modelMetadata = getModelMetadata\(options\.modelId\);/,
  );
  assert.match(
    adapterSource,
    /endpointTypes: modelMetadata\?\.endpointTypes/,
  );
  assert.ok(
    adapterSource.indexOf("const modelMetadata = getModelMetadata(options.modelId);")
      < adapterSource.indexOf("const imageSurface = resolveImageSurface({"),
    "expected modelMetadata to be declared before resolveImageSurface uses it",
  );
});

test("base64 image extraction preserves upstream mime types instead of forcing png", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    adapterSource,
    /const mimeType = item\.mime_type \|\| item\.mimeType \|\| item\?\.image\?\.mime_type \|\| item\?\.image\?\.mimeType \|\| 'image\/png';/,
  );
  assert.match(
    adapterSource,
    /urls\.push\(`data:\$\{mimeType\};base64,\$\{cleaned\}`\);/,
  );
});
