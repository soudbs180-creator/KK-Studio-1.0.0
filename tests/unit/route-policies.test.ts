import assert from "node:assert/strict";
import { test } from "node:test";
import { decideRoute } from "../../apps/web/src/features/generation/routePolicies.ts";
import type { RouteContext } from "../../apps/web/src/features/generation/generationIntent.ts";

test("routing policy: mobile device defaults to cloud", () => {
  const context: RouteContext = {
    deviceType: 'mobile',
    localRunnerAvailable: true,
    browserDirectAvailable: false,
    userPreferredMode: 'auto',
    provider: 'Google',
    hasLocalUserKey: true,
    hasCloudUserKey: true,
    hasPlatformCredit: true,
    networkStatus: 'normal',
    taskType: 'image',
  };

  const decision = decideRoute(context);
  assert.equal(decision.mode, 'cloud-user-key');
  assert.match(decision.reason, /mobile/i);
});

test("routing policy: desktop device prioritizes local-runner when available", () => {
  const context: RouteContext = {
    deviceType: 'desktop',
    localRunnerAvailable: true,
    browserDirectAvailable: false,
    userPreferredMode: 'auto',
    provider: 'Google',
    hasLocalUserKey: true,
    hasCloudUserKey: false,
    hasPlatformCredit: true,
    networkStatus: 'normal',
    taskType: 'image',
  };

  const decision = decideRoute(context);
  assert.equal(decision.mode, 'local-runner');
  assert.match(decision.reason, /local/i);
});

test("routing policy: desktop routes to cloud relay when local network is blocked", () => {
  const context: RouteContext = {
    deviceType: 'desktop',
    localRunnerAvailable: true,
    browserDirectAvailable: false,
    userPreferredMode: 'auto',
    provider: 'Google',
    hasLocalUserKey: true,
    hasCloudUserKey: true,
    hasPlatformCredit: true,
    networkStatus: 'blocked',
    taskType: 'image',
  };

  const decision = decideRoute(context);
  assert.equal(decision.mode, 'cloud-user-key');
  assert.match(decision.reason, /blocked/i);
});

test("routing policy: user preference overrides auto decisions", () => {
  const context: RouteContext = {
    deviceType: 'desktop',
    localRunnerAvailable: true,
    browserDirectAvailable: false,
    userPreferredMode: 'platform',
    provider: 'Google',
    hasLocalUserKey: true,
    hasCloudUserKey: true,
    hasPlatformCredit: true,
    networkStatus: 'normal',
    taskType: 'image',
  };

  const decision = decideRoute(context);
  assert.equal(decision.mode, 'cloud-platform-key');
  assert.match(decision.reason, /platform/i);
});

test('routing policy: strict local mode never silently falls back to cloud', () => {
  const context: RouteContext = {
    deviceType: 'desktop',
    localRunnerAvailable: true,
    browserDirectAvailable: false,
    userPreferredMode: 'local',
    allowCloudFallback: false,
    provider: 'Google',
    hasLocalUserKey: true,
    hasCloudUserKey: true,
    hasPlatformCredit: true,
    networkStatus: 'normal',
    taskType: 'image',
  };

  const decision = decideRoute(context);
  assert.equal(decision.mode, 'local-runner');
  assert.equal(decision.fallback, undefined);

  const unavailable = decideRoute({ ...context, localRunnerAvailable: false, hasLocalUserKey: false });
  assert.equal(unavailable.mode, 'local-runner');
  assert.equal(unavailable.fallback, undefined);
  assert.match(unavailable.reason, /strict local/i);
});
