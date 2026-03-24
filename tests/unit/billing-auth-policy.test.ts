import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { authorizeInternalBillingRequest } from "../../apps/api/src/modules/billing/domain/billing-auth-policy.ts";

describe("billing auth policy", () => {
  const originalToken = process.env.BILLING_INTERNAL_TOKEN;

  afterEach(() => {
    if (typeof originalToken === "undefined") {
      delete process.env.BILLING_INTERNAL_TOKEN;
      return;
    }

    process.env.BILLING_INTERNAL_TOKEN = originalToken;
  });

  test("rejects requests when internal token is missing", () => {
    delete process.env.BILLING_INTERNAL_TOKEN;

    const result = authorizeInternalBillingRequest({ headers: {} });
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
  });

  test("accepts matching internal header token", () => {
    process.env.BILLING_INTERNAL_TOKEN = "secret-token";

    const result = authorizeInternalBillingRequest({
      headers: {
        "x-billing-internal-token": "secret-token",
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
  });

  test("rejects mismatched bearer token", () => {
    process.env.BILLING_INTERNAL_TOKEN = "secret-token";

    const result = authorizeInternalBillingRequest({
      headers: {
        authorization: "Bearer wrong-token",
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });
});
