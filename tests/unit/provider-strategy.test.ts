import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  resolveProviderKeyType,
  resolveProviderModelCompatibilityIssue,
  resolveProviderRuntime,
} from "../../src/services/api/providerStrategy.ts";

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

  test("blocks 12AI routes from advertising unsupported Gemini image preview models", () => {
    assert.equal(
      resolveProviderModelCompatibilityIssue({
        provider: "12AI",
        baseUrl: "https://cdn.12ai.org",
        modelId: "gemini-3.1-flash-image-preview",
      }),
      "12AI 图片路由当前只支持 gemini-2.5-flash-image 和 gemini-3-pro-image-preview，当前模型 gemini-3.1-flash-image-preview 不在 12AI 文档支持列表中。",
    );
  });

  test("keeps supported 12AI Gemini image models and Google official preview models available", () => {
    assert.equal(
      resolveProviderModelCompatibilityIssue({
        provider: "12AI",
        baseUrl: "https://cdn.12ai.org",
        modelId: "gemini-3-pro-image-preview",
      }),
      null,
    );

    assert.equal(
      resolveProviderModelCompatibilityIssue({
        provider: "Google",
        baseUrl: "https://generativelanguage.googleapis.com",
        modelId: "gemini-3.1-flash-image-preview",
      }),
      null,
    );
  });

  test("forces GPT Best routes onto query auth even when legacy header auth is stored", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gpt-best.apifox.cn",
      format: "openai",
      authMethod: "header",
    });

    assert.equal(runtime.authMethod, "query");
  });
});
