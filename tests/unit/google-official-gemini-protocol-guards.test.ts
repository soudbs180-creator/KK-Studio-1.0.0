import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("Google Gemini video polling uses the current operation payload shape", () => {
  const userProxySource = readSource("supabase/functions/user-route-proxy/index.ts");
  const secureProxySource = readSource("supabase/functions/secure-model-proxy/index.ts");

  assert.match(userProxySource, /generateVideoResponse\?\.generatedSamples/);
  assert.match(secureProxySource, /generateVideoResponse\?\.generatedSamples/);
  assert.doesNotMatch(userProxySource, /fetchPredictOperationResult/);
  assert.doesNotMatch(secureProxySource, /fetchPredictOperationResult/);
});

test("Google Gemini audio generation uses speechConfig and inline audio parts", () => {
  const adapterSource = readSource("src/services/llm/GoogleAdapter.ts");
  const userProxySource = readSource("supabase/functions/user-route-proxy/index.ts");
  const secureProxySource = readSource("supabase/functions/secure-model-proxy/index.ts");

  assert.match(adapterSource, /speechConfig:\s*\{\s*voiceConfig/);
  assert.match(userProxySource, /speechConfig:\s*\{\s*voiceConfig/);
  assert.match(secureProxySource, /speechConfig:\s*\{\s*voiceConfig/);

  assert.match(adapterSource, /responseModalities:\s*\["AUDIO", "TEXT"\]/);
  assert.match(userProxySource, /responseModalities:\s*\['AUDIO', 'TEXT'\]/);
  assert.match(secureProxySource, /responseModalities:\s*\['AUDIO', 'TEXT'\]/);

  assert.doesNotMatch(adapterSource, /audioConfig:\s*\{\s*voiceConfig/);
  assert.doesNotMatch(userProxySource, /audioConfig:\s*\{\s*voiceConfig/);
  assert.doesNotMatch(secureProxySource, /audioConfig:\s*\{\s*voiceConfig/);
});

test("Google TTS presets and routing heuristics include current official model ids", () => {
  const presetsSource = readSource("src/services/model/modelPresets.ts");
  const registrySource = readSource("src/services/model/modelRegistry.ts");
  const capabilitiesSource = readSource("src/services/model/modelCapabilities.ts");
  const keyManagerSource = readSource("src/services/auth/keyManager.ts");

  assert.match(presetsSource, /gemini-2\.5-flash-preview-tts/);
  assert.match(presetsSource, /gemini-2\.5-pro-preview-tts/);
  assert.match(presetsSource, /lyria-3-pro-preview/);
  assert.match(presetsSource, /lyria-3-clip-preview/);
  assert.doesNotMatch(presetsSource, /lyria-realtime-v1/);
  assert.doesNotMatch(presetsSource, /gemini-2\.0-flash-audio/);
  assert.match(registrySource, /gemini-2\.5-flash-preview-tts/);
  assert.match(registrySource, /gemini-2\.5-pro-preview-tts/);
  assert.match(registrySource, /lyria-3-pro-preview/);
  assert.match(registrySource, /lyria-3-clip-preview/);
  assert.match(capabilitiesSource, /gemini-2\.5-flash-preview-tts/);
  assert.match(capabilitiesSource, /gemini-2\.5-pro-preview-tts/);
  assert.match(capabilitiesSource, /lyria-3-pro-preview/);
  assert.match(capabilitiesSource, /lyria-3-clip-preview/);
  assert.match(capabilitiesSource, /lowerModelId\.includes\('tts'\)/);
  assert.match(keyManagerSource, /id\.includes\('tts'\)/);
  assert.match(keyManagerSource, /normalizedModelId\.includes\('tts'\)/);
});
