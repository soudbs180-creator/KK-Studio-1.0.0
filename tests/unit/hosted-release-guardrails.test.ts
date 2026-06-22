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

test("hosted release preflight accepts scripted Vercel project metadata", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(
    source,
    /VERCEL_PROJECT_ID/,
    "hosted release preflight should allow VERCEL_PROJECT_ID as a non-interactive project link source",
  );
  assert.match(
    source,
    /VERCEL_ORG_ID/,
    "hosted release preflight should allow VERCEL_ORG_ID as a non-interactive project link source",
  );
  assert.match(
    source,
    /process\.env/,
    "scripted Vercel metadata should come from the process environment when .vercel/project.json is absent",
  );
});

test("hosted release scripts pass Vercel token through CLI args without exposing the value", () => {
  const diagnoseSource = readSource("scripts/diagnose-hosted-release.mjs");
  const releaseSource = readSource("scripts/release-hosted.mjs");

  assert.match(
    diagnoseSource,
    /--token/,
    "hosted preflight should authenticate Vercel CLI checks with VERCEL_TOKEN when present",
  );
  assert.match(
    releaseSource,
    /--token/,
    "hosted deployment should pass VERCEL_TOKEN through to Vercel CLI when present",
  );
  assert.match(
    releaseSource,
    /%VERCEL_TOKEN%|\$VERCEL_TOKEN/,
    "deployment logs should reference the env var instead of interpolating the raw token",
  );
});

test("hosted release preflight accepts remotely verified Vercel Git deployments", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(
    source,
    /KK_RELEASE_VERCEL_REMOTE_VERIFIED/,
    "hosted preflight should expose an explicit remote verification override for plugin/Git deployments",
  );
  assert.match(
    source,
    /\.kk-local\/hosted-release-verification\.json/,
    "hosted preflight should read the local remote verification artifact",
  );
  assert.match(
    source,
    /verification\.commitSha === currentHead/,
    "remote verification must match the current git HEAD",
  );
  assert.match(
    source,
    /verification\.projectId === vercelProject\.projectId/,
    "remote verification must match the linked Vercel project",
  );
  assert.match(
    source,
    /!vercelAuth\.authenticated && !vercelRemoteVerification\.verified/,
    "Vercel CLI auth should only block when no matching remote deployment has been verified",
  );
});

test("hosted release preflight covers password reset production readiness", () => {
  const diagnoseSource = readSource("scripts/diagnose-hosted-release.mjs");
  const vpsApiEnvSource = readSource("scripts/vps/kk-api.env.example");
  const localApiEnvSource = readSource("server/.env.local.example");
  const runbookSource = readSource("docs/development/hosted-release-runbook.md");

  [
    "RESEND_API_KEY",
    "PASSWORD_RESET_EMAIL_FROM",
    "PASSWORD_RESET_TOKEN_SECRET",
  ].forEach((key) => {
    assert.match(
      diagnoseSource,
      new RegExp(`hostedApiRequired[\\s\\S]*"${key}"`),
      `${key} should be a hosted API required env check for password reset delivery`,
    );
    assert.match(vpsApiEnvSource, new RegExp(`${key}=`), `${key} should be documented in the VPS API env template`);
    assert.match(localApiEnvSource, new RegExp(`${key}=`), `${key} should be documented in the local API env template`);
  });

  [
    "PUBLIC_APP_URL",
    "KK_PUBLIC_APP_URL",
    "WEB_PUBLIC_URL",
  ].forEach((key) => {
    assert.match(
      diagnoseSource,
      new RegExp(`hostedApiPasswordResetPublicOriginEnv[\\s\\S]*"${key}"`),
      `${key} should be accepted as a password reset public app origin env`,
    );
  });

  assert.match(
    diagnoseSource,
    /migrations\/013_password_reset_tokens\.sql/,
    "hosted preflight should know the password reset token migration must ship before enabling reset confirmation",
  );
  assert.match(
    diagnoseSource,
    /Confirm VPS PostgreSQL has applied/,
    "hosted preflight should tell operators to confirm the password reset migration is applied remotely",
  );
  assert.match(
    runbookSource,
    /Password Reset Production Readiness/,
    "hosted runbook should document password reset release requirements",
  );
});

test("hosted release preflight does not count blank or placeholder env values as present", () => {
  const source = readSource("scripts/diagnose-hosted-release.mjs");

  assert.match(
    source,
    /function isConfiguredEnvRecord/,
    "hosted preflight should centralize real-value detection",
  );
  assert.match(
    source,
    /String\(sourceRecord\?\.value \|\| ""\)\.trim\(\)/,
    "hosted preflight should reject blank env values",
  );
  assert.match(
    source,
    /!isPlaceholder\(sourceRecord\.value\)/,
    "hosted preflight should reject placeholder env values",
  );
  assert.match(
    source,
    /if \(!isConfiguredEnvRecord\(sourceRecord\)\) return "<missing>";/,
    "hosted preflight status output should not report blank env records as present",
  );
});
