import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../support/workspacePaths.js";

test("api diagnose reports password reset runtime readiness without exposing secrets", () => {
  const source = readSource("scripts/dev/diagnose-api-env.mjs");

  [
    "PASSWORD_RESET_TOKEN_SECRET",
    "PASSWORD_RESET_EMAIL_FROM",
    "RESEND_API_KEY",
  ].forEach((key) => {
    assert.match(
      source,
      new RegExp(`apiServerKeys[\\s\\S]*"${key}"`),
      `${key} should be included in API env source diagnostics and root-env misplacement checks`,
    );
  });

  [
    "PUBLIC_APP_URL",
    "KK_PUBLIC_APP_URL",
    "WEB_PUBLIC_URL",
  ].forEach((key) => {
    assert.match(
      source,
      new RegExp(`passwordResetPublicOriginKeys[\\s\\S]*"${key}"`),
      `${key} should count toward the password reset public origin readiness check`,
    );
  });

  assert.match(
    source,
    /\[diagnose-api-env\] Password reset runtime readiness:/,
    "api:diagnose should print a focused password reset readiness section",
  );
  assert.match(
    source,
    /passwordResetMailReady/,
    "api:diagnose should compute whether reset email delivery is configured",
  );
  assert.match(
    source,
    /passwordResetPublicOriginReady/,
    "api:diagnose should compute whether reset links can use a stable public app origin",
  );
});

test("api diagnose requires password reset env values to be non-empty and non-placeholder", () => {
  const source = readSource("scripts/dev/diagnose-api-env.mjs");

  assert.match(
    source,
    /isPlaceholder/,
    "api:diagnose should reuse shared placeholder detection instead of counting placeholder values as ready",
  );
  assert.match(
    source,
    /function isConfiguredEnvRecord/,
    "api:diagnose should centralize configured-value checks for readiness booleans",
  );
  assert.match(
    source,
    /String\(record\?\.value \|\| ""\)\.trim\(\)/,
    "api:diagnose should reject blank env values when computing readiness",
  );
  assert.match(
    source,
    /!isPlaceholder\(record\.value\)/,
    "api:diagnose should reject placeholder env values when computing readiness",
  );
  assert.match(
    source,
    /passwordResetMailKeys\.every\(\(key\) => isConfiguredEnvRecord\(getEffectiveValue\(snapshots\.apiSnapshots, key\)\)\)/,
    "password reset mail readiness should require all mail env records to contain real values",
  );
  assert.match(
    source,
    /passwordResetPublicOriginKeys\.some\(\(key\) => isConfiguredEnvRecord\(getEffectiveValue\(snapshots\.apiSnapshots, key\)\)\)/,
    "password reset public origin readiness should require at least one real public origin value",
  );
});

test("api diagnose accepts top-level KK API health envelopes", () => {
  const source = readSource("scripts/dev/diagnose-api-env.mjs");

  assert.match(
    source,
    /const data = body\?\.data \|\| body;/,
    "api:diagnose should read both wrapped health payloads and top-level /healthz envelopes",
  );
  assert.match(
    source,
    /return \{ ok: true, data: data \|\| null \};/,
    "api:diagnose should pass the normalized health data into the runtime summary",
  );
});
