import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readSource } from "../support/workspacePaths.js";

// 简体中文注释：测试 12AI 代理路由代码契约和关键逻辑实现
describe("12AI 自建 Key 代理路由契约测试 (12AI User Route Proxy Contract Tests)", () => {

  test("1. 12AI 路由策略识别逻辑应当在 user.js 中正确被配置和匹配", () => {
    // 简体中文注释：读取源码，核对 is12AI 是否按规格声明：匹配 requestProfileId, baseUrl, name
    const userRouteSource = readSource("server/routes/user.js");

    assert.match(userRouteSource, /is12AI = String\(route\.requestProfileId \|\| ''\)\.toLowerCase\(\)\.startsWith\('12ai'\)/);
    assert.match(userRouteSource, /\/12ai\/i\.test\(route\.baseUrl\)/);
    assert.match(userRouteSource, /\/12ai\/i\.test\(route\.name\)/);
  });

  test("2. 视频纵横比的映射应当符合 12AI 官方规范 (1280x720 / 720x1280)", () => {
    const userRouteSource = readSource("server/routes/user.js");

    // 简体中文注释：核对 handleTwelveAIVideoMode 内的 aspect_ratio -> size 转换
    assert.match(userRouteSource, /let size = '1280x720'/);
    assert.match(userRouteSource, /if \(aspectRatio === '9:16'\)/);
    assert.match(userRouteSource, /size = '720x1280'/);
    assert.match(userRouteSource, /size = '1024x1024'/);
  });

  test("3. 12AI 专属的异步任务状态查询与结果提取逻辑 (handleTwelveAITaskStatusMode)", () => {
    const userRouteSource = readSource("server/routes/user.js");

    // 简体中文注释：验证 12AI 状态轮询能自动根据 modelId 区分视频与图片任务，并从 result.urls 或 output 中提取最终资源链接
    assert.match(userRouteSource, /const isVideo = \/video\|sora\|veo\|omni\|vidu\/i\.test\(modelId\)/);
    assert.match(userRouteSource, /\/v1\/videos\/\$\{providerTaskId\}/);
    assert.match(userRouteSource, /\/v1\/task\/\$\{providerTaskId\}/);
    assert.match(userRouteSource, /resJson\.output/);
    assert.match(userRouteSource, /resJson\.result && Array\.isArray\(resJson\.result\.urls\)/);
  });

  test("4. 12AI 同步图片生成机制应当能够正确解析 Base64 并将其持久化至本地", () => {
    const userRouteSource = readSource("server/routes/user.js");

    // 简体中文注释：核对同步生图在 node 层将 base64 存盘的代码
    assert.match(userRouteSource, /path\.join\(__dirname, '\.\.\/uploads'\)/);
    assert.match(userRouteSource, /fs\.promises\.writeFile\(filePath, Buffer\.from\(imagePart\.inlineData\.data, 'base64'\)\)/);
    assert.match(userRouteSource, /const staticImageUrl = `\/uploads\/\$\{filename\}`/);
  });
});
