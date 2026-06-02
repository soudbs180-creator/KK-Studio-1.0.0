import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverWuyinProxy = require("../../server/lib/wuyinAsyncVideoProxy.js") as {
  resolveWuyinImageEndpointPath: (modelId: string) => string;
  buildWuyinImageRequestBody: (input: any) => any;
  extractWuyinOutputUrls: (payload: any) => string[];
  normalizeWuyinVideoBaseUrl: (baseUrl: string) => string;
  isWuyinAsyncVideoRoute: (route: any, modelId?: string) => boolean;
};

describe("速创 API 图片模型路由与适配契约测试 (Wuyin Image Proxy Contract Tests)", () => {
  
  test("1. 正确解析与转换速创专属图片模型 ID 对应的 API Endpoint 路径", () => {
    // 简体中文注释：测试各模型是否能转换为对应的速创专有异步图片接口端点
    assert.equal(
      serverWuyinProxy.resolveWuyinImageEndpointPath("image_nanoBanana2@slot_key_123"),
      "/api/async/image_nanoBanana2"
    );
    assert.equal(
      serverWuyinProxy.resolveWuyinImageEndpointPath("image_nanoBanana_pro"),
      "/api/async/image_nanoBanana_pro"
    );
    assert.equal(
      serverWuyinProxy.resolveWuyinImageEndpointPath("image_nanoBanana"),
      "/api/async/image_nanoBanana"
    );
    assert.equal(
      serverWuyinProxy.resolveWuyinImageEndpointPath("image_gpt"),
      "/api/async/image_gpt"
    );
    assert.equal(
      serverWuyinProxy.resolveWuyinImageEndpointPath("image_grok_imagine"),
      "/api/async/image_grok_imagine"
    );
    assert.equal(
      serverWuyinProxy.resolveWuyinImageEndpointPath("image_wan2.6"),
      "/api/async/image_wan2.6"
    );

    // 简体中文注释：异常流检测，未知或错误的速创图片模型抛出 Error
    assert.throws(() => {
      serverWuyinProxy.resolveWuyinImageEndpointPath("unknown_wuyin_model");
    }, /Unknown Wuyin image model/);
  });

  test("2. 规范化并清洗速创图片请求体 (buildWuyinImageRequestBody)", () => {
    // 简体中文注释：测试请求体参数（包含分辨率、纵横比、多图参考列表）的提取清洗
    const inputPayload = {
      prompt: "生成一幅赛博朋克猫咪插画",
      aspectRatio: "16:9",
      imageSize: "2K",
      referenceImages: [
        "https://example.com/ref1.png",
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "  plain_base64_data_without_uri_header  "
      ]
    };

    const requestBody = serverWuyinProxy.buildWuyinImageRequestBody(inputPayload);

    assert.equal(requestBody.prompt, "生成一幅赛博朋克猫咪插画");
    assert.equal(requestBody.size, "2K");
    assert.equal(requestBody.imageSize, "2K");
    assert.equal(requestBody.aspectRatio, "16:9");
    
    // 简体中文注释：验证 Base64 去除了 data: 前缀与换行空格
    assert.deepEqual(requestBody.urls, [
      "https://example.com/ref1.png",
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "plain_base64_data_without_uri_header"
    ]);
  });

  test("3. 深度递归提取 API 多层嵌套响应中的有效图片 URL (extractWuyinOutputUrls)", () => {
    // 简体中文注释：测试从速创各种复杂数据包中深度提取图片链接
    const complexPayload = {
      code: 200,
      msg: "success",
      data: {
        status: 2,
        result: "生成的图像存放在：https://img.wuyinkeji.com/out1.png 以及 https://img.wuyinkeji.com/out2.png",
        details: {
          image_url: "https://img.wuyinkeji.com/out3.png",
          imageUrl: "https://img.wuyinkeji.com/out4.png"
        },
        outputs: [
          "https://img.wuyinkeji.com/out5.png",
          { url: "https://img.wuyinkeji.com/out6.png" }
        ]
      }
    };

    const extractedUrls = serverWuyinProxy.extractWuyinOutputUrls(complexPayload);
    
    assert.ok(extractedUrls.includes("https://img.wuyinkeji.com/out1.png"));
    assert.ok(extractedUrls.includes("https://img.wuyinkeji.com/out2.png"));
    assert.ok(extractedUrls.includes("https://img.wuyinkeji.com/out3.png"));
    assert.ok(extractedUrls.includes("https://img.wuyinkeji.com/out4.png"));
    assert.ok(extractedUrls.includes("https://img.wuyinkeji.com/out5.png"));
    assert.ok(extractedUrls.includes("https://img.wuyinkeji.com/out6.png"));
    assert.equal(extractedUrls.length, 6);
  });

  test("4. 识别速创异步图片模型渠道判定 (isWuyinAsyncVideoRoute)", () => {
    // 简体中文注释：验证只要是速创域名或名称中带 wuyin，就被判定为速创异步模型路由
    const route1 = { name: "速创科技通道", baseUrl: "https://api.wuyinkeji.com/api/async" };
    const route2 = { name: "Other Channel", baseUrl: "https://api.wuyinkeji.com" };
    const route3 = { name: "wuyin-model", baseUrl: "https://some-proxy.com" };
    const route4 = { name: "Google Official", baseUrl: "https://generativelanguage.googleapis.com" };

    assert.equal(serverWuyinProxy.isWuyinAsyncVideoRoute(route1), true);
    assert.equal(serverWuyinProxy.isWuyinAsyncVideoRoute(route2), true);
    assert.equal(serverWuyinProxy.isWuyinAsyncVideoRoute(route3), true);
    assert.equal(serverWuyinProxy.isWuyinAsyncVideoRoute(route4), false);
  });
});
