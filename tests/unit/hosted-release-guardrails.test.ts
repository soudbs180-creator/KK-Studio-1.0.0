import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../support/workspacePaths.js";

test("hosted release preflight allows disabled frontend bypass flags", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(
    source,
    /VITE_ENABLE_LEGACY_WEB_API_FALLBACK[\s\S]*mode:\s*"enabled-flag"/,
    "legacy fallback should only block hosted releases when explicitly enabled",
  );
  assert.match(
    source,
    /VITE_TURNSTILE_LOCAL_BYPASS[\s\S]*mode:\s*"enabled-flag"/,
    "local Turnstile bypass should only block hosted releases when explicitly enabled",
  );
  assert.match(
    source,
    /isEnabledEnvFlag/,
    "hosted release preflight should distinguish disabled false-like flags from enabled bypasses",
  );
});

test("hosted release preflight rejects local API base URLs for hosted builds", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(
    source,
    /isLocalOrPrivateApiBaseUrl/,
    "hosted release preflight should classify loopback and private API origins",
  );
  assert.match(
    source,
    /Hosted frontend \$\{key\} must point at HTTPS, same-origin, or a deployed VPS API/,
    "hosted release preflight should block local API base URLs before deploy",
  );
  assert.match(
    source,
    /VITE_PUBLIC_API_BASE_URL/,
    "hosted release preflight should also guard the shared api-client base URL",
  );
});

test("hosted release preflight checks canonical VPS backend startup secrets", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  [
    "DATABASE_URL",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "PASSWORD_SALT",
    "JWT_SECRET",
    "KK_API_SESSION_SIGNING_SECRET",
    "USER_API_ENCRYPTION_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ].forEach((key) => {
    assert.match(
      source,
      new RegExp(`hostedApiRequired[\\s\\S]*"${key}"`),
      `${key} should be part of hosted API required env checks`,
    );
  });
});
