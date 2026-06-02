import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverWuyinProxy = require("../../server/lib/wuyinAsyncVideoProxy.js") as {
  extractWuyinTaskId: (payload: any) => string;
  mapWuyinStatus: (statusCode: any) => string;
  extractWuyinOutputUrls: (payload: any) => string[];
  encodeLocalProxyTaskId: (routeId: string, providerTaskId: string) => string;
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

});
