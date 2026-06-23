import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generateV1Router = require("../../server/routes/generate-v1.js");
const metricsCollector = require("../../server/lib/dispatcher/metricsCollector.js");

describe("generate-v1.js 影子路由单元测试", () => {
  test("1. 平台积分对话请求被正确重定向为 /chat", () => {
    let nextCalled = false;
    const req = {
      headers: { authorization: "valid-jwt" },
      body: {
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }]
      },
      url: "/v1/generate"
    } as any;
    
    const res = {
      setHeader: () => {},
      json: (data: any) => data
    } as any;
    
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";
    
    try {
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      
      handleGenerate(req, res, () => {
        nextCalled = true;
      });
      
      assert.equal(nextCalled, true);
      assert.equal(req.url, "/chat");
    } finally {
      jwt.verifyJWT = originalVerify;
    }
  });

  test("2. 平台积分生图请求被正确重定向为 /generate-image", () => {
    let nextCalled = false;
    const req = {
      headers: { authorization: "valid-jwt" },
      body: {
        task_type: "image",
        prompt: "a beautiful banana"
      },
      url: "/v1/generate"
    } as any;
    
    const res = {
      setHeader: () => {},
      json: (data: any) => data
    } as any;
    
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";
    
    try {
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      
      handleGenerate(req, res, () => {
        nextCalled = true;
      });
      
      assert.equal(nextCalled, true);
      assert.equal(req.url, "/generate-image");
    } finally {
      jwt.verifyJWT = originalVerify;
    }
  });

  test("3. 自带 Key 对话与异步请求被正确重定向为 /v1/model-proxy/user", () => {
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";
    
    try {
      // 3.1 同步自带 Key 对话
      let nextCalledSync = false;
      const reqSync = {
        headers: { authorization: "valid-jwt", "x-key-slot-id": "slot_wuyin" },
        body: {
          task_type: "chat",
          messages: [{ role: "user", content: "hello" }],
          routeId: "slot_wuyin"
        },
        url: "/v1/generate"
      } as any;
      const resSync = { setHeader: () => {}, json: (data: any) => data } as any;
      
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      handleGenerate(reqSync, resSync, () => {
        nextCalledSync = true;
      });
      assert.equal(nextCalledSync, true);
      assert.equal(reqSync.url, "/v1/model-proxy/user");

      // 3.2 异步状态查询
      let nextCalledAsync = false;
      const reqAsync = {
        headers: { authorization: "valid-jwt" },
        body: {
          mode: "task_status",
          taskId: "local_proxy:slot_wuyin:video_123"
        },
        url: "/v1/generate/async"
      } as any;
      const resAsync = { setHeader: () => {}, json: (data: any) => data } as any;
      
      const handleGenerateAsync = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate/async") as any).route.stack[1].handle;
      handleGenerateAsync(reqAsync, resAsync, () => {
        nextCalledAsync = true;
      });
      assert.equal(nextCalledAsync, true);
      assert.equal(reqAsync.url, "/v1/model-proxy/user");
    } finally {
      jwt.verifyJWT = originalVerify;
    }
  });

  test("4. 遥测埋点能够成功在响应返回时捕获记录", () => {
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";
    
    metricsCollector.reset();
    
    try {
      const req = {
        headers: { authorization: "valid-jwt" },
        body: {
          task_type: "chat",
          messages: [{ role: "user", content: "hello" }]
        },
        url: "/v1/generate"
      } as any;
      
      let finalData: any;
      const res = {
        setHeader: () => {},
        statusCode: 200,
        json: (data: any) => {
          finalData = data;
          return data;
        }
      } as any;
      
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      
      handleGenerate(req, res, () => {});
      
      // 模拟中间件执行完 res.json 被触发
      res.json({ success: true, text: "ok" });
      
      const metrics = metricsCollector.getMetrics();
      assert.ok(metrics.routes["/api/v1/generate"], "应当有 /api/v1/generate 的埋点数据");
      assert.equal(metrics.routes["/api/v1/generate"].total, 1);
      assert.equal(metrics.routes["/api/v1/generate"].success, 1);
    } finally {
      jwt.verifyJWT = originalVerify;
    }
  });
});
