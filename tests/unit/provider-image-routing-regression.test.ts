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
  const helperSource = readSource("src/services/llm/openAICompatibleImageDispatch.ts");

  assert.match(
    strategySource,
    /id: 'suxi'[\s\S]*?imageRoutingPolicy: 'surface-first'/,
  );
  assert.match(
    adapterSource,
    /const dispatchPlan = resolveOpenAICompatibleImageDispatch\(\{/,
  );
  assert.match(
    helperSource,
    /if \(input\.imageSurface === 'chat-image'\)/,
  );
  assert.match(
    helperSource,
    /if \(input\.runtime\.strategyId === 'suxi'\)/,
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
    /const prefer12AIAsync = shouldUse12AIAsyncImageRoute\(options\);/,
  );
});

test("GPT Best defaults to the doc-safe native images payload instead of the local extended payload", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
  const helperSource = readSource("src/services/llm/openAICompatibleImageDispatch.ts");
  const gptBestDispatchStart = adapterSource.indexOf("dispatchPlan.kind === 'gpt-best-native'");
  const gptBestDispatchEnd = adapterSource.indexOf("dispatchPlan.kind === '12ai-openai-strict'");
  const gptBestDispatchBlock = adapterSource.slice(gptBestDispatchStart, gptBestDispatchEnd);

  assert.ok(gptBestDispatchStart > -1 && gptBestDispatchEnd > gptBestDispatchStart);
  assert.match(
    helperSource,
    /return \{ kind: 'gpt-best-native' \};/,
  );
  assert.match(
    helperSource,
    /if \(input\.runtime\.strategyId === 'gpt-best'\)/,
  );
  assert.match(
    adapterSource,
    /dispatchPlan\.kind === 'gpt-best-native'/,
  );
  assert.match(
    gptBestDispatchBlock,
    /return this\.generateImageStandard_GPT_Best_Native\(options, keySlot\);/,
  );
  assert.doesNotMatch(
    gptBestDispatchBlock,
    /generateImageStandard_GPT_Best_Extended/,
  );
});

test("GPT Best native images payload stays aligned with the documented images surface", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
  const nativeBlockMatch = adapterSource.match(/private async generateImageStandard_GPT_Best_Native[\s\S]*?return this\.executeImageRequest\(url, body, keySlot, options\);/);

  assert.ok(nativeBlockMatch, "expected to find the GPT Best native images helper");
  assert.match(
    adapterSource,
    /assertOpenAICompatibleRuntimeBaseUrl\(keySlot, 'images'\);/,
  );
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
    /const REMOTE_MODEL_METADATA = new Map<string, ModelMetadata>\(\);/,
  );
  assert.match(
    keyManagerSource,
    /registerRemoteModelMetadata\(discovery\.metadataByModelId\);/,
  );
  assert.match(
    keyManagerSource,
    /pricingMeta\?\.endpointTypes/,
  );
  assert.match(
    keyManagerSource,
    /endpointTypes: remoteMetadata\?\.endpointTypes \|\| exactModel\.endpointTypes/,
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

test("third-party OpenAI-compatible image paths fail fast when Base URL is missing", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    adapterSource,
    /private assertOpenAICompatibleRuntimeBaseUrl\(keySlot: KeySlot, surface: 'chat' \| 'images', format\?: string\): void/,
  );
  assert.match(
    adapterSource,
    /runtime\.strategyId !== 'openai'[\s\S]*?请先填写该供应商工作台提供的真实 Base URL/,
  );
  assert.match(
    adapterSource,
    /generateImageViaChat[\s\S]*?this\.assertOpenAICompatibleRuntimeBaseUrl\(keySlot, 'chat'\);/,
  );
  assert.match(
    adapterSource,
    /generateImageViaChatStrict[\s\S]*?this\.assertOpenAICompatibleRuntimeBaseUrl\(keySlot, 'chat'\);/,
  );
  assert.match(
    adapterSource,
    /generateImageStandard_OpenAI_Strict_DocSafe[\s\S]*?this\.assertOpenAICompatibleRuntimeBaseUrl\(keySlot, 'images'\);/,
  );
  assert.match(
    adapterSource,
    /generateImageGeminiNative[\s\S]*?this\.assertOpenAICompatibleRuntimeBaseUrl\(keySlot, 'images', 'gemini'\);/,
  );
});

test("third-party OpenAI-compatible chat paths fail fast when Base URL is missing", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    adapterSource,
    /chatWithCompatibleResponses[\s\S]*?this\.assertOpenAICompatibleRuntimeBaseUrl\(keySlot, 'chat'\);/,
  );
  assert.match(
    adapterSource,
    /chatStreamWithCompatibleResponses[\s\S]*?this\.assertOpenAICompatibleRuntimeBaseUrl\(keySlot, 'chat'\);/,
  );
});

test("image compatibility fallback disables unreachable post-throw fallback code", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(
    adapterSource,
    /throw buildOpenAICompatibleImageCompatibilityModeError\('chat', chatErr, keySlot\.provider\);/,
  );
  assert.match(
    adapterSource,
    /throw buildOpenAICompatibleImageCompatibilityModeError\('standard', imagesErr, keySlot\.provider\);/,
  );
  assert.doesNotMatch(
    adapterSource,
    /Chat API 不兼容，回退 Images API/,
  );
  assert.doesNotMatch(
    adapterSource,
    /Images API 疑似不兼容，自动回退 Chat API/,
  );
});

test("base64 image extraction preserves upstream mime types instead of forcing png", () => {
  const payloadHelperSource = readSource("src/services/llm/openAICompatibleImagePayload.ts");

  assert.match(
    payloadHelperSource,
    /getProperty\(item, 'mime_type'\)/,
  );
  assert.match(
    payloadHelperSource,
    /getProperty\(item, 'mimeType'\)/,
  );
  assert.match(
    payloadHelperSource,
    /getProperty\(image, 'mime_type'\)/,
  );
  assert.match(
    payloadHelperSource,
    /getProperty\(image, 'mimeType'\)/,
  );
  assert.match(
    payloadHelperSource,
    /function normalizeBase64ImageMimeType/,
  );
  assert.match(
    payloadHelperSource,
    /return 'image\/png';/,
  );
});
