import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('admin model loading uses the typed API directly while exchange rates remain API-only', () => {
  const clientSource = readSource('src/services/api/kkApiClient.ts');
  const serviceSource = readSource('src/services/model/adminModelService.ts');
  const exchangeRateSource = readSource('src/services/billing/creditExchangeRateService.ts');

  assert.match(clientSource, /export function shouldUseLegacyWebApiFallback\(\): boolean \{/);
  assert.match(clientSource, /const configuredBaseUrl = readRuntimeEnv\("VITE_KK_API_BASE_URL"\) \|\| "";/);
  assert.match(clientSource, /function isExplicitLegacyWebApiFallbackEnabled\(\): boolean \{/);
  assert.match(clientSource, /if \(runtimeHostname && isLoopbackHostname\(runtimeHostname\)\) \{/);
  assert.match(clientSource, /return Boolean\(configuredBaseUrl\) && isExplicitLegacyWebApiFallbackEnabled\(\);/);
  assert.match(serviceSource, /import \{ legacyWebApiClient \} from '\.\.\/api\/kkApiClient';/);
  assert.match(serviceSource, /legacyWebApiClient\.listActiveCreditModels\(\)/);
  assert.doesNotMatch(serviceSource, /shouldUseLegacyWebApiFallback/);
  assert.doesNotMatch(serviceSource, /listActiveCreditModelsViaEdgeFunction/);
  assert.doesNotMatch(serviceSource, /listActiveCreditModelsViaSupabase/);
  assert.match(exchangeRateSource, /import \{ legacyWebApiClient \} from '\.\.\/api\/kkApiClient';/);
  assert.match(exchangeRateSource, /legacyWebApiClient\.listCreditExchangeRates\(/);
  assert.match(exchangeRateSource, /legacyWebApiClient\.upsertCreditExchangeRate\(/);
  assert.doesNotMatch(exchangeRateSource, /shouldUseLegacyWebApiFallback/);
  assert.doesNotMatch(exchangeRateSource, /import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/);
});
