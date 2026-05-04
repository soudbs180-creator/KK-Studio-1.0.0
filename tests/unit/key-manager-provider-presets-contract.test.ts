import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadProviderPresets(): Promise<{
  PROVIDER_PRESETS: Record<string, { name: string; baseUrl: string; models: string[]; format: string; icon?: string; defaultApiKey?: string }>;
}> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerProviderPresets.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerProviderPresets.ts must exist');
  return await import('../../src/services/auth/keyManagerProviderPresets.ts') as Awaited<ReturnType<typeof loadProviderPresets>>;
}

test('keyManager provider presets live outside the monolithic key manager', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const helperSource = readSource('src/services/auth/keyManagerProviderPresets.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-provider-presets-contract\.test\.ts/);
  assert.match(keyManagerSource, /from '\.\/keyManagerProviderPresets';/);
  assert.match(keyManagerSource, /export \{[\s\S]*PROVIDER_PRESETS[\s\S]*\} from '\.\/keyManagerProviderPresets';/);
  assert.doesNotMatch(keyManagerSource, /export const PROVIDER_PRESETS: Record<[\s\S]*= \{/);
  assert.match(helperSource, /export const PROVIDER_PRESETS: Record<string, KeyManagerProviderPreset> = \{/);
  assert.doesNotMatch(helperSource, /from ['"]\.\/keyManager(?:['"]|\.ts['"])/);
  assert.doesNotMatch(helperSource, /fetch\(|localStorage|providerPersistence|cloudSync|keyStorage|resolveProviderRuntime/);
});

test('provider presets preserve documented built-in routes and defaults', async () => {
  const { PROVIDER_PRESETS } = await loadProviderPresets();

  assert.deepEqual(Object.keys(PROVIDER_PRESETS), [
    'zhipu',
    'wanqing',
    'sambanova',
    'openclaw',
    't8star',
    'volcengine',
    'deepseek',
    'moonshot',
    'siliconflow',
    '12ai',
    'antigravity',
    '12ai-nanobanana',
    'flow2api',
    'wuyinkeji-nanobanana2',
    'gpt-best',
    'custom',
  ]);
  assert.equal(PROVIDER_PRESETS.openclaw.defaultApiKey, 'sk-openclaw-zero-token');
  assert.equal(PROVIDER_PRESETS.custom.format, 'auto');
  assert.equal(PROVIDER_PRESETS['12ai'].baseUrl, 'https://cdn.12ai.org');
  assert.equal(PROVIDER_PRESETS['12ai'].format, 'gemini');
  assert.equal(PROVIDER_PRESETS['12ai'].models.includes('gemini-3.1-flash-image-preview'), true);
  assert.equal(PROVIDER_PRESETS['12ai-nanobanana'].format, 'gemini');
  assert.equal(PROVIDER_PRESETS['12ai-nanobanana'].models.includes('gemini-3.1-flash-image-preview'), true);
  assert.equal(PROVIDER_PRESETS['wuyinkeji-nanobanana2'].models[0], 'image_nanoBanana2');
});
