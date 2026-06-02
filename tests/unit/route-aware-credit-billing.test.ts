import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('generation and result billing logic stays route-aware for user-owned keys', () => {
  const appSource = readSource('apps/web/src/App.tsx');
  const generationRuntimeSource = readSource('apps/web/src/app/useGenerationRuntime.ts');
  const billingSource = readSource('apps/web/src/utils/creditBilling.ts');
  const pricingSource = readSource('apps/web/src/services/model/modelPricing.ts');

  assert.match(
    generationRuntimeSource,
    /const selectedKeyForBilling = keyManager\.getNextKey\(params\.config\.model, preferredKeyIdForBilling\);/,
  );
  assert.match(
    generationRuntimeSource,
    /selectedKeyForBilling\?\.id \|\| preferredKeyIdForBilling/,
  );
  assert.match(
    generationRuntimeSource,
    /selectedKeyForBilling: initialSubmissionContext\.selectedKeyForBilling,/,
  );
  assert.doesNotMatch(appSource, /const selectedKeyForBilling = initialSubmissionContext\.selectedKeyForBilling;/);
  assert.match(
    billingSource,
    /if \(target\.keySlotId && !routeResolvedAsCredits\) \{\s*return false;\s*\}/,
  );
  assert.match(
    pricingSource,
    /const resolvedRoute = keyManager\.getEffectiveKey\(preferredKeyId\) \|\| keyManager\.getKey\(preferredKeyId\);/,
  );
});
