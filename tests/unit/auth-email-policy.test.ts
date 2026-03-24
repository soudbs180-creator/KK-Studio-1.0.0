import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validateAuthEmail } from "../../apps/api/src/modules/auth/domain/email-policy.ts";

describe("auth email policy", () => {
  test("accepts a normal email and normalizes casing", () => {
    const result = validateAuthEmail("User@Example.com");

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalizedEmail, "user@example.com");
    }
  });

  test("rejects malformed emails", () => {
    const result = validateAuthEmail("not-an-email");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /invalid/i);
    }
  });

  test("rejects disposable domains", () => {
    const result = validateAuthEmail("demo@mailinator.com");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /disposable/i);
    }
  });
});
