import assert from "node:assert/strict";
import test from "node:test";

import { isBillingAuthFailure } from "../../src/services/billing/billingApiAuth.ts";

test("treats billing auth envelope failures as non-fatal auth gaps", () => {
  assert.equal(
    isBillingAuthFailure({
      success: false,
      error: { code: "AUTH_REQUIRED" },
    }),
    true,
  );

  assert.equal(
    isBillingAuthFailure({
      success: false,
      error: { code: "HTTP_401" },
    }),
    true,
  );

  assert.equal(
    isBillingAuthFailure({
      success: false,
      error: { code: "http_403" },
    }),
    true,
  );
});

test("does not classify unrelated billing failures as auth gaps", () => {
  assert.equal(
    isBillingAuthFailure({
      success: true,
    }),
    false,
  );

  assert.equal(
    isBillingAuthFailure({
      success: false,
      error: { code: "NETWORK_ERROR" },
    }),
    false,
  );

  assert.equal(
    isBillingAuthFailure({
      success: false,
      error: { code: "HTTP_500" },
    }),
    false,
  );
});
