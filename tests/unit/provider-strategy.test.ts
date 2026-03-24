import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveProviderRuntime } from "../../src/services/api/providerStrategy.ts";

describe("provider strategy", () => {
  test("treats hyphenated one-api hosts as NewAPI providers", () => {
    const runtime = resolveProviderRuntime({
      baseUrl: "https://one-api.bltcy.top/models",
    });

    assert.equal(runtime.strategyId, "newapi");
    assert.equal(runtime.providerFamily, "newapi-family");
    assert.equal(runtime.pricingSupport, "native");
    assert.equal(runtime.managementSupport, "native");
  });
});
