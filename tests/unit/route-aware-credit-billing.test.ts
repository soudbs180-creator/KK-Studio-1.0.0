import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('generation and result billing logic stays route-aware for user-owned keys', () => {
  const appSource = readSource('src/App.tsx');
  const generationRuntimeSource = readSource('src/app/useGenerationRuntime.ts');
  const billingSource = readSource('src/utils/creditBilling.ts');
  const pricingSource = readSource('src/services/model/modelPricing.ts');

  assert.match(
    generationRuntimeSource,
    /const selectedKeyForBilling = keyManager\.getNextKey\(params\.config\.model, preferredKeyIdForBilling\);/,
  );
  assert.match(
    generationRuntimeSource,
    /selectedKeyForBilling\?\.id \|\| preferredKeyIdForBilling/,
  );
  assert.match(
    appSource,
    /const selectedKeyForBilling = billingStateContext\.selectedKeyForBilling;/,
  );
  assert.match(
    billingSource,
    /if \(target\.keySlotId && !routeResolvedAsCredits\) \{\s*return false;\s*\}/,
  );
  assert.match(
    pricingSource,
    /const resolvedRoute = keyManager\.getEffectiveKey\(preferredKeyId\) \|\| keyManager\.getKey\(preferredKeyId\);/,
  );
});
