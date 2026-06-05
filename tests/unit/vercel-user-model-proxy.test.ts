import assert from "node:assert/strict";
import { test } from "node:test";
import handler from "../../api/user-model-proxy.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

test("Vercel user model proxy forwards only Wuyin async requests with the user API key", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    return new Response(JSON.stringify({ code: 200, data: { id: "task-1" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const res = createResponse();
    await handler({
      method: "POST",
      headers: {
        "x-proxy-target-url": "https://api.wuyinkeji.com/api/async/image_nanoBanana2",
        "x-proxy-api-key": "wu-key",
        "content-type": "application/json",
        accept: "application/json",
        authorization: "Bearer kk-session",
      },
      body: { prompt: "test prompt" },
    } as any, res as any);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.wuyinkeji.com/api/async/image_nanoBanana2");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "wu-key");
    assert.equal((calls[0].init.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.equal(calls[0].init.body, "{\"prompt\":\"test prompt\"}");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Vercel user model proxy appends the Wuyin key only for detail polling", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    return new Response(JSON.stringify({ code: 200, data: { status: 2, result: ["https://img.wuyinkeji.com/out.png"] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const res = createResponse();
    await handler({
      method: "GET",
      headers: {
        "x-proxy-target-url": "https://api.wuyinkeji.com/api/async/detail?id=task-1",
        "x-proxy-api-key": "wu-key",
        accept: "application/json",
      },
    } as any, res as any);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.wuyinkeji.com/api/async/detail?id=task-1&key=wu-key");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "wu-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Vercel user model proxy rejects non-Wuyin targets and missing user API keys", async () => {
  const blockedRes = createResponse();
  await handler({
    method: "GET",
    headers: {
      "x-proxy-target-url": "https://api.openai.com/v1/images",
      "x-proxy-api-key": "wu-key",
    },
  } as any, blockedRes as any);
  assert.equal(blockedRes.statusCode, 404);
  assert.deepEqual((blockedRes.body as { error: { code: string } }).error.code, "USER_ROUTE_NOT_FOUND");

  const missingKeyRes = createResponse();
  await handler({
    method: "GET",
    headers: {
      "x-proxy-target-url": "https://api.wuyinkeji.com/api/async/detail?id=task-1",
    },
  } as any, missingKeyRes as any);
  assert.equal(missingKeyRes.statusCode, 400);
  assert.deepEqual((missingKeyRes.body as { error: { code: string } }).error.code, "USER_ROUTE_SECRET_REQUIRED");
});

test("Vercel user model proxy blocks placeholder secrets before upstream fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    for (const apiKey of [
      "sk-readonly-0000",
      "__kk_redacted__:provider:route-1",
      "••••••••••••",
      "sk-live...tail",
      "[object Object]",
    ]) {
      const res = createResponse();
      await handler({
        method: "GET",
        headers: {
          "x-proxy-target-url": "https://api.wuyinkeji.com/api/async/detail?id=task-1",
          "x-proxy-api-key": apiKey,
        },
      } as any, res as any);

      assert.equal(res.statusCode, 400);
      assert.deepEqual((res.body as { error: { code: string } }).error.code, "USER_ROUTE_SECRET_REQUIRED");
    }

    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
