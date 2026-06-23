import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generateV1Router = require("../../server/routes/generate-v1.js");
const metricsCollector = require("../../server/lib/dispatcher/metricsCollector.js");
const BackendDispatcher = require("../../server/lib/dispatcher/index.js");
const generationController = require("../../server/lib/generation/generationController.js");
const userAiRouteHandler = require("../../server/lib/dispatcher/userAiRouteHandler.js");
const wuyinRouteHandler = require("../../server/lib/dispatcher/adapters/wuyin/wuyinRouteHandler.js");
const localUserRouteStore = require("../../server/lib/dispatcher/localUserRouteStore.js");

describe("generate-v1.js 影子路由单元测试", () => {
  test("1. 平台积分对话请求被正确直接分发给 BackendDispatcher", async () => {
    let dispatchCalled = false;
    const req = {
      headers: { authorization: "valid-jwt" },
      userId: "test-user-id",
      body: {
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }]
      },
      url: "/v1/generate"
    } as any;
    
    const res = {
      setHeader: () => {},
      status: function(code: number) {
        return this;
      },
      json: (data: any) => data
    } as any;
    
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";

    const originalDispatch = BackendDispatcher.dispatch;
    BackendDispatcher.dispatch = async (userId: string, payload: any) => {
      dispatchCalled = true;
      assert.equal(userId, "test-user-id");
      assert.equal(payload.task_type, "chat");
      return { success: true, text: "ok" };
    };
    
    try {
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      
      await handleGenerate(req, res);
      
      assert.equal(dispatchCalled, true);
    } finally {
      jwt.verifyJWT = originalVerify;
      BackendDispatcher.dispatch = originalDispatch;
    }
  });

  test("2. 平台积分生图请求被正确直接分发给 generationController", async () => {
    let controllerCalled = false;
    const req = {
      headers: { authorization: "valid-jwt" },
      userId: "test-user-id",
      body: {
        task_type: "image",
        prompt: "a beautiful banana"
      },
      url: "/v1/generate"
    } as any;
    
    const res = {
      setHeader: () => {},
      status: function(code: number) {
        return this;
      },
      json: (data: any) => data
    } as any;
    
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";

    const originalHandle = generationController.handleGenerate;
    generationController.handleGenerate = async (qReq: any, qRes: any) => {
      controllerCalled = true;
      assert.equal(qReq.body.prompt, "a beautiful banana");
      return qRes.json({ success: true });
    };
    
    try {
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      
      await handleGenerate(req, res);
      
      assert.equal(controllerCalled, true);
    } finally {
      jwt.verifyJWT = originalVerify;
      generationController.handleGenerate = originalHandle;
    }
  });

  test("3. 自带 Key 对话与异步请求被正确分发给对应的 Handler 并通过安全白名单过滤", async () => {
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";

    const originalResolveRoute = localUserRouteStore.resolveLocalUserRoute;
    localUserRouteStore.resolveLocalUserRoute = async () => {
      return {
        id: "slot_wuyin",
        baseUrl: "https://api.wuyinkeji.com",
        format: "openai"
      };
    };

    const originalUserChat = userAiRouteHandler.handleUnifiedUserChatMode;
    let userChatCalled = false;
    userAiRouteHandler.handleUnifiedUserChatMode = async (qReq: any, qRes: any, userId: any) => {
      userChatCalled = true;
      assert.equal(userId, "test-user-id");
      return qRes.json({ success: true });
    };

    const originalStatus = wuyinRouteHandler.handleStatusMode;
    let statusCalled = false;
    wuyinRouteHandler.handleStatusMode = async (qReq: any, qRes: any, userId: any) => {
      statusCalled = true;
      assert.equal(userId, "test-user-id");
      return qRes.json({ success: true });
    };
    
    try {
      // 3.1 同步自带 Key 对话
      const reqSync = {
        headers: { authorization: "valid-jwt", "x-key-slot-id": "slot_wuyin" },
        userId: "test-user-id",
        body: {
          task_type: "chat",
          messages: [{ role: "user", content: "hello" }],
          routeId: "slot_wuyin"
        },
        url: "/v1/generate"
      } as any;
      const resSync = {
        setHeader: () => {},
        status: function(code: number) {
          return this;
        },
        json: (data: any) => data
      } as any;
      
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      await handleGenerate(reqSync, resSync);
      assert.equal(userChatCalled, true);

      // 3.2 异步状态查询
      const reqAsync = {
        headers: { authorization: "valid-jwt" },
        userId: "test-user-id",
        body: {
          mode: "task_status",
          taskId: "local_proxy:slot_wuyin:video_123"
        },
        url: "/v1/generate/async"
      } as any;
      const resAsync = {
        setHeader: () => {},
        status: function(code: number) {
          return this;
        },
        json: (data: any) => data
      } as any;
      
      const handleGenerateAsync = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate/async") as any).route.stack[1].handle;
      await handleGenerateAsync(reqAsync, resAsync);
      assert.equal(statusCalled, true);
    } finally {
      jwt.verifyJWT = originalVerify;
      localUserRouteStore.resolveLocalUserRoute = originalResolveRoute;
      userAiRouteHandler.handleUnifiedUserChatMode = originalUserChat;
      wuyinRouteHandler.handleStatusMode = originalStatus;
    }
  });

  test("4. 遥测埋点能够成功在响应返回时捕获记录", async () => {
    const jwt = require("../../server/lib/jwt.js");
    const originalVerify = jwt.verifyJWT;
    jwt.verifyJWT = () => "test-user-id";
    
    metricsCollector.reset();

    const originalDispatch = BackendDispatcher.dispatch;
    BackendDispatcher.dispatch = async () => {
      return { success: true, text: "ok" };
    };
    
    try {
      const req = {
        headers: { authorization: "valid-jwt" },
        userId: "test-user-id",
        body: {
          task_type: "chat",
          messages: [{ role: "user", content: "hello" }]
        },
        url: "/v1/generate"
      } as any;
      
      const res = {
        setHeader: () => {},
        status: function(code: number) {
          return this;
        },
        json: (data: any) => data
      } as any;
      
      const handleGenerate = (generateV1Router.stack.find((layer: any) => layer.route && layer.route.path === "/v1/generate") as any).route.stack[1].handle;
      
      await handleGenerate(req, res);
      
      const metrics = metricsCollector.getMetrics();
      assert.ok(metrics.routes["/api/v1/generate"], "应当有 /api/v1/generate 的埋点数据");
      assert.equal(metrics.routes["/api/v1/generate"].total, 1);
      assert.equal(metrics.routes["/api/v1/generate"].success, 1);
    } finally {
      jwt.verifyJWT = originalVerify;
      BackendDispatcher.dispatch = originalDispatch;
    }
  });
});
