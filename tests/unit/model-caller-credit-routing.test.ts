import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('credit model calls stay on the Supabase secure proxy path and never fall back to local billing writes', () => {
  const source = readSource('src/services/model/modelCaller.ts');

  assert.doesNotMatch(source, /legacyWebApiClient/);
  assert.doesNotMatch(source, /buildBillingRequestId/);
  assert.doesNotMatch(source, /buildBillingRequestOptions/);
  assert.doesNotMatch(source, /getCreditBalance\(/);
  assert.doesNotMatch(source, /debitCredits\(/);
  assert.doesNotMatch(source, /private async deductCredits\(/);
  assert.match(source, /const response = await callSecureSystemProxyChat\(\{/);
  assert.match(source, /if \(!response\.deducted\) \{/);
  assert.match(source, /Secure system proxy returned success without confirming credit deduction/);
  assert.match(source, /Credit settlement could not be confirmed\. Please retry the request\./);
});
