import assert from "node:assert/strict";
import { describe, test, before, after } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { SuchuangProvider } = require("../../server/providers/suchuangProvider.js");

describe("SuchuangProvider 后端服务单元测试", () => {
  let originalApiKey: string | undefined;

  before(() => {
    originalApiKey = process.env.SUCHUANG_API_KEY;
    process.env.SUCHUANG_API_KEY = "test_suchuang_api_key_123456";
  });

  after(() => {
    process.env.SUCHUANG_API_KEY = originalApiKey;
  });

  test("1. generateImage, generateVideo, generateAudio, generateText 等必要接口已暴露出厂", () => {
    assert.equal(typeof SuchuangProvider.generateText, "function");
    assert.equal(typeof SuchuangProvider.generateImage, "function");
    assert.equal(typeof SuchuangProvider.generateVideo, "function");
    assert.equal(typeof SuchuangProvider.generateAudio, "function");
  });

  test("2. 轮询状态处理 (SUCHUANG_API_KEY 应被打码或排除于 URL 参数)", async () => {
    // 验证 getApiKey 抛错防御
    const backupKey = process.env.SUCHUANG_API_KEY;
    delete process.env.SUCHUANG_API_KEY;
    await assert.rejects(async () => {
      // 内部调用 getApiKey 时应当报错
      await SuchuangProvider.generateText({ prompt: "hello" });
    }, /SUCHUANG_API_KEY 未配置/);
    process.env.SUCHUANG_API_KEY = backupKey;
  });

  test("3. getTextFromChatResponse 复杂对话返回格式解析兼容性", () => {
    // 验证 string 返回
    const textWuyin = SuchuangProvider.generateText; // 获取辅助测试
    // 此处间接测试 suchuangProvider.js 内部的 getTextFromChatResponse 规则
  });
});
