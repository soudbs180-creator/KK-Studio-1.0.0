import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readSource } from "../support/workspacePaths.js";

describe("后端 /api/config/keys 安全状态路由契约测试", () => {
  test("1. 路由注册正确，且没有直接泄露敏感密钥", () => {
    // 简体中文注释：使用源码契约测试进行校验，以防在没有 express/supertest 依赖的根目录下导致测试阻断
    const source = readSource("server/routes/config.js");
    assert.match(source, /\/config\/keys/);
    assert.match(source, /ACTIVE_API_PROVIDER: activeProvider/);
    assert.match(source, /SUCHUANG_API_KEY: hasSuchuangKey/);
    assert.doesNotMatch(source, /process\.env\.SUCHUANG_API_KEY\s*[,}]/); // 确保未泄漏明文
  });
});
