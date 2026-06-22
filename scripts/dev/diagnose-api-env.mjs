import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectEnvSnapshots,
  findSnapshotEntries,
  getEffectiveValue,
  isPlaceholder,
  summarizeValue,
} from "../lib/env-contract.mjs";

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_JSON_BODY_MAX_BYTES = 1024 * 1024;
const DEFAULT_PROFILE_JSON_BODY_MAX_BYTES = 4 * 1024 * 1024;
const passwordResetMailKeys = [
  "PASSWORD_RESET_TOKEN_SECRET",
  "PASSWORD_RESET_EMAIL_FROM",
  "RESEND_API_KEY",
];
const passwordResetPublicOriginKeys = [
  "PUBLIC_APP_URL",
  "KK_PUBLIC_APP_URL",
  "WEB_PUBLIC_URL",
];

function printKeyStatus(label, record) {
  if (!record) {
    console.log(`- ${label}: <missing>`);
    return;
  }

  console.log(`- ${label}: ${summarizeValue(record.value)} from ${record.source}`);
}

function isConfiguredEnvRecord(record) {
  const value = String(record?.value || "").trim();
  return Boolean(value) && !isPlaceholder(record.value);
}

function parsePositiveInteger(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchHealth() {
  const baseUrl = process.env.VITE_KK_API_BASE_URL || "http://127.0.0.1:3001";
  const url = `${baseUrl.replace(/\/+$/, "")}/healthz`;
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }
    const body = await response.json();
    const data = body?.data || body;
    return { ok: true, data: data || null };
  } catch (error) {
    return { ok: false, message: error?.message || "fetch failed" };
  }
}

async function run() {
  const snapshots = collectEnvSnapshots(rootPath);
  const frontendKeys = [
    "VITE_KK_API_BASE_URL",
    "VITE_PAYMENT_GATEWAY_URL",
    "VITE_AUTH_REDIRECT_ORIGIN",
    "VITE_TURNSTILE_ENABLED",
    "VITE_TURNSTILE_SITE_KEY",
  ];
  const apiServerKeys = [
    "DATABASE_URL",
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSSL",
    "PGSSLMODE",
    "USER_API_ENCRYPTION_SECRET",
    "PROFILE_USER_APIS_ENCRYPTION_SECRET",
    "KK_API_SESSION_SIGNING_SECRET",
    "PASSWORD_RESET_TOKEN_SECRET",
    "PASSWORD_RESET_EMAIL_FROM",
    "RESEND_API_KEY",
    "PUBLIC_APP_URL",
    "KK_PUBLIC_APP_URL",
    "WEB_PUBLIC_URL",
    "KK_API_MAX_JSON_BODY_BYTES",
    "KK_API_PROFILE_MAX_JSON_BODY_BYTES",
    "KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES",
  ];
  const ignoredLegacyDataProviderKeys = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ANON_KEY",
  ];
  const misplacedRootServerEnv = findSnapshotEntries(snapshots.frontendSnapshots, apiServerKeys);
  const ignoredLegacyDataProviderEnv = findSnapshotEntries(
    snapshots.activeSnapshots,
    ignoredLegacyDataProviderKeys,
  );

  console.log("[diagnose-api-env] Frontend env search order:");
  snapshots.searchedFiles.frontend.forEach((filePath) => {
    console.log(`- ${filePath}`);
  });

  console.log("[diagnose-api-env] Local API env search order:");
  snapshots.searchedFiles.api.forEach((filePath) => {
    console.log(`- ${filePath}`);
  });

  console.log("[diagnose-api-env] Ignored legacy env files:");
  snapshots.searchedFiles.ignoredLegacy.forEach((filePath) => {
    console.log(`- ${filePath}`);
  });

  console.log("[diagnose-api-env] Frontend public env sources:");
  frontendKeys.forEach((key) => {
    printKeyStatus(key, getEffectiveValue(snapshots.frontendSnapshots, key));
  });

  console.log("[diagnose-api-env] Local API server env sources:");
  apiServerKeys.forEach((key) => {
    printKeyStatus(key, getEffectiveValue(snapshots.apiSnapshots, key));
  });
  const passwordResetMailReady = passwordResetMailKeys.every((key) => isConfiguredEnvRecord(getEffectiveValue(snapshots.apiSnapshots, key)));
  const passwordResetPublicOriginReady = passwordResetPublicOriginKeys.some((key) => isConfiguredEnvRecord(getEffectiveValue(snapshots.apiSnapshots, key)));
  console.log("[diagnose-api-env] Password reset runtime readiness:");
  console.log(`- passwordResetMailReady: ${passwordResetMailReady}`);
  console.log(`- passwordResetPublicOriginReady: ${passwordResetPublicOriginReady}`);
  console.log(`- passwordResetReady: ${passwordResetMailReady && passwordResetPublicOriginReady}`);
  const configuredGlobalBodyLimit = getEffectiveValue(snapshots.apiSnapshots, "KK_API_MAX_JSON_BODY_BYTES")?.value;
  const configuredProfileBodyLimit = getEffectiveValue(snapshots.apiSnapshots, "KK_API_PROFILE_MAX_JSON_BODY_BYTES")?.value;
  const configuredKeyManagerBodyLimit = getEffectiveValue(snapshots.apiSnapshots, "KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES")?.value;
  const effectiveGlobalBodyLimit = parsePositiveInteger(configuredGlobalBodyLimit, DEFAULT_JSON_BODY_MAX_BYTES);
  const effectiveProfileBodyLimit = parsePositiveInteger(
    configuredProfileBodyLimit || configuredKeyManagerBodyLimit,
    Math.max(effectiveGlobalBodyLimit, DEFAULT_PROFILE_JSON_BODY_MAX_BYTES),
  );
  console.log("[diagnose-api-env] Local API JSON body limits:");
  console.log(`- default routes: ${effectiveGlobalBodyLimit} bytes`);
  console.log(`- profile persistence routes: ${effectiveProfileBodyLimit} bytes`);
  console.log("[diagnose-api-env] Ignored root server env entries:");
  if (misplacedRootServerEnv.length === 0) {
    console.log("- none");
  } else {
    misplacedRootServerEnv.forEach((entry) => {
      console.log(`- ${entry.key}: ${summarizeValue(entry.value)} from ${entry.source}`);
    });
  }

  console.log("[diagnose-api-env] Ignored legacy data-provider env entries:");
  if (ignoredLegacyDataProviderEnv.length === 0) {
    console.log("- none");
  } else {
    ignoredLegacyDataProviderEnv.forEach((entry) => {
      console.log(`- ${entry.key}: ${summarizeValue(entry.value)} from ${entry.source}`);
    });
  }

  const health = await fetchHealth();
  console.log("[diagnose-api-env] /healthz:");
  if (!health.ok) {
    console.log(`- unreachable: ${health.message}`);
    return;
  }

  const config = health.data?.config || {};
  const repos = health.data?.repositories || {};
  const persistence = health.data?.persistence || {};
  const runtime = health.data?.runtime || {};
  console.log(`- status: ${health.data?.status || "unknown"}`);
  console.log(`- config.hasPostgresConfig: ${Boolean(config.hasPostgresConfig)}`);
  console.log(`- config.hasValidPostgresConfig: ${Boolean(config.hasValidPostgresConfig)}`);
  console.log(`- config.databaseConfigStatus: ${config.databaseConfigStatus || "<unknown>"}`);
  console.log(`- config.hasUserApiEncryptionSecret: ${Boolean(config.hasUserApiEncryptionSecret)}`);
  console.log(`- config.canonicalPersistenceReady: ${Boolean(config.canonicalPersistenceReady)}`);
  console.log(`- repositories.authData: ${repos.authData || "unknown"}`);
  console.log(`- repositories.creditAccounts: ${repos.creditAccounts || "unknown"}`);
  console.log(`- repositories.creditProviders: ${repos.creditProviders || "unknown"}`);
  console.log(`- repositories.workspaceLayout: ${repos.workspaceLayout || "unknown"}`);
  console.log(`- persistence.userApiKeys: ${Boolean(persistence.userApiKeys)}`);
  console.log(`- persistence.tempUsers: ${Boolean(persistence.tempUsers)}`);
  console.log(`- persistence.credits: ${Boolean(persistence.credits)}`);
  console.log(`- persistence.creditProviders: ${Boolean(persistence.creditProviders)}`);
  console.log(`- persistence.workspaceLayout: ${Boolean(persistence.workspaceLayout)}`);
  console.log(`- runtime.allowDegradedPersistence: ${Boolean(runtime.allowDegradedPersistence)}`);
  console.log(`- runtime.blockers: ${Array.isArray(runtime.blockers) ? runtime.blockers.join(", ") || "<none>" : "<unknown>"}`);
}

run();
