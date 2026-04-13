import assert from "node:assert/strict";
import test from "node:test";

import {
  isPublicRouteBypassingBearerAuth,
  shouldAttemptBearerAuthentication,
} from "../../apps/api/src/lib/request-auth-scope.ts";

test("public model catalog routes bypass bearer authentication even when the browser sends a token", () => {
  assert.equal(
    isPublicRouteBypassingBearerAuth("/api/v1/model-catalog/active-credit-models"),
    true,
  );
  assert.equal(
    isPublicRouteBypassingBearerAuth("/api/v1/model-catalog/models"),
    true,
  );
  assert.equal(
    shouldAttemptBearerAuthentication("/api/v1/model-catalog/active-credit-models", {
      authorization: "Bearer public-route-token",
    }),
    false,
  );
});

test("private routes still attempt bearer authentication when a token is present", () => {
  assert.equal(
    shouldAttemptBearerAuthentication("/api/v1/billing/credits/balance", {
      authorization: "Bearer private-route-token",
    }),
    true,
  );
  assert.equal(
    shouldAttemptBearerAuthentication("/api/v1/workspaces/layout", {
      authorization: "Bearer private-route-token",
    }),
    true,
  );
});

test("routes without a bearer token do not trigger bearer authentication", () => {
  assert.equal(
    shouldAttemptBearerAuthentication("/api/v1/billing/credits/balance", {}),
    false,
  );
});
