import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readSource } from "../support/workspacePaths.js";

describe("Wuyin / Suchuang documented API routing", () => {
  test("strict Wuyin router is mounted before the legacy user router", () => {
    const indexSource = readSource("server/index.js");
    const strictRouterIndex = indexSource.indexOf("generateV1Router");
    const legacyRouterIndex = indexSource.indexOf("userRouter");

    assert.ok(strictRouterIndex >= 0, "expected generateV1Router to be mounted");
    assert.ok(legacyRouterIndex >= 0, "expected legacy userRouter to remain mounted after strict routers");
    assert.ok(
      strictRouterIndex < legacyRouterIndex,
      "Wuyin strict router (via generateV1Router) must intercept before legacy userRouter can guess or proxy old requests",
    );
  });

  test("legacy target-url Wuyin proxy is converted into the documented strict contract", () => {
    const strictSource = readSource("server/lib/dispatcher/adapters/wuyin/wuyinRouteHandler.js");

    assert.match(strictSource, /parseWuyinTargetUrl/);
    assert.match(strictSource, /handleGenericWuyinProxy/);
    assert.match(strictSource, /getWuyinProduct\(asyncMatch\[1\]\)/);
    assert.match(strictSource, /buildDocumentedBody\(product, readGenericProxyInputBody\(req\)\)/);
    assert.match(strictSource, /WUYIN_MODEL_NOT_DOCUMENTED/);
    assert.match(strictSource, /WUYIN_ROUTE_NOT_RECOGNIZED/);
    assert.match(strictSource, /\/api\/sora2-new\/submit/);
    assert.match(strictSource, /\/api\/voice\/composite/);
    assert.match(strictSource, /\/api\/img\/split/);
    assert.doesNotMatch(strictSource, /fetch\(targetUrl/);
  });

  test("strict status routing requires model-bearing task ids and documented detail endpoints", () => {
    const strictSource = readSource("server/lib/dispatcher/adapters/wuyin/wuyinRouteHandler.js");

    assert.match(strictSource, /decodeLocalProxyTaskId/);
    assert.match(strictSource, /getWuyinProduct\(parsed\.modelId\)/);
    assert.match(strictSource, /WUYIN_STATUS_MODEL_REQUIRED/);
    assert.match(strictSource, /WUYIN_ASYNC_DETAIL_ENDPOINT/);
    assert.match(strictSource, /WUYIN_SORA2_DETAIL_ENDPOINT/);
  });

  test("governance blocks browser-direct Wuyin transport before merge", () => {
    const governanceSource = readSource("scripts/governance/check-current-facts.mjs");

    assert.match(governanceSource, /expectNoWuyinBrowserDirect/);
    assert.match(governanceSource, /callWuyinClientDirect/);
    assert.match(governanceSource, /checkWuyinClientDirectTaskStatus/);
    assert.match(governanceSource, /fetch\\\(targetUrl/);
    assert.match(governanceSource, /fetch\\\(detailUrl/);
    assert.match(governanceSource, /Browser-side Wuyin detail polling with a user API key is forbidden/);
  });
});
