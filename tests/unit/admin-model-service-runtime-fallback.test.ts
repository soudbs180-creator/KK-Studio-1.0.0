import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('admin model loading only uses the legacy Web API fallback for local or explicitly configured runtimes', () => {
  const clientSource = readSource('src/services/api/kkApiClient.ts');
  const serviceSource = readSource('src/services/model/adminModelService.ts');
  const exchangeRateSource = readSource('src/services/billing/creditExchangeRateService.ts');

  assert.match(clientSource, /export function shouldUseLegacyWebApiFallback\(\): boolean \{/);
  assert.match(clientSource, /const configuredBaseUrl = readRuntimeEnv\("VITE_KK_API_BASE_URL"\) \|\| "";/);
  assert.match(clientSource, /function isExplicitLegacyWebApiFallbackEnabled\(\): boolean \{/);
  assert.match(clientSource, /if \(runtimeHostname && isLoopbackHostname\(runtimeHostname\)\) \{/);
  assert.match(clientSource, /return Boolean\(configuredBaseUrl\) && isExplicitLegacyWebApiFallbackEnabled\(\);/);
  assert.match(serviceSource, /shouldUseLegacyWebApiFallback/);
  assert.match(serviceSource, /if \(!shouldUseLegacyWebApiFallback\(\)\) \{/);
  assert.match(serviceSource, /Web API fallback is disabled for this runtime/);
  assert.match(exchangeRateSource, /shouldUseLegacyWebApiFallback/);
  assert.match(exchangeRateSource, /if \(shouldUseLegacyWebApiFallback\(\)\) \{/);
});
