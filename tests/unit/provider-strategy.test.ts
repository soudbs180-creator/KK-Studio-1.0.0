import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  detectGptBestEvidence,
  resolveProviderKeyType,
  resolveProviderModelCompatibilityIssue,
  resolveProviderRuntime,
  shouldBypassChatCompatibilityForImages,
} from "../../apps/web/src/services/api/providerStrategy.ts";

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
      baseUrl: "https://api.wuyinkeji.com/api/async/detail",
    });

    assert.equal(runtime.strategyId, "wuyinkeji");
    assert.equal(runtime.providerFamily, "newapi-family");
    assert.equal(runtime.pricingSupport, "native");
    assert.equal(runtime.managementSupport, "native");
  });

  test("routes Wuyin Google Omni video endpoints through the dedicated async-video style", () => {
    const runtime = resolveProviderRuntime({
      baseUrl: "https://api.wuyinkeji.com/api/async/video_google_omni",
    });

    assert.equal(runtime.strategyId, "wuyinkeji");
    assert.equal(runtime.videoApiStyle, "wuyin-async-video");
    assert.equal(runtime.authorizationValueFormat, "raw");
    assert.equal(runtime.headerName, "Authorization");
  });

  test("prefers request profile registry aliases before provider strategy fallback patterns", () => {
    const runtime = resolveProviderRuntime({
      provider: "Wu Yin",
      format: "openai",
    });

    assert.equal(runtime.requestProfileId, "wuyinkeji");
    assert.equal(runtime.strategyId, "wuyinkeji");
    assert.equal(runtime.providerFamily, "newapi-family");
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

  test("treats request profile official aliases as official keys even without host evidence", () => {
    const runtime = resolveProviderRuntime({
      provider: "OpenAI Official",
      format: "openai",
    });

    assert.equal(runtime.requestProfileId, "openai-official");
    assert.equal(runtime.strategyId, "openai");
    assert.equal(resolveProviderKeyType("OpenAI Official"), "official");
  });

  test("keeps non-official Google-compatible hosts out of the official bucket", () => {
    assert.equal(
      resolveProviderKeyType("Google", "https://api.newapi.pro/v1"),
      "proxy",
    );
  });

  test("keeps 12AI async-image preview models available", () => {
    assert.equal(
      resolveProviderModelCompatibilityIssue({
        provider: "12AI",
        baseUrl: "https://cdn.12ai.org",
        modelId: "gemini-3.1-flash-image-preview",
      }),
      null,
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

  test("still blocks unknown 12AI image models", () => {
    assert.equal(
      resolveProviderModelCompatibilityIssue({
        provider: "12AI",
        baseUrl: "https://cdn.12ai.org",
        modelId: "gemini-4-flash-image-preview",
      }),
      "12AI 图片路由当前只支持 gemini-2.5-flash-image、gemini-3.1-flash-image-preview 和 gemini-3-pro-image-preview，当前模型 gemini-4-flash-image-preview 不在 12AI 文档支持列表中。",
    );
  });

  test("keeps GPT Best on bearer-header auth even when legacy query auth is stored", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gpt-best.apifox.cn",
      format: "openai",
      authMethod: "query",
    });

    assert.equal(runtime.authMethod, "header");
    assert.equal(runtime.headerName, "Authorization");
    assert.equal(runtime.authorizationValueFormat, "bearer");
  });

  test("recognizes GPT Best provider aliases with spaces", () => {
    const runtime = resolveProviderRuntime({
      provider: "gpt best",
      format: "openai",
    });

    assert.equal(runtime.strategyId, "gpt-best");
    assert.equal(runtime.requestProfileId, "gpt-best");
    assert.equal(runtime.authMethod, "header");
  });

  test("keeps GPT Best as surface-first multi-protocol provider", () => {
    const runtime = resolveProviderRuntime({
      provider: "GPT Best",
      baseUrl: "https://gateway.example.com/v1",
      format: "openai",
      compatibilityMode: "chat",
    });

    assert.equal(runtime.strategyId, "gpt-best");
    assert.deepEqual(runtime.supportedProtocolFamilies, [
      "openai-compatible",
      "gemini-native",
      "claude-native",
    ]);
    assert.equal(runtime.imageRoutingPolicy, "surface-first");
    assert.equal(runtime.pricingSupport, "native");
    assert.equal(runtime.managementSupport, "native");
    assert.equal(shouldBypassChatCompatibilityForImages(runtime), true);
  });

  test("falls back unknown local providers to the 12AI request profile without changing their strategy id", () => {
    const runtime = resolveProviderRuntime({
      provider: "Custom",
      baseUrl: "https://unknown-provider.example.com/v1",
      format: "openai",
    });

    assert.equal(runtime.strategyId, "generic-openai");
    assert.equal(runtime.requestProfileId, "12ai");
  });

  test("marks GPT Best llms.txt as provider evidence but not an API base", () => {
    const evidence = detectGptBestEvidence({
      baseUrl: "https://gpt-best.apifox.cn/llms.txt",
    });

    assert.equal(evidence.providerId, "gpt-best");
    assert.equal(evidence.sourceType, "docs-url");
    assert.equal(evidence.isDocumentationUrl, true);
    assert.equal(evidence.canUseAsApiBaseUrl, false);
  });

  test("keeps GPT Best explicit provider aliases usable with non-doc API hosts", () => {
    const evidence = detectGptBestEvidence({
      provider: "GPT Best",
      baseUrl: "https://gateway.example.com/v1",
    });

    assert.equal(evidence.providerId, "gpt-best");
    assert.equal(evidence.sourceType, "explicit-provider");
    assert.equal(evidence.isDocumentationUrl, false);
    assert.equal(evidence.canUseAsApiBaseUrl, true);
  });

  test("recognizes New Suxi aliases and claude-native routing", () => {
    const runtime = resolveProviderRuntime({
      provider: "New Suxi AI",
      baseUrl: "https://new.suxi.ai",
      format: "claude",
    });

    assert.equal(runtime.strategyId, "suxi");
    assert.equal(runtime.protocolFamily, "claude-native");
    assert.equal(runtime.authMethod, "header");
    assert.equal(runtime.headerName, "Authorization");
    assert.equal(runtime.authorizationValueFormat, "bearer");
  });

  test("keeps New Suxi image traffic on dedicated surfaces even when chat compatibility is stored", () => {
    const runtime = resolveProviderRuntime({
      provider: "New Suxi AI",
      baseUrl: "https://new.suxi.ai",
      compatibilityMode: "chat",
    });

    assert.equal(runtime.imageRoutingPolicy, "surface-first");
    assert.equal(shouldBypassChatCompatibilityForImages(runtime), true);
  });

  test("keeps generic custom providers on chat-first image routing by default", () => {
    const runtime = resolveProviderRuntime({
      provider: "Custom",
      baseUrl: "https://example.com/v1",
      compatibilityMode: "chat",
    });

    assert.equal(runtime.imageRoutingPolicy, "chat-first");
    assert.equal(shouldBypassChatCompatibilityForImages(runtime), false);
  });

  test("recognizes Flow2API and defaults it to chat-first OpenAI compatibility", () => {
    const runtime = resolveProviderRuntime({
      provider: "Flow2API",
      baseUrl: "http://127.0.0.1:8000",
      format: "openai",
    });

    assert.equal(runtime.strategyId, "flow2api");
    assert.equal(runtime.protocolFamily, "openai-compatible");
    assert.equal(runtime.compatibilityMode, "chat");
    assert.equal(runtime.imageRoutingPolicy, "chat-first");
    assert.equal(runtime.authMethod, "header");
    assert.equal(runtime.headerName, "Authorization");
  });

  test("blocks Flow2API video models until KK-Studio task polling is adapted", () => {
    assert.match(
      String(resolveProviderModelCompatibilityIssue({
        provider: "Flow2API",
        baseUrl: "http://127.0.0.1:8000",
        modelId: "veo_3_1_t2v_fast_landscape",
      }) || ""),
      /Flow2API/,
    );
  });
});
