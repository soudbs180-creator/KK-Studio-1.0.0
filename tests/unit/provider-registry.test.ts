// tests/unit/provider-registry.test.ts
// 中文注释：供应商注册表与 Schema 单元测试

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { safeValidateProviderItem } from "../../packages/shared/src/index.ts";
import { getProvider, listProviders, listModels } from "../../server/lib/dispatcher/providerRegistry.js";

describe("Provider Registry & Zod Schema Tests", () => {
  
  describe("Shared Zod Schema Validation", () => {
    test("successfully validates a valid official provider item", () => {
      const validItem = {
        id: "openai-official-test",
        kind: "official",
        displayName: "OpenAI Official Test",
        host: "api.openai.com",
        apiFormat: "openai",
        auth: {
          method: "bearer",
          keyRef: "OPENAI_API_KEY"
        },
        endpoints: {
          base: "https://api.openai.com/v1",
          chat: "/chat/completions"
        },
        pricingSource: {
          sourceType: "local_fallback",
          fallbackFile: "default"
        },
        capabilities: ["chat"]
      };

      const result = safeValidateProviderItem(validItem);
      assert.ok(result.success, "应成功校验通过");
    });

    test("successfully validates a valid relay provider item", () => {
      const validRelay = {
        id: "vodeshop-relay-test",
        kind: "relay",
        displayName: "Vodeshop Relay Test",
        host: "future-api.vodeshop.com",
        apiFormat: "openai",
        auth: {
          method: "bearer",
          keyRef: "VODESHOP_API_KEY" // 密钥解耦，合规
        },
        endpoints: {
          base: "https://future-api.vodeshop.com/v1"
        },
        pricingSource: {
          sourceType: "online",
          url: "https://future-api.vodeshop.com/prices"
        },
        capabilities: ["chat", "image"]
      };

      const result = safeValidateProviderItem(validRelay);
      assert.ok(result.success, "应成功校验通过");
    });

    test("fails validation when required fields are missing", () => {
      const invalidItem = {
        id: "openai-official-test",
        // 缺少 kind 字段
        displayName: "OpenAI Official Test",
        host: "api.openai.com",
        apiFormat: "openai"
      };

      const result = safeValidateProviderItem(invalidItem);
      assert.ok(!result.success, "缺少必填字段应校验失败");
    });

    test("fails validation when invalid enum values are provided", () => {
      const invalidItem = {
        id: "openai-official-test",
        kind: "unknown-kind-value", // 错误的 kind
        displayName: "OpenAI Official Test",
        host: "api.openai.com",
        apiFormat: "openai",
        auth: {
          method: "bearer",
          keyRef: "OPENAI_API_KEY"
        },
        endpoints: {
          base: "https://api.openai.com/v1"
        },
        pricingSource: {
          sourceType: "local_fallback"
        }
      };

      const result = safeValidateProviderItem(invalidItem);
      assert.ok(!result.success, "错误的枚举值应校验失败");
    });
  });

  describe("Backend ProviderRegistry Initialization & APIs", () => {
    test("correctly retrieves list of all validated providers", () => {
      const providers = listProviders();
      assert.ok(Array.isArray(providers), "返回值应为数组");
      assert.ok(providers.length > 0, "应包含已初始化的供应商条目");
      
      // 断言每个条目都符合 ProviderItem 规约
      for (const item of providers) {
        assert.ok(typeof item.id === "string" && item.id.length > 0);
        assert.ok(["official", "relay", "byok-reverse-proxy"].includes(item.kind));
        assert.ok(typeof item.host === "string" && item.host.length > 0);
      }
    });

    test("retrieves individual provider by id", () => {
      const geminiOfficial = getProvider("google-gemini-official");
      assert.ok(geminiOfficial, "应当能检索到 google-gemini-official 供应商");
      assert.equal(geminiOfficial.id, "google-gemini-official");
      assert.equal(geminiOfficial.kind, "official");
      assert.equal(geminiOfficial.apiFormat, "gemini");
      assert.equal(geminiOfficial.auth.keyRef, "GEMINI_API_KEY");
    });

    test("returns null for non-existent provider", () => {
      const none = getProvider("non-existent-provider-id");
      assert.equal(none, null);
    });

    test("retrieves models supported by a provider", () => {
      const models = listModels("google-gemini-official");
      assert.ok(Array.isArray(models), "应返回模型数组");
      assert.ok(models.includes("gemini-2.5-flash"), "应包含 fallback 列表中配置的模型");
    });
  });

});
