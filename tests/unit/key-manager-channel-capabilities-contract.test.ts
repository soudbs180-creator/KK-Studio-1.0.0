import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type BuildChannelCapabilities = (
  models: string[],
  pricingSupport: 'native' | 'manual' | 'none',
  managementSupport: 'native' | 'external' | 'none',
) => {
  chat: boolean;
  image: boolean;
  video: boolean;
  audio: boolean;
  modelDiscovery: boolean;
  pricingDiscovery: boolean;
  managementApi: boolean;
};



async function loadChannelCapabilities(): Promise<{ buildChannelCapabilities: BuildChannelCapabilities }> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerChannelCapabilities.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerChannelCapabilities.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerChannelCapabilities.ts') as { buildChannelCapabilities: BuildChannelCapabilities };
}

test('keyManager channel capabilities boundary lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerChannelCapabilities.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-channel-capabilities-contract\.test\.ts/);
  assert.match(keyManagerSource, /import \{ buildChannelCapabilities \} from '\.\/keyManagerChannelCapabilities(?:\.ts)?';/);
  assert.doesNotMatch(keyManagerSource, /private buildChannelCapabilities/);
  assert.match(keyManagerSource, /capabilities: buildChannelCapabilities\(effectiveSlotModels, pricingSupport, managementSupport\)/);
  assert.match(keyManagerSource, /capabilities: buildChannelCapabilities\(effectiveProviderModels, pricingSupport, managementSupport\)/);
  assert.match(helperSource, /export function buildChannelCapabilities/);
  assert.doesNotMatch(helperSource, /from ['"]\.\/keyManager(?:['"]|\.ts['"])/);
  assert.doesNotMatch(helperSource, /keyStorage|providerPersistence|cloudSync|sharedPricingCache|Adapter|React|\.tsx/);
});

test('keyManager channel capabilities preserve model and support flag behavior', async () => {
  const { buildChannelCapabilities } = await loadChannelCapabilities();

  assert.deepEqual(buildChannelCapabilities([], 'none', 'external'), {
    chat: true,
    image: false,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: false,
    managementApi: false,
  });

  assert.deepEqual(buildChannelCapabilities(undefined as unknown as string[], 'none', 'external'), {
    chat: true,
    image: false,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: false,
    managementApi: false,
  });

  assert.deepEqual(buildChannelCapabilities(null as unknown as string[], 'none', 'external'), {
    chat: true,
    image: false,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: false,
    managementApi: false,
  });

  assert.deepEqual(buildChannelCapabilities(['*'], 'native', 'native'), {
    chat: true,
    image: true,
    video: true,
    audio: true,
    modelDiscovery: true,
    pricingDiscovery: true,
    managementApi: true,
  });

  assert.deepEqual(buildChannelCapabilities([' * '], 'native', 'native'), {
    chat: false,
    image: false,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: true,
    managementApi: true,
  });

  assert.deepEqual(buildChannelCapabilities(['Label|*|Provider'], 'native', 'native'), {
    chat: false,
    image: false,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: true,
    managementApi: true,
  });

  assert.deepEqual(buildChannelCapabilities(['custom-model'], 'native', 'native'), {
    chat: false,
    image: false,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: true,
    managementApi: true,
  });

  assert.deepEqual(buildChannelCapabilities([
    'Display Name|imagen-4.0-generate-001|Google',
    'veo-3.1-fast-generate-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash-preview-tts',
  ], 'manual', 'none'), {
    chat: true,
    image: true,
    video: true,
    audio: true,
    modelDiscovery: true,
    pricingDiscovery: false,
    managementApi: false,
  });

  assert.deepEqual(buildChannelCapabilities(['Friendly Model(gpt-4o / desc)'], 'none', 'none'), {
    chat: true,
    image: false,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: false,
    managementApi: false,
  });

  assert.deepEqual(buildChannelCapabilities(['gemini-2.5-flash-image'], 'none', 'none'), {
    chat: false,
    image: true,
    video: false,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: false,
    managementApi: false,
  });

  assert.deepEqual(buildChannelCapabilities(['veo-3.1-fast-generate-preview'], 'none', 'none'), {
    chat: false,
    image: false,
    video: true,
    audio: false,
    modelDiscovery: true,
    pricingDiscovery: false,
    managementApi: false,
  });

  assert.equal(buildChannelCapabilities(['lyria-3-pro-preview'], 'none', 'native').audio, true);
  assert.equal(buildChannelCapabilities(['minimax-t2a-01'], 'native', 'external').audio, true);
  assert.equal(buildChannelCapabilities(['tts-1-hd'], 'none', 'none').audio, true);
  assert.equal(buildChannelCapabilities(['suno-v4'], 'none', 'none').audio, true);
  assert.equal(buildChannelCapabilities(['speech-audio-model'], 'none', 'none').audio, true);
  assert.equal(buildChannelCapabilities(['music-model'], 'none', 'none').audio, false);
  assert.equal(buildChannelCapabilities(['elevenlabs-voice'], 'none', 'none').audio, false);
});
