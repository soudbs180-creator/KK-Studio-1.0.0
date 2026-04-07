import assert from "node:assert/strict";
import test from "node:test";

import { resolveBillingRefreshMode } from "../../src/services/billing/billingRefreshMode.ts";

test("visible billing seed keeps background refresh silent", () => {
  assert.deepEqual(
    resolveBillingRefreshMode({
      silent: true,
      hasVisibleBillingSeed: true,
    }),
    {
      showBlockingLoading: false,
      markRefreshing: true,
    },
  );
});

test("manual refresh without a visible seed stays blocking", () => {
  assert.deepEqual(
    resolveBillingRefreshMode({
      silent: false,
      hasVisibleBillingSeed: false,
    }),
    {
      showBlockingLoading: true,
      markRefreshing: false,
    },
  );
});
