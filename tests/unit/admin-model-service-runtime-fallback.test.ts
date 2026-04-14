import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('admin model loading uses the shared web API client while exchange rates remain API-only', () => {
  const clientSource = readSource('src/services/api/kkApiClient.ts');
  const serviceSource = readSource('src/services/model/adminModelService.ts');
  const routeUnitSource = readSource('src/services/model/adminRouteUnits.ts');
  const exchangeRateSource = readSource('src/services/billing/creditExchangeRateService.ts');

  assert.match(clientSource, /export function getLegacyWebApiFallbackState\(\): LegacyWebApiFallbackState \{/);
  assert.match(clientSource, /export function shouldUseLegacyWebApiFallback\(\): boolean \{\s*return getLegacyWebApiFallbackState\(\)\.enabled;\s*\}/);
  assert.match(clientSource, /const configuredBaseUrl = readRuntimeEnv\("VITE_KK_API_BASE_URL"\) \|\| "";/);
  assert.match(clientSource, /export function createKkWebApiClient\(\): KkApiClient \{/);
  assert.match(clientSource, /export const kkWebApiClient = createKkWebApiClient\(\);/);

  assert.match(serviceSource, /import \{ kkWebApiClient \} from '\.\.\/api\/kkApiClient(?:\.ts)?';/);
  assert.match(serviceSource, /buildCreditModelCatalog/);
  assert.match(serviceSource, /listActiveModels/);
  assert.match(serviceSource, /listActiveCreditModels/);
  assert.doesNotMatch(serviceSource, /listActiveCreditModelsViaEdgeFunction/);
  assert.doesNotMatch(serviceSource, /listActiveCreditModelsViaSupabase/);
  assert.match(routeUnitSource, /export function buildCreditModelCatalog/);
  assert.match(routeUnitSource, /export function pickCreditModelSpec/);

  assert.match(exchangeRateSource, /import \{ kkWebApiClient \} from '\.\.\/api\/kkApiClient(?:\.ts)?';/);
  assert.match(exchangeRateSource, /kkWebApiClient\.listCreditExchangeRates\(/);
  assert.match(exchangeRateSource, /kkWebApiClient\.upsertCreditExchangeRate\(/);
  assert.doesNotMatch(exchangeRateSource, /import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/);
});
