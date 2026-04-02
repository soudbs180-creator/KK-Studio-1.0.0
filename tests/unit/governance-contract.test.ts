import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import releaseManifest from "../../config/release-manifest.json" with { type: "json" };
import {
  APP_DISPLAY_VERSION,
  APP_RELEASE_DATE,
  APP_RELEASE_NOTES,
  APP_VERSION,
} from "../../src/config/appInfo.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function collectSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(ROOT_DIR, relativeDir);
  const collected: string[] = [];

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(ROOT_DIR, absolutePath).split(path.sep).join("/");

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      collected.push(...collectSourceFiles(relativePath));
      continue;
    }

    if (/\.(?:ts|tsx)$/.test(entry.name)) {
      collected.push(relativePath);
    }
  }

  return collected;
}

test("release manifest stays aligned with runtime app info", () => {
  const appInfoSource = readSource("src/config/appInfo.ts");

  assert.match(appInfoSource, /export const APP_NAME = releaseManifest\.appName;/);
  assert.match(appInfoSource, /export const APP_VERSION = releaseManifest\.version;/);
  assert.match(appInfoSource, /export const APP_DISPLAY_VERSION = releaseManifest\.displayVersion;/);
  assert.match(appInfoSource, /export const APP_RELEASE_DATE = releaseManifest\.releaseDate;/);
  assert.equal(APP_VERSION, releaseManifest.version);
  assert.equal(APP_DISPLAY_VERSION, releaseManifest.displayVersion);
  assert.equal(APP_RELEASE_DATE, releaseManifest.releaseDate);
  assert.deepEqual(APP_RELEASE_NOTES, releaseManifest.releaseNotes);
});

test("compatibility layer registry tracks the required migration files", () => {
  const registry = JSON.parse(readSource("docs/architecture/COMPATIBILITY_LAYER_REGISTRY.json")) as {
    entries: Array<{ path: string; regressionTests: string[]; removalCondition: string }>;
  };

  const requiredEntries = [
    "src/services/billing/costSyncBridge.ts",
    "src/services/llm/syncImageBridge.ts",
    "src/services/model/modelPricingOverrideBridge.ts",
    "src/workflow/adapters/workflowToLegacy.ts",
    "src/components/settings/SettingsPanel.v2.tsx",
    "src/components/settings/SettingsScaffold.tsx",
    "apps/api/src/modules/auth/presentation/mount-legacy-auth-routes.ts",
    "apps/api/src/modules/billing/presentation/mount-legacy-billing-routes.ts",
    "apps/api/src/modules/billing/infrastructure/legacy-billing-router-adapter.ts",
    "payment-server/runtime_payment_bridge.js",
    "payment-server/sidecar_compat_bridge.js",
    "payment-server/settlement_bridge.js"
  ];

  for (const requiredEntry of requiredEntries) {
    const entry = registry.entries.find((candidate) => candidate.path === requiredEntry);
    assert.ok(entry, `missing compatibility registry entry for ${requiredEntry}`);
    assert.ok(entry?.regressionTests.length, `${requiredEntry} must list regression tests`);
    assert.ok(entry?.removalCondition, `${requiredEntry} must define a removal condition`);
  }
});

test("migration allowlist registry tracks every approved architecture exception with ownership metadata", () => {
  const registry = JSON.parse(readSource("docs/architecture/MIGRATION_ALLOWLIST_REGISTRY.json")) as {
    serviceAppImports: Array<{
      source: string;
      targets: string[];
      reason: string;
      regressionTests: string[];
      removalCondition: string;
    }>;
    legacyZoneModuleImports: Array<{
      source: string;
      targets: string[];
      reason: string;
      regressionTests: string[];
      removalCondition: string;
    }>;
    frontendSupabaseAccess: Array<{
      path: string;
      reason: string;
      regressionTests: string[];
      removalCondition: string;
    }>;
  };

  const serviceImport = registry.serviceAppImports.find(
    (entry) => entry.source === "apps/payment-sidecar/src/server.ts",
  );
  assert.ok(serviceImport, "missing service-app migration allowlist entry for apps/payment-sidecar/src/server.ts");
  assert.deepEqual(serviceImport?.targets, ["apps/api/src/lib/request-authenticator.ts"]);
  assert.ok(serviceImport?.reason);
  assert.ok(serviceImport?.regressionTests.length);
  assert.ok(serviceImport?.removalCondition);

  const requiredLegacyZoneEntries = [
    "server/auth_routes.ts",
    "server/billing_routes.ts",
  ];

  for (const requiredEntry of requiredLegacyZoneEntries) {
    const entry = registry.legacyZoneModuleImports.find((candidate) => candidate.source === requiredEntry);
    assert.ok(entry, `missing legacy-zone migration allowlist entry for ${requiredEntry}`);
    assert.ok(entry?.targets.length, `${requiredEntry} must list target module imports`);
    assert.ok(entry?.reason, `${requiredEntry} must define a rationale`);
    assert.ok(entry?.regressionTests.length, `${requiredEntry} must list regression tests`);
    assert.ok(entry?.removalCondition, `${requiredEntry} must define a removal condition`);
  }

  const requiredFrontendEntries = [
    "src/services/api/supabaseUserApiCloudStorage.ts",
    "src/services/security/apiKeySecureStorage.ts",
  ];

  for (const requiredEntry of requiredFrontendEntries) {
    const entry = registry.frontendSupabaseAccess.find((candidate) => candidate.path === requiredEntry);
    assert.ok(entry, `missing frontend Supabase migration allowlist entry for ${requiredEntry}`);
    assert.ok(entry?.reason, `${requiredEntry} must define a rationale`);
    assert.ok(entry?.regressionTests.length, `${requiredEntry} must list regression tests`);
    assert.ok(entry?.removalCondition, `${requiredEntry} must define a removal condition`);
  }
});

test("auth access token compatibility storage is session-scoped and clears legacy localStorage", () => {
  const source = readSource("src/services/api/authAccessToken.ts");

  assert.match(source, /sessionStorage/);
  assert.match(source, /localStorage\?\.removeItem\(accessTokenStorageKey\);/);
  assert.doesNotMatch(source, /window\.localStorage\.setItem\(accessTokenStorageKey,/);
});

test("sensitive UI and payment webhook logs avoid raw secret-bearing payloads", () => {
  const apiChannelsSource = readSource("src/components/api/ApiChannelsView.tsx");
  const supplierModalSource = readSource("src/components/api/SupplierModal.tsx");
  const paymentWebhookSource = readSource("payment-server/webhook.js");
  const apiSaveLogMatch = apiChannelsSource.match(
    /console\.log\('\[ApiChannelsView\] 保存前的数据:', \{[\s\S]*?\n\s*\}\);/,
  );
  assert.ok(apiSaveLogMatch, "missing the API channel save summary log");
  const apiSaveLog = apiSaveLogMatch[0];

  assert.doesNotMatch(apiSaveLog, /\bkeyData\b/);
  assert.doesNotMatch(apiSaveLog, /\bformKey\b/);
  assert.match(apiSaveLog, /hasKey:\s*hasFormKey/);

  const supplierSubmitLogMatch = supplierModalSource.match(
    /console\.log\('\[SupplierModal\] Submitting form:', \{[\s\S]*?\n\s*\}\);/,
  );
  assert.ok(supplierSubmitLogMatch, "missing the supplier submit summary log");
  const supplierSubmitLog = supplierSubmitLogMatch[0];

  assert.doesNotMatch(supplierSubmitLog, /\bapiKey\b\s*:/);
  assert.doesNotMatch(supplierSubmitLog, /\bsystemToken\b\s*:/);
  assert.doesNotMatch(supplierModalSource, /console\.log\('\[SupplierModal\] Submitting form:',\s*formData\)/);
  assert.match(supplierSubmitLog, /hasPrimaryCredential/);
  assert.match(supplierSubmitLog, /hasCatalogAccess/);

  const alipayNotifyLogMatch = paymentWebhookSource.match(
    /console\.log\('\[payment-webhook\] Received Alipay notify:', \{[\s\S]*?\n\s*\}\);/,
  );
  assert.ok(alipayNotifyLogMatch, "missing the Alipay webhook summary log");
  const alipayNotifyLog = alipayNotifyLogMatch[0];

  assert.doesNotMatch(alipayNotifyLog, /\bpostData\b/);
  assert.doesNotMatch(alipayNotifyLog, /\bpassback_params\b/);
  assert.match(alipayNotifyLog, /\boutTradeNo\b/);
  assert.match(alipayNotifyLog, /\btradeStatus\b/);
});

test("shared logging helpers redact sensitive payload fields before persistence or console output", () => {
  const systemLogSource = readSource("src/services/system/systemLogService.ts");
  const billingObservabilitySource = readSource("billing/observability.ts");

  assert.match(systemLogSource, /function sanitizeLogText\(value\?: string \| null\): string \{/);
  assert.match(systemLogSource, /message: sanitizeLogText\(entry\.message\),/);
  assert.match(systemLogSource, /const sanitizedMessage = sanitizeLogText\(message\);/);
  assert.match(systemLogSource, /storage\?\.removeItem\(STORAGE_KEY\);/);
  assert.match(billingObservabilitySource, /function sanitizeBillingPayload\(payload: unknown\): string \{/);
  assert.doesNotMatch(billingObservabilitySource, /console\.log\(`\[Billing\]\[\$\{ts\}\]\[\$\{eventType\}\] \$\{JSON\.stringify\(payload\)\}`\)/);
});

test("cross-package imports use public package index entrypoints instead of deep src paths", () => {
  const files = [
    ...collectSourceFiles("apps"),
    ...collectSourceFiles("src"),
    ...collectSourceFiles("tests"),
  ];

  for (const file of files) {
    const source = readSource(file);
    const deepImportMatches = source.match(/packages\/[^/]+\/src\/(?!index\.(?:ts|tsx|mts|cts))/g) || [];
    assert.deepEqual(
      deepImportMatches,
      [],
      `${file} still reaches into a package internals path instead of the public index entrypoint`,
    );
  }
});

test("payment-server legacy shell delegates order creation through the sidecar compatibility bridge while billing fallback stays health-gated", () => {
  const paymentServerSource = readSource("payment-server/index.js");
  const paymentWebhookSource = readSource("payment-server/webhook.js");
  const billingContextSource = readSource("src/context/BillingContext.tsx");

  assert.match(paymentServerSource, /require\('\.\/sidecar_compat_bridge'\)/);
  assert.match(paymentServerSource, /handleLegacyCreateQrCodeThroughSidecar/);
  assert.match(paymentServerSource, /handleLegacyRedirectThroughSidecar/);
  assert.doesNotMatch(paymentServerSource, /persistLegacyPaymentOrder/);
  assert.doesNotMatch(paymentServerSource, /persistLegacyOrderSnapshot/);
  assert.match(paymentWebhookSource, /require\('\.\/sidecar_compat_bridge'\)/);
  assert.match(paymentWebhookSource, /handleLegacyPaymentCallbackThroughSidecar/);
  assert.doesNotMatch(paymentWebhookSource, /require\('\.\/runtime_payment_bridge'\)/);
  assert.match(billingContextSource, /import \{ legacyWebApiClient \} from '\.\.\/services\/api\/kkApiClient';/);
  assert.match(billingContextSource, /legacyWebApiClient\.getCreditBalance\(buildBillingRequestOptions\(apiAccessToken\)\)/);
  assert.match(billingContextSource, /legacyWebApiClient\.debitCredits\(\{/);
  assert.match(billingContextSource, /legacyWebApiClient\.refundCredits\(\{/);
  assert.doesNotMatch(billingContextSource, /import \{ supabase \} from '\.\.\/lib\/supabase';/);
  assert.doesNotMatch(billingContextSource, /\.from\('user_credits'\)/);
  assert.doesNotMatch(billingContextSource, /\.from\('credit_transactions'\)/);
});
