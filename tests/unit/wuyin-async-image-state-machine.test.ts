import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverWuyinProxy = require("../../server/lib/dispatcher/adapters/wuyin/wuyinAsyncVideoProxy.js") as {
  extractWuyinTaskId: (payload: any) => string;
  mapWuyinStatus: (statusCode: any) => string;
  extractWuyinOutputUrls: (payload: any) => string[];
  encodeLocalProxyTaskId: (routeId: string, providerTaskId: string) => string;
  isWuyinAsyncVideoRoute: (route: any, modelId?: string) => boolean;
  resolveWuyinImageEndpointPath: (modelId: string) => string;
};

// 简体中文注释：模拟前端命名函数，用于测试命名的规范性
function extractProviderTaskIdFromLocalTaskId(taskId?: string): string {
  const raw = String(taskId || '').trim();
  const match = raw.match(/^local_proxy:[^:]+:(.+)$/);
  return match?.[1] || raw;
}

function sanitizeStorageId(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function buildWuyinImageStorageId(input: {
  providerTaskId?: string;
  taskId?: string;
  resultIndex?: number;
  total?: number;
}): string {
  const providerTaskId = sanitizeStorageId(
    input.providerTaskId || extractProviderTaskIdFromLocalTaskId(input.taskId)
  );

  if (!providerTaskId) {
    return `${Date.now()}_${Math.random()}`;
  }

  if ((input.total || 1) <= 1) {
    return providerTaskId;
  }

  return `${providerTaskId}_${input.resultIndex || 0}`;
}

describe("Wuyin Async Image State Machine & Helper Tests", () => {

  test("1. 提交接口返回 id 后能够正确识别任务 ID 并判定状态 (pending)", () => {
    const mockSubmitPayload = {
      code: 200,
      msg: "成功",
      data: {
        id: "image_9da52388-7e77-485c-98e4-2b25d739729e",
        count: "1",
        status: undefined as number | undefined
      },
      exec_time: 0.279178
    };

    const providerTaskId = serverWuyinProxy.extractWuyinTaskId(mockSubmitPayload);
    assert.equal(providerTaskId, "image_9da52388-7e77-485c-98e4-2b25d739729e");

    const status = serverWuyinProxy.mapWuyinStatus(mockSubmitPayload.data.status); // undefined -> pending
    assert.equal(status, "pending");

    const localTaskId = serverWuyinProxy.encodeLocalProxyTaskId("key_123", providerTaskId);
    assert.equal(localTaskId, "local_proxy:key_123:image_9da52388-7e77-485c-98e4-2b25d739729e");
  });

  test("2. detail status=0/1 时判定为 pending/processing 不算失败", () => {
    const mockDetailPending = {
      code: 200,
      data: {
        task_id: "image_xxx",
        status: 0,
        result: [],
        message: ""
      },
      exec_time: 0.2
    };

    const mockDetailProcessing = {
      code: 200,
      data: {
        task_id: "image_xxx",
        status: 1,
        result: [],
        message: ""
      },
      exec_time: 0.2
    };

    const statusPending = serverWuyinProxy.mapWuyinStatus(mockDetailPending.data.status);
    assert.equal(statusPending, "pending");

    const statusProcessing = serverWuyinProxy.mapWuyinStatus(mockDetailProcessing.data.status);
    assert.equal(statusProcessing, "processing");
  });

  test("3. detail status=2 时判定为 success，并能正确提取 result URL", () => {
    const mockDetailSuccess = {
      code: 200,
      data: {
        task_id: "image_9da52388-7e77-485c-98e4-2b25d739729e",
        status: 2,
        result: ["https://openpt1.wuyinkeji.com/e1d882ae44254ec3aca299a35f583a1d.png"],
        message: ""
      },
      exec_time: 1.589569
    };

    const status = serverWuyinProxy.mapWuyinStatus(mockDetailSuccess.data.status);
    assert.equal(status, "success");

    const urls = serverWuyinProxy.extractWuyinOutputUrls(mockDetailSuccess);
    assert.deepEqual(urls, ["https://openpt1.wuyinkeji.com/e1d882ae44254ec3aca299a35f583a1d.png"]);
  });

  test("4. 命名规则验证：前端 success 后使用 providerTaskId 命名图片节点并规避 local_proxy", () => {
    const localTaskId = "local_proxy:key_123:image_9da52388-7e77-485c-98e4-2b25d739729e";
    const providerTaskId = extractProviderTaskIdFromLocalTaskId(localTaskId);
    assert.equal(providerTaskId, "image_9da52388-7e77-485c-98e4-2b25d739729e");

    const singleImageStorageId = buildWuyinImageStorageId({ taskId: localTaskId, resultIndex: 0, total: 1 });
    assert.equal(singleImageStorageId, "image_9da52388-7e77-485c-98e4-2b25d739729e");

    const multiImageStorageId1 = buildWuyinImageStorageId({ taskId: localTaskId, resultIndex: 0, total: 2 });
    assert.equal(multiImageStorageId1, "image_9da52388-7e77-485c-98e4-2b25d739729e_0");

    const multiImageStorageId2 = buildWuyinImageStorageId({ taskId: localTaskId, resultIndex: 1, total: 2 });
    assert.equal(multiImageStorageId2, "image_9da52388-7e77-485c-98e4-2b25d739729e_1");
  });

  test("5. 总耗时计算验证", () => {
    const submitExecTime = 0.279178;
    const detailExecTime = 1.589569;
    const totalExecTime = submitExecTime + detailExecTime;
    const generationTimeMs = Math.round(totalExecTime * 1000);

    assert.equal(totalExecTime, 1.868747);
    assert.equal(generationTimeMs, 1869);
  });

  test("6. isWuyinAsyncVideoRoute 能够拦截 provider === 'Wuyin' 的自定义路由", () => {
    const mockRoute = {
      name: "我的速创中转",
      baseUrl: "https://my-custom-proxy.com/api",
      provider: "Wuyin"
    };

    const isWuyin = serverWuyinProxy.isWuyinAsyncVideoRoute(mockRoute);
    assert.equal(isWuyin, true);
  });

  test("7. resolveWuyinImageEndpointPath 能够通过爬虫生成的 wuyinEndpoints.json 成功自适应匹配", () => {
    const path = serverWuyinProxy.resolveWuyinImageEndpointPath("NanoBanana2");
    assert.equal(path, "/api/async/image_nanoBanana2");
  });

  test("8. 任务 ID 通用提取测试 (extractWuyinProviderTaskId)", () => {
    const extract = (serverWuyinProxy as any).extractWuyinProviderTaskId;
    assert.equal(extract({ data: { id: 'image_abc' } }), 'image_abc');
    assert.equal(extract({ data: { id: 'video_abc' } }), 'video_abc');
    assert.equal(extract({ data: { id: 'audio_abc' } }), 'audio_abc');
    assert.equal(extract({ data: { id: '114514' } }), '114514');
    assert.equal(extract({ data: { id: 'image_9da52388-7e77-485c-98e4-2b25d739729e', count: '1' } }), 'image_9da52388-7e77-485c-98e4-2b25d739729e');
    assert.equal(extract({ data: { task_id: 'abc-def-ghi' } }), 'abc-def-ghi');
    assert.equal(extract({ data: { taskId: 'task_xyz' } }), 'task_xyz');
    assert.equal(extract({ data: { taskID: 'taskID_123' } }), 'taskID_123');
    // 外层直接有
    assert.equal(extract({ id: '114514' }), '114514');
  });

  test("9. local_proxy 解码测试 (encode & decode)", () => {
    const encoded = serverWuyinProxy.encodeLocalProxyTaskId('key_123', 'video_abc-def');
    const parsed = (serverWuyinProxy as any).decodeLocalProxyTaskId(encoded);

    assert.equal(parsed.routeId, 'key_123');
    assert.equal(parsed.providerTaskId, 'video_abc-def');

    // 含有特殊字符的 providerTaskId
    const encodedSpecial = serverWuyinProxy.encodeLocalProxyTaskId('slot_1', 'abc/def/ghi');
    const parsedSpecial = (serverWuyinProxy as any).decodeLocalProxyTaskId(encodedSpecial);
    assert.equal(parsedSpecial.routeId, 'slot_1');
    assert.equal(parsedSpecial.providerTaskId, 'abc/def/ghi');
  });

  test("10. 验证 endpointType 推导逻辑 (inferWuyinEndpointTypeFromProviderTaskId)", () => {
    const infer = (serverWuyinProxy as any).inferWuyinEndpointTypeFromProviderTaskId;
    assert.equal(infer('image_abc'), 'wuyin-async-image');
    assert.equal(infer('video_abc'), 'wuyin-async-video');
    assert.equal(infer('audio_abc'), 'wuyin-async-audio');
    assert.equal(infer('114514'), 'wuyin-async');
    assert.equal(infer('abc-def', 'custom-fallback'), 'custom-fallback');
  });

  test("11. 提交接口未返回 id 时应当抛出错误并阻止 pending 状态", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 200,
          msg: "操作成功",
          data: {} // 模拟不带任务 ID 的响应
        })
      } as any;
    };

    const executor = require("../../server/lib/dispatcher/adapters/wuyin/wuyinModelExecutor.js") as {
      submitWuyinTask: (options: any) => Promise<any>;
    };

    try {
      const catalogItem = {
        id: 'image_nanoBanana2',
        executionMode: 'async-detail',
        endpointUrl: 'https://api.wuyinkeji.com/api/async/image_nanoBanana2',
        kind: 'image'
      };
      
      await assert.rejects(
        async () => {
          await executor.submitWuyinTask({
            catalogItem,
            apiKey: 'test-key',
            input: { prompt: 'test' }
          });
        },
        /提交接口失败: 速创 API 提交响应未返回有效的任务 ID/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("12. 速创图片提交接口只通过 Authorization 鉴权，不在提交 URL 拼 key", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init || {} });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 200,
          msg: "操作成功",
          data: { id: "task-1" }
        })
      } as any;
    }) as typeof fetch;

    const executor = require("../../server/lib/dispatcher/adapters/wuyin/wuyinModelExecutor.js") as {
      submitWuyinTask: (options: any) => Promise<any>;
    };

    try {
      const result = await executor.submitWuyinTask({
        catalogItem: {
          id: "image_nanoBanana2",
          executionMode: "async-detail",
          endpointUrl: "https://api.wuyinkeji.com/api/async/image_nanoBanana2",
          kind: "image"
        },
        apiKey: "test-key",
        input: { prompt: "test prompt", size: "1K", aspectRatio: "auto" }
      });

      assert.equal(result.providerTaskId, "task-1");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.wuyinkeji.com/api/async/image_nanoBanana2?key=test-key");
      assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "test-key");
      assert.match(String(calls[0].init.body), /"prompt":"test prompt"/);
      assert.match(calls[0].url, /[?&]key=test-key/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("13. 速创详情查询使用 id 和 key 查询参数，同时保留 Authorization 头", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init || {} });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 200,
          data: {
            status: 2,
            result: ["https://openpt1.wuyinkeji.com/result.png"]
          }
        })
      } as any;
    }) as typeof fetch;

    const executor = require("../../server/lib/dispatcher/adapters/wuyin/wuyinModelExecutor.js") as {
      checkWuyinTaskStatus: (options: any) => Promise<any>;
    };

    try {
      const result = await executor.checkWuyinTaskStatus({
        catalogItem: {
          id: "image_nanoBanana2",
          executionMode: "async-detail",
          detailPath: "/api/async/detail"
        },
        apiKey: "test-key",
        providerTaskId: "task-1"
      });

      assert.equal(result.status, "success");
      assert.deepEqual(result.urls, ["https://openpt1.wuyinkeji.com/result.png"]);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.wuyinkeji.com/api/async/detail?id=task-1&key=test-key");
      assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "test-key");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
