import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type KeyManagerPricingUrlModule = {
  buildSilentProviderPricingUrl: (baseUrl: string) => string;
};

function readSource(relativePath: string): string {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

async function loadKeyManagerPricingUrl(): Promise<KeyManagerPricingUrlModule> {
  const fullPath = path.join(ROOT_DIR, 'src/services/auth/keyManagerPricingUrl.ts');
  assert.equal(existsSync(fullPath), true, 'src/services/auth/keyManagerPricingUrl.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerPricingUrl.ts') as KeyManagerPricingUrlModule;
}

test('keyManager silent pricing URL builder lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('src/services/auth/keyManager.ts');
  const helperSource = readSource('src/services/auth/keyManagerPricingUrl.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-pricing-url-contract\.test\.ts/);
  assert.match(keyManagerSource, /import \{ buildSilentProviderPricingUrl \} from '\.\/keyManagerPricingUrl';/);
  assert.match(keyManagerSource, /const pricingUrl = buildSilentProviderPricingUrl\(cleanUrl\);/);
  assert.match(helperSource, /const PROVIDER_MARKETING_SUFFIX_RE/);
  assert.match(helperSource, /export function buildSilentProviderPricingUrl/);
  assert.doesNotMatch(keyManagerSource, /const PROVIDER_MARKETING_SUFFIX_RE/);
  assert.doesNotMatch(keyManagerSource, /const sanitizedPricingBase = cleanUrl\.replace/);
});

test('keyManager silent pricing URL builder preserves current endpoint normalization', async () => {
  const { buildSilentProviderPricingUrl } = await loadKeyManagerPricingUrl();

  assert.equal(buildSilentProviderPricingUrl('https://api.example.com/v1'), 'https://api.example.com/pricing');
  assert.equal(buildSilentProviderPricingUrl('https://api.example.com/v1/'), 'https://api.example.com/pricing');
  assert.equal(buildSilentProviderPricingUrl('https://api.example.com/v1/models'), 'https://api.example.com/pricing');
  assert.equal(buildSilentProviderPricingUrl('https://api.example.com/v1/models/list'), 'https://api.example.com/pricing');
  assert.equal(buildSilentProviderPricingUrl('https://api.example.com/pricing'), 'https://api.example.com/pricing');
  assert.equal(buildSilentProviderPricingUrl('https://api.example.com/pricing/custom'), 'https://api.example.com/pricing');
  assert.equal(buildSilentProviderPricingUrl('https://api.example.com/base'), 'https://api.example.com/base/pricing');
  assert.equal(buildSilentProviderPricingUrl(''), '/pricing');
});
