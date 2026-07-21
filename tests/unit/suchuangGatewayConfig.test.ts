import assert from "node:assert/strict";
import { describe, test, before, after } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const apiGatewayConfig = require("../../services/api/utils/apiGatewayConfig.js");

describe("apiGatewayConfig 网关分流配置单元测试", () => {
  let originalProvider: string | undefined;
  let originalBaseUrl: string | undefined;

  before(() => {
    originalProvider = process.env.ACTIVE_API_PROVIDER;
    originalBaseUrl = process.env.SUCHUANG_BASE_URL;
  });

  after(() => {
    process.env.ACTIVE_API_PROVIDER = originalProvider;
    process.env.SUCHUANG_BASE_URL = originalBaseUrl;
  });

  test("1. getActiveGatewayProvider 正确识别 suchuang/yunwu/comfly 并做小写转换", () => {
    process.env.ACTIVE_API_PROVIDER = "SUCHUANG";
    assert.equal(apiGatewayConfig.getActiveGatewayProvider(), "suchuang");

    process.env.ACTIVE_API_PROVIDER = " YUNWU ";
    assert.equal(apiGatewayConfig.getActiveGatewayProvider(), "yunwu");

    process.env.ACTIVE_API_PROVIDER = "invalid_provider";
    assert.equal(apiGatewayConfig.getActiveGatewayProvider(), "");
  });

  test("2. getGatewayBaseUrl 对于 suchuang 能正确清洗与返回，有配置优先配置", () => {
    process.env.SUCHUANG_BASE_URL = "https://custom.suchuang.api/";
    assert.equal(apiGatewayConfig.getGatewayBaseUrl("suchuang"), "https://custom.suchuang.api");

    process.env.SUCHUANG_BASE_URL = "";
    assert.equal(apiGatewayConfig.getGatewayBaseUrl("suchuang"), apiGatewayConfig.SUCHUANG_DEFAULT_BASE_URL);
  });

  test("3. buildGatewayUrl 对于 suchuang 能够提炼出正确的端点，且绝不包含 key 参数", () => {
    process.env.SUCHUANG_BASE_URL = "https://api.suchuang.com";
    
    // 输入一个包含 key= 的 fallback 链接
    const fallbackWithKey = "https://api.wuyinkeji.com/api/async/image_gpt?key=sk-abc123456";
    const builtUrl = apiGatewayConfig.buildGatewayUrl("suchuang", "image", fallbackWithKey);
    
    // 应该拼装成 custom baseUrl + 端点路径，并且去掉 query 参数
    assert.equal(builtUrl, "https://api.suchuang.com/api/async/image_gpt");
    assert.doesNotMatch(builtUrl, /key=/);
  });
});
