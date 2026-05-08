import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  decodeLocalUserRouteTaskToken,
  encodeLocalUserRouteTaskToken,
  resolveLocalUserRouteTaskSigningSecret,
  type LocalUserRouteTaskPayload,
} from "../../apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

describe("local user-route task token helper", () => {
  test("fails closed without a task signing secret unless insecure fallback is explicit", () => {
    const missingSecret = resolveLocalUserRouteTaskSigningSecret({
      taskSigningSecret: "",
      allowInsecureLocalTaskSigningFallback: false,
    });
    assert.deepEqual(missingSecret, {
      ok: false,
      code: "TASK_SIGNING_SECRET_REQUIRED",
      statusCode: 500,
      message: "Local user-route task signing secret is not configured.",
    });

    const fallbackSecret = resolveLocalUserRouteTaskSigningSecret({
      taskSigningSecret: "",
      allowInsecureLocalTaskSigningFallback: true,
    });
    assert.equal(fallbackSecret.ok, true);
    if (!fallbackSecret.ok) {
      throw new Error("Expected explicit insecure fallback to resolve a signing secret.");
    }
    assert.equal(fallbackSecret.secret, "kkai-local-route-task-secret");
  });

  test("encodes, verifies, and rejects local task tokens through one helper boundary", () => {
    const payload: LocalUserRouteTaskPayload = {
      v: 1,
      userId: "user-task-token",
      routeId: "route-task-token",
      taskId: "provider-task-token",
      mode: "image",
      requestId: "req-task-token",
      attemptId: "attempt-task-token",
    };
    const token = encodeLocalUserRouteTaskToken(payload, "real-task-secret");

    const decoded = decodeLocalUserRouteTaskToken(token, "user-task-token", "real-task-secret");
    assert.deepEqual(decoded, {
      ok: true,
      payload,
    });

    const wrongSecret = decodeLocalUserRouteTaskToken(token, "user-task-token", "wrong-task-secret");
    assert.deepEqual(wrongSecret, {
      ok: false,
      code: "INVALID_TASK_ID",
      statusCode: 400,
      message: "Local task token verification failed.",
    });

    const wrongUser = decodeLocalUserRouteTaskToken(token, "other-user", "real-task-secret");
    assert.deepEqual(wrongUser, {
      ok: false,
      code: "INVALID_TASK_ID",
      statusCode: 400,
      message: "Local task token payload is invalid.",
    });
  });

  test("proxy service delegates token signing implementation to the helper module", () => {
    const proxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");
    const helperSource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts");

    assert.match(proxySource, /from "\.\/local-user-route-task-token\.ts"/);
    assert.doesNotMatch(proxySource, /createHmac|timingSafeEqual/);
    assert.doesNotMatch(proxySource, /LOCAL_PROXY_TASK_PREFIX|DEFAULT_LOCAL_ROUTE_TASK_SECRET/);
    assert.doesNotMatch(proxySource, /function toBase64Url|function fromBase64Url/);
    assert.match(helperSource, /createHmac/);
    assert.match(helperSource, /timingSafeEqual/);
  });
});
