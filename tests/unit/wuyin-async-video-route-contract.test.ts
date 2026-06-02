import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

import {
  buildWuyinVideoDetailUrl,
  buildWuyinVideoRequestBody,
  buildWuyinVideoSubmitUrl,
  extractWuyinVideoEndpointPath,
  extractWuyinVideoStatusCode,
  extractWuyinVideoTaskId,
  extractWuyinVideoUrl,
  mapWuyinVideoStatus,
  normalizeWuyinVideoBaseUrl,
  normalizeWuyinVideoImages,
  resolveWuyinVideoRequestRoute,
  resolveWuyinVideoSize,
} from "../../apps/web/src/services/llm/wuyinAsyncVideoRoute.ts";

const require = createRequire(import.meta.url);
const serverWuyinVideoProxy = require("../../server/lib/wuyinAsyncVideoProxy.js") as {
  encodeLocalProxyTaskId: (routeId: string, providerTaskId: string) => string;
  decodeLocalProxyTaskId: (localTaskId: string) => { routeId: string; providerTaskId: string };
  isWuyinAsyncVideoTargetUrl: (targetUrl: string) => boolean;
};

describe("Wuyin async-video route helpers", () => {
  test("normalizes Google Omni base URLs and request route URLs", () => {
    assert.equal(normalizeWuyinVideoBaseUrl(""), "https://api.wuyinkeji.com");
    assert.equal(normalizeWuyinVideoBaseUrl("api.wuyinkeji.com/doc/72"), "https://api.wuyinkeji.com");
    assert.equal(
      normalizeWuyinVideoBaseUrl("https://proxy.example.com/root/api/async/video_google_omni"),
      "https://proxy.example.com/root",
    );
    assert.equal(
      extractWuyinVideoEndpointPath("api.wuyinkeji.com/api/async/video_google_omni"),
      "/api/async/video_google_omni",
    );

    const route = resolveWuyinVideoRequestRoute({
      baseUrl: "https://api.wuyinkeji.com/api/async/video_google_omni",
      modelId: "ignored",
    });
    assert.deepEqual(route, {
      endpointPath: "/api/async/ignored",
      endpointModelId: "ignored",
    });
    assert.equal(
      buildWuyinVideoSubmitUrl("https://api.wuyinkeji.com/api/async/video_google_omni", route),
      "https://api.wuyinkeji.com/api/async/ignored",
    );
    assert.equal(
      buildWuyinVideoDetailUrl("https://api.wuyinkeji.com/api/async/video_google_omni", "task 1"),
      "https://api.wuyinkeji.com/api/async/detail?id=task%201",
    );
    assert.deepEqual(
      resolveWuyinVideoRequestRoute({
        baseUrl: "https://api.wuyinkeji.com",
        modelId: "veo3.1_fast",
      }),
      {
        endpointPath: "/api/async/video_veo3.1_fast",
        endpointModelId: "video_veo3.1_fast",
      },
    );
    assert.deepEqual(
      resolveWuyinVideoRequestRoute({
        baseUrl: "https://api.wuyinkeji.com",
        modelId: "Wan2.6",
      }),
      {
        endpointPath: "/api/async/video_wan2.6",
        endpointModelId: "video_wan2.6",
      },
    );
  });

  test("builds the documented Wuyin video body from shared video options", () => {
    assert.equal(resolveWuyinVideoSize({ aspectRatio: "16:9", resolution: "720p" }), "1280x720");
    assert.equal(resolveWuyinVideoSize({ aspectRatio: "9:16", resolution: "1080p" }), "1080x1920");
    assert.equal(resolveWuyinVideoSize({ size: "1920x1080" }), "1920x1080");
    assert.equal(
      normalizeWuyinVideoImages("https://cdn.example.com/a.png", "https://cdn.example.com/b.png"),
      "https://cdn.example.com/a.png,https://cdn.example.com/b.png",
    );
    assert.deepEqual(
      buildWuyinVideoRequestBody({
        prompt: "make a calm product shot",
        aspectRatio: "9:16",
        resolution: "720p",
        videoDuration: "10",
        imageUrl: "https://cdn.example.com/ref.png",
      }),
      {
        prompt: "make a calm product shot",
        size: "720x1280",
        duration: "10",
        images: "https://cdn.example.com/ref.png",
      },
    );
    assert.throws(
      () => normalizeWuyinVideoImages("blob:http://local/ref", undefined),
      /local blob URL/,
    );
    assert.throws(
      () => normalizeWuyinVideoImages("data:image/png;base64,aaaa", undefined),
      /base64 upload is not supported/,
    );
  });

  test("maps Wuyin video status codes and extracts task/video results broadly", () => {
    assert.equal(extractWuyinVideoTaskId({ data: { id: " task-1 " } }), "task-1");
    assert.equal(extractWuyinVideoStatusCode({ data: { status: "2" } }), 2);
    assert.equal(mapWuyinVideoStatus(0), "pending");
    assert.equal(mapWuyinVideoStatus(1), "pending");
    assert.equal(mapWuyinVideoStatus(2), "success");
    assert.equal(mapWuyinVideoStatus(3), "failed");
    assert.equal(extractWuyinVideoUrl({ data: { video_url: "https://cdn.example.com/a.mp4" } }), "https://cdn.example.com/a.mp4");
    assert.equal(extractWuyinVideoUrl({ data: { output: { url: "https://cdn.example.com/b.mp4" } } }), "https://cdn.example.com/b.mp4");
    assert.equal(extractWuyinVideoUrl({ outputs: [{ url: "https://cdn.example.com/c.mp4" }] }), "https://cdn.example.com/c.mp4");
  });

  test("keeps local_proxy task ids stateless enough for refreshed polling", () => {
    const localTaskId = serverWuyinVideoProxy.encodeLocalProxyTaskId("provider 1", "task/2");

    assert.equal(localTaskId, "local_proxy:provider%201:task%2F2");
    assert.deepEqual(serverWuyinVideoProxy.decodeLocalProxyTaskId(localTaskId), {
      routeId: "provider 1",
      providerTaskId: "task/2",
    });
    assert.equal(
      serverWuyinVideoProxy.isWuyinAsyncVideoTargetUrl("https://api.wuyinkeji.com/api/async/video_google_omni"),
      true,
    );
    assert.equal(
      serverWuyinVideoProxy.isWuyinAsyncVideoTargetUrl("https://api.wuyinkeji.com/api/async/image_nanoBanana2"),
      true,
    );
    assert.equal(
      serverWuyinVideoProxy.isWuyinAsyncVideoTargetUrl("https://api.openai.com/v1/videos"),
      false,
    );
  });

  test("keeps Wuyin Google Omni out of the OpenAI /v1/videos adapter path", () => {
    const adapterSource = readSource("src/services/llm/VideoCompatibleAdapter.ts");
    const serverRouteSource = readSource("server/routes/user.js");
    const serverHelperSource = readSource("server/lib/wuyinAsyncVideoProxy.js");

    assert.match(adapterSource, /runtime\.videoApiStyle === 'wuyin-async-video'/);
    assert.match(adapterSource, /generateVideoViaWuyinAsync/);
    assert.match(adapterSource, /buildWuyinVideoSubmitUrl/);
    assert.match(serverRouteSource, /router\.all\('\/v1\/model-proxy\/user'/);
    assert.match(serverRouteSource, /mode === 'video'/);
    assert.match(serverRouteSource, /mode === 'task_status'/);
    assert.match(serverRouteSource, /appendWuyinApiKeyToTargetUrl/);
    assert.match(serverHelperSource, /Authorization: apiKey/);
    assert.match(serverHelperSource, /local_proxy:/);
  });
});
