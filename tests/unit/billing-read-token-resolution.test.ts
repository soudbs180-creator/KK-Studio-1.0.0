import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("billing read paths rely on shared kk api token refresh instead of a pinned session token", () => {
  const billingContextSource = readSource("src/context/BillingContext.tsx");

  assert.match(
    billingContextSource,
    /const response = await kkWebApiClient\.getCreditBalance\(\);/,
  );
  assert.match(
    billingContextSource,
    /const response = await kkWebApiClient\.listCreditTransactions\(\s*\{ limit: CREDIT_TRANSACTIONS_FETCH_LIMIT \},\s*\);/,
  );
  assert.doesNotMatch(
    billingContextSource,
    /const response = await kkWebApiClient\.getCreditBalance\(buildBillingRequestOptions\(apiAccessToken\)\);/,
  );
  assert.doesNotMatch(
    billingContextSource,
    /const response = await kkWebApiClient\.listCreditTransactions\(\s*\{ limit: CREDIT_TRANSACTIONS_FETCH_LIMIT \},\s*buildBillingRequestOptions\(apiAccessToken\),\s*\);/,
  );
});
