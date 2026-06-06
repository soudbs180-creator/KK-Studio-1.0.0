import assert from "node:assert/strict";
import { describe, test, before, after } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const crawler = require("../../server/lib/wuyinCatalogCrawler.js");
const executor = require("../../server/lib/wuyinModelExecutor.js");

describe("速创 API 重构专项单元测试", () => {
  let originalFetch: typeof globalThis.fetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  // 辅助方法：Mock 全局 fetch 的响应
  function mockFetchResponse(payload: any, ok = true, status = 200) {
    globalThis.fetch = async () => {
      return {
        ok,
        status,
        text: async () => JSON.stringify(payload),
        json: async () => payload,
      } as any;
    };
  }

  test("1. 重名模型区分测试 (grok_imagine & Wan2.6)", () => {
    const catalog = crawler.getCachedWuyinCatalog();
    
    // 验证 grok_imagine 区分图片和视频
    const imageGrok = catalog.find(item => item.id === "image_grok_imagine");
    const videoGrok = catalog.find(item => item.id === "video_grok_imagine");

    assert.ok(imageGrok, "应当存在图片版 grok_imagine");
    assert.ok(videoGrok, "应当存在视频版 grok_imagine");
    assert.equal(imageGrok.kind, "image");
    assert.equal(videoGrok.kind, "video");
    assert.equal(imageGrok.endpointPath, "/api/async/image_grok_imagine");
    assert.equal(videoGrok.endpointPath, "/api/async/video_grok_imagine");

    // 验证 Wan2.6 区分图片和视频
    const imageWan = catalog.find(item => item.id === "image_wan2.6");
    const videoWan = catalog.find(item => item.id === "video_wan2.6");

    assert.ok(imageWan, "应当存在图片版 Wan2.6");
    assert.ok(videoWan, "应当存在视频版 Wan2.6");
    assert.equal(imageWan.kind, "image");
    assert.equal(videoWan.kind, "video");
    assert.equal(imageWan.endpointPath, "/api/async/image_wan2.6");
    assert.equal(videoWan.endpointPath, "/api/async/video_wan2.6");
  });

  test("2. Sora2 特殊异步状态码映射测试 (1=success, 2=failed, 0/3=processing)", async () => {
    const sora2Item = {
      id: "sora2-new",
      detailPath: "/api/sora2/detail",
      detailStatusMode: "sora2"
    };

    // 2.1 模拟 sora2 成功且返回视频 URL
    mockFetchResponse({
      code: 200,
      status: 1, // Sora2 成功是 1
      data: {
        id: "video_sora_123",
        status: 1,
        result: ["https://openpt1.wuyinkeji.com/sora2_video.mp4"]
      },
      exec_time: 1.2
    });

    const successRes = await executor.checkWuyinTaskStatus({
      catalogItem: sora2Item,
      apiKey: "test-key",
      providerTaskId: "video_sora_123",
      submitExecTime: 0.5
    });

    assert.equal(successRes.status, "success");
    assert.deepEqual(successRes.urls, ["https://openpt1.wuyinkeji.com/sora2_video.mp4"]);
    assert.equal(successRes.totalExecTime, 1.7);

    // 2.2 模拟 sora2 失败
    mockFetchResponse({
      code: 200,
      status: 2, // Sora2 失败是 2
      message: "资源不足，生成失败",
      data: {
        id: "video_sora_123",
        status: 2
      }
    });

    const failedRes = await executor.checkWuyinTaskStatus({
      catalogItem: sora2Item,
      apiKey: "test-key",
      providerTaskId: "video_sora_123"
    });

    assert.equal(failedRes.status, "failed");
    assert.equal(failedRes.message, "资源不足，生成失败");

    // 2.3 模拟 sora2 生成中 (状态 3)
    mockFetchResponse({
      code: 200,
      status: 3, // Sora2 生成中是 3
      data: {
        id: "video_sora_123",
        status: 3
      }
    });

    const processingRes = await executor.checkWuyinTaskStatus({
      catalogItem: sora2Item,
      apiKey: "test-key",
      providerTaskId: "video_sora_123"
    });

    assert.equal(processingRes.status, "processing");
  });

  test("3. 图片异步 pending 状态判定（urls为空降级判定为 processing/pending 且不报错）", async () => {
    const imageItem = {
      id: "image_nanoBanana2",
      detailPath: "/api/async/detail",
      detailStatusMode: "wuyin-async"
    };

    // 3.1 模拟标准状态为 2 (成功)，但 result 为空的情况，验证降级为 processing
    mockFetchResponse({
      code: 200,
      data: {
        task_id: "image_banana_123",
        status: 2, // wuyin-async 成功是 2
        result: [] // 空列表
      }
    });

    const emptyResultRes = await executor.checkWuyinTaskStatus({
      catalogItem: imageItem,
      apiKey: "test-key",
      providerTaskId: "image_banana_123"
    });

    assert.equal(emptyResultRes.status, "processing", "在 result 为空时应降级判定为 processing，不直接报错");
    assert.deepEqual(emptyResultRes.urls, [], "urls 应当为空");

    // 3.2 模拟标准状态为 0 (排队中)
    mockFetchResponse({
      code: 200,
      data: {
        task_id: "image_banana_123",
        status: 0,
        result: []
      }
    });

    const queueRes = await executor.checkWuyinTaskStatus({
      catalogItem: imageItem,
      apiKey: "test-key",
      providerTaskId: "image_banana_123"
    });

    assert.equal(queueRes.status, "processing");
  });

  test("4. 通用执行器按具体 Wuyin endpoint 构造请求体和序列化格式", () => {
    const build = (executor as any).buildWuyinSubmitRequestBody as (catalogItem: any, input: any) => any;
    const serialize = (executor as any).serializeWuyinRequestBody as (body: any, contentType: string) => string;

    assert.deepEqual(
      build(
        { id: "image_gpt", kind: "image" },
        { prompt: "cat", aspectRatio: "16:9", imageSize: "4K", referenceImages: ["https://cdn.example.com/ref.png"] },
      ),
      {
        prompt: "cat",
        size: "16:9",
        urls: ["https://cdn.example.com/ref.png"],
      },
    );

    assert.deepEqual(
      build(
        { id: "image_nanoBanana", kind: "image" },
        { prompt: "cat", imageSize: "4K", aspectRatio: "1:1" },
      ),
      {
        prompt: "cat",
        size: "4K",
        aspectRatio: "1:1",
      },
    );

    const wanBody = build(
      { id: "image_wan2.6", kind: "image" },
      { prompt: "cat", aspectRatio: "16:9", referenceImages: ["https://cdn.example.com/ref.png"] },
    );
    assert.deepEqual(wanBody, {
      prompt: "cat",
      size: "1696*960",
      urls: ["https://cdn.example.com/ref.png"],
    });
    const wanParams = new URLSearchParams(serialize(wanBody, "application/x-www-form-urlencoded"));
    assert.equal(wanParams.get("size"), "1696*960");
    assert.equal(wanParams.get("urls"), "https://cdn.example.com/ref.png");

    assert.deepEqual(
      build(
        { id: "video_grok_imagine", kind: "video" },
        { prompt: "cat video", aspectRatio: "16:9", imageUrl: "https://cdn.example.com/ref.png" },
      ),
      {
        prompt: "cat video",
        duration: "10",
        aspect_ratio: "16:9",
        image_urls: ["https://cdn.example.com/ref.png"],
      },
    );

    assert.throws(
      () => build({ id: "video_package", kind: "video" }, { prompt: "package" }),
      /Package_1\.0/,
    );

    assert.deepEqual(
      build(
        { id: "audio_tts", kind: "audio" },
        { prompt: "hello" },
      ),
      {
        text: "hello",
        voice_id: "male-qn-qingse",
        speed: 1,
        language_boost: "auto",
      },
    );
  });

  test("5. local_proxy task id 可以携带模型 ID 以便选择正确 detail 接口", () => {
    const encoded = executor.encodeLocalProxyTaskId("slot_wuyin", "s_123", "sora2-new");
    assert.equal(encoded, "local_proxy:slot_wuyin:s_123:sora2-new");

    const parsed = executor.decodeLocalProxyTaskId(encoded);
    assert.deepEqual(parsed, {
      routeId: "slot_wuyin",
      providerTaskId: "s_123",
      modelId: "sora2-new",
    });
  });
});
