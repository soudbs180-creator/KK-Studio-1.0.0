import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  BILLING_DISABLED_MESSAGE,
  createBillingDisabledConsumeResult,
  createBillingDisabledRefundResult,
  createBillingRuntimeGuard,
} from '../../src/context/billingRuntimeGuard.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('billing bootstrap stays disabled for the fixed local user until a real KK API session exists', () => {
  assert.deepEqual(
    createBillingRuntimeGuard({
      userId: 'local-user',
      isTempUser: false,
      hasSession: false,
    }),
    {
      billingEnabled: true,
      activeBillingUserId: null,
      shouldBootstrapBilling: false,
    },
  );

  assert.deepEqual(
    createBillingRuntimeGuard({
      userId: 'local-user',
      isTempUser: false,
      hasSession: true,
    }),
    {
      billingEnabled: true,
      activeBillingUserId: 'local-user',
      shouldBootstrapBilling: true,
    },
  );
});

test('disabled billing operations resolve as safe no-ops', () => {
  assert.deepEqual(
    createBillingDisabledConsumeResult(12),
    {
      success: true,
      message: BILLING_DISABLED_MESSAGE,
    },
  );

  assert.deepEqual(
    createBillingDisabledRefundResult(),
    {
      success: true,
      message: BILLING_DISABLED_MESSAGE,
    },
  );
});

test('BillingContext wires the runtime guard into bootstrap and credit paths', () => {
  const billingSource = readSource('src/context/BillingContext.tsx');

  assert.match(
    billingSource,
    /createBillingRuntimeGuard\(\{\s*userId: user\?\.id,\s*isTempUser,\s*hasSession: Boolean\(session\?\.access_token\),\s*\}\)/s,
  );
  assert.match(
    billingSource,
    /const activeBillingUserId = billingRuntime\.activeBillingUserId;/,
  );
  assert.match(
    billingSource,
    /if \(!billingRuntime\.shouldBootstrapBilling\) \{\s*return undefined;\s*\}/s,
  );
  assert.match(
    billingSource,
    /return createBillingDisabledConsumeResult\(needAmount\);/,
  );
  assert.match(
    billingSource,
    /return createBillingDisabledRefundResult\(\);/,
  );
});
