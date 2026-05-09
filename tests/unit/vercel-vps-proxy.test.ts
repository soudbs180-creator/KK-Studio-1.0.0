import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { proxyToVps } from "../../api/_vpsProxy.ts";
import authCatchAllHandler from "../../api/auth/[...path].ts";
import v1CatchAllHandler from "../../api/v1/[...path].ts";

const originalFetch = globalThis.fetch;
const originalVpsApiBaseUrl = process.env.KK_VPS_API_BASE_URL;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (typeof originalVpsApiBaseUrl === "string") {
    process.env.KK_VPS_API_BASE_URL = originalVpsApiBaseUrl;
  } else {
    delete process.env.KK_VPS_API_BASE_URL;
  }
  if (typeof originalVercelEnv === "string") {
    process.env.VERCEL_ENV = originalVercelEnv;
  } else {
    delete process.env.VERCEL_ENV;
  }
  if (typeof originalNodeEnv === "string") {
    process.env.NODE_ENV = originalNodeEnv;
  } else {
    delete process.env.NODE_ENV;
  }
});

test("Vercel VPS proxy default upstream is HTTPS", async () => {
  let observedUrl = "";

  delete process.env.KK_VPS_API_BASE_URL;
  globalThis.fetch = async (input) => {
    observedUrl = String(input);
    return new Response(null, { status: 204 });
  };

  const response = await proxyToVps(
    new Request("https://kkai.plus/healthz?probe=1"),
    "/healthz",
  );

  assert.equal(response.status, 204);
  assert.equal(new URL(observedUrl).protocol, "https:");
});

test("Vercel VPS proxy default upstream avoids the unresolved canonical API hostname", async () => {
  let observedUrl = "";

  delete process.env.KK_VPS_API_BASE_URL;
  globalThis.fetch = async (input) => {
    observedUrl = String(input);
    return new Response(null, { status: 204 });
  };

  const response = await proxyToVps(
    new Request("https://kkai.plus/api/v1/auth/session"),
    "/api/v1/auth/session",
  );

  const upstreamUrl = new URL(observedUrl);
  assert.equal(response.status, 204);
  assert.equal(upstreamUrl.protocol, "https:");
  assert.equal(upstreamUrl.hostname, "172-245-156-16.sslip.io");
  assert.notEqual(upstreamUrl.hostname, "api.kkai.plus");
});

test("Vercel VPS proxy preserves HTTPS API requests while stripping caller-controlled host headers", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;

  process.env.KK_VPS_API_BASE_URL = "https://api.example.com:9443";
  globalThis.fetch = async (input, init) => {
    observedUrl = String(input);
    observedInit = init;
    return new Response(JSON.stringify({ success: false, error: { code: "AUTH_REQUIRED" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await proxyToVps(
    new Request("https://kkai.plus/api/v1/model-proxy/user?trace=1", {
      method: "POST",
      headers: {
        authorization: "Bearer access-token",
        cookie: "kk_session=session-token",
        "content-type": "application/json",
        host: "kkai.plus",
        "x-forwarded-host": "kkai.plus",
        "x-forwarded-proto": "http",
      },
      body: JSON.stringify({ routeId: "google-route" }),
    }),
    "/api/v1/model-proxy/user",
  );

  assert.equal(observedUrl, "https://api.example.com:9443/api/v1/model-proxy/user?trace=1");
  assert.equal(observedInit?.method, "POST");
  assert.equal(response.status, 401);

  const headers = observedInit?.headers as Headers;
  assert.equal(headers.get("authorization"), "Bearer access-token");
  assert.equal(headers.get("cookie"), "kk_session=session-token");
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("host"), null);
  assert.equal(headers.get("x-forwarded-host"), "api.example.com:9443");
  assert.equal(headers.get("x-forwarded-proto"), "https");
  assert.equal(new TextDecoder().decode(observedInit?.body as ArrayBuffer), '{"routeId":"google-route"}');
});

test("Vercel production proxy fails closed before forwarding Authorization to HTTP upstream", async () => {
  let fetchCalled = false;

  process.env.KK_VPS_API_BASE_URL = "http://api.example.com";
  process.env.VERCEL_ENV = "production";
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 204 });
  };

  const response = await proxyToVps(
    new Request("https://kkai.plus/api/v1/model-proxy/user", {
      headers: { authorization: "Bearer access-token" },
    }),
    "/api/v1/model-proxy/user",
  );

  assert.equal(fetchCalled, false);
  assert.equal(response.status, 502);
  assert.match(await response.text(), /UPSTREAM_REQUIRES_HTTPS/);
});

test("Vercel production proxy fails closed before forwarding cookies to HTTP upstream", async () => {
  let fetchCalled = false;

  process.env.KK_VPS_API_BASE_URL = "http://api.example.com";
  process.env.VERCEL_ENV = "production";
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 204 });
  };

  const response = await proxyToVps(
    new Request("https://kkai.plus/api/auth/session", {
      headers: { cookie: "kk_session=session-token" },
    }),
    "/api/auth/session",
  );

  assert.equal(fetchCalled, false);
  assert.equal(response.status, 502);
  assert.match(await response.text(), /UPSTREAM_REQUIRES_HTTPS/);
});

test("Vercel catch-all API routes preserve /api/v1 and /api/auth subpaths", async () => {
  const observedUrls: string[] = [];

  process.env.KK_VPS_API_BASE_URL = "https://api.example.com";
  globalThis.fetch = async (input) => {
    observedUrls.push(String(input));
    return new Response(null, { status: 204 });
  };

  await v1CatchAllHandler(new Request("https://kkai.plus/api/v1/model-proxy/user?trace=1"));
  await authCatchAllHandler(new Request("https://kkai.plus/api/auth/session?mode=refresh"));

  assert.deepEqual(observedUrls, [
    "https://api.example.com/api/v1/model-proxy/user?trace=1",
    "https://api.example.com/api/auth/session?mode=refresh",
  ]);
});
