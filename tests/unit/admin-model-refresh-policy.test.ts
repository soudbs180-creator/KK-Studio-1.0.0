import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminModelAutoRefreshDelay,
  shouldStartAdminModelRefresh,
} from "../../apps/web/src/services/model/adminModelRefreshPolicy.ts";

test("visible tabs use the fast admin catalog refresh interval", () => {
  assert.equal(getAdminModelAutoRefreshDelay("visible"), 10_000);
});

test("hidden tabs use the slow admin catalog refresh interval", () => {
  assert.equal(getAdminModelAutoRefreshDelay("hidden"), 60_000);
});

test("background refresh skips duplicate triggers inside cooldown", () => {
  assert.equal(
    shouldStartAdminModelRefresh({
      force: false,
      hasInflightRequest: false,
      lastAttemptAt: 1_000,
      now: 8_000,
      cooldownMs: 15_000,
    }),
    false,
  );
});
