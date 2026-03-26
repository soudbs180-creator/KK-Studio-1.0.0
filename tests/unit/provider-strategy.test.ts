import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveProviderKeyType, resolveProviderRuntime } from "../../src/services/api/providerStrategy.ts";

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

  test("recognizes Wuyin direct async endpoints as native catalog providers", () => {
    const runtime = resolveProviderRuntime({
      baseUrl: "https://api.wuyinkeji.com/api/async/image_nanoBanana2",
    });

    assert.equal(runtime.strategyId, "wuyinkeji");
    assert.equal(runtime.providerFamily, "newapi-family");
    assert.equal(runtime.pricingSupport, "native");
    assert.equal(runtime.managementSupport, "native");
  });

  test("treats Google official hosts as official even for legacy custom provider slots", () => {
    assert.equal(
      resolveProviderKeyType("Custom", "https://generativelanguage.googleapis.com/v1beta"),
      "official",
    );
  });

  test("treats OpenAI official hosts as official when the slot still points to api.openai.com", () => {
    assert.equal(
      resolveProviderKeyType("OpenAI", "https://api.openai.com/v1"),
      "official",
    );
  });

  test("keeps non-official Google-compatible hosts out of the official bucket", () => {
    assert.equal(
      resolveProviderKeyType("Google", "https://api.newapi.pro/v1"),
      "proxy",
    );
  });
});
