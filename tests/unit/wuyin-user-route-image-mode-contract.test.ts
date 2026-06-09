import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readSource } from "../support/workspacePaths.js";

describe("Wuyin / 速创 documented API routing", () => {
  test("strict Wuyin router is mounted before the legacy user router", () => {
    const indexSource = readSource("server/index.js");
    const strictRouterIndex = indexSource.indexOf("userWuyinStrictRouter");
    const legacyRouterIndex = indexSource.indexOf("userRouter");

    assert.ok(strictRouterIndex >= 0, "expected userWuyinStrictRouter to be mounted");
    assert.ok(legacyRouterIndex >= 0, "expected legacy userRouter to remain mounted after strict routers");
    assert.ok(
      strictRouterIndex < legacyRouterIndex,
      "Wuyin strict router must intercept before legacy userRouter can guess or proxy old requests",
    );
  });

  test("legacy target-url Wuyin proxy is converted into the documented strict contract", () => {
    const strictSource = readSource("server/routes/user-wuyin-strict-router.js");

    assert.match(strictSource, /parseWuyinTargetUrl/);
    assert.match(strictSource, /handleGenericWuyinProxy/);
    assert.match(strictSource, /getWuyinProduct\(asyncMatch\[1\]\)/);
    assert.match(strictSource, /buildDocumentedBody\(product, readGenericProxyInputBody\(req\)\)/);
    assert.match(strictSource, /WUYIN_MODEL_NOT_DOCUMENTED/);
    assert.match(strictSource, /WUYIN_GENERIC_PROXY_DISABLED/);
    assert.match(strictSource, /\/api\/sora2-new\/submit/);
    assert.match(strictSource, /\/api\/voice\/composite/);
    assert.match(strictSource, /\/api\/img\/split/);
    assert.doesNotMatch(strictSource, /fetch\(targetUrl/);
    assert.doesNotMatch(strictSource, /Wuyin 通用转发已禁用。请使用 image\/video\/audio\/task_status 模式/);
  });

  test("strict status routing requires model-bearing task ids and documented detail endpoints", () => {
    const strictSource = readSource("server/routes/user-wuyin-strict-router.js");

    assert.match(strictSource, /decodeLocalProxyTaskId/);
    assert.match(strictSource, /getWuyinProduct\(parsed\.modelId\)/);
    assert.match(strictSource, /WUYIN_STATUS_MODEL_REQUIRED/);
    assert.match(strictSource, /WUYIN_ASYNC_DETAIL_ENDPOINT/);
    assert.match(strictSource, /WUYIN_SORA2_DETAIL_ENDPOINT/);
    assert.match(strictSource, /api\.wuyinkeji\.com/);
  });
});
