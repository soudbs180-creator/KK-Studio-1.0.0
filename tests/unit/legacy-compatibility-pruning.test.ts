import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = process.cwd();

function resolveWorkspacePath(relativePath: string): string {
  return path.join(ROOT_DIR, relativePath);
}

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(resolveWorkspacePath(relativePath), "utf8");
}



test("dead browser payment compatibility client is removed once the static recharge flow is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/api/paymentSidecarClient.ts")),
    false,
  );
});

test("dead secure model caller wrapper is removed once modelCaller is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/model/secureModelCaller.ts")),
    false,
  );
});

test("dead supabase user-api cloud shim is removed once cloud-record naming is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/api/supabaseUserApiCloudStorage.ts")),
    false,
  );
});

test("dead legacy user-api key facade is removed once cloud-record storage is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/api/userApiKeyService.ts")),
    false,
  );
});

test("dead CLI proxy facade is removed once browser runtime no longer routes through it", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/api/cliProxyService.ts")),
    false,
  );
});

test("dead admin model advisor helper is removed once admin pricing suggestions are no longer sourced there", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/model/adminModelAdvisor.ts")),
    false,
  );
});

test("dead 12AI alias shim is removed once the canonical service name is AI12APIService", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/api/api12AIService.ts")),
    false,
  );
});

test("dead AI12 API service is removed once provider routing owns 12AI execution", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/api/AI12APIService.ts")),
    false,
  );
});

test("dead NewAPI admin storage helper is removed once the admin view is read-only", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/api/newApiAdmin.ts")),
    false,
  );
});

test("dead read-only API placeholder views are removed once settings becomes the only entrypoint", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/api/ApiManagementView.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/api/NewApiAdminView.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/api/UnifiedApiView.tsx")),
    false,
  );
});

test("dead API modal/card components are removed once ApiSettingsView becomes the canonical management surface", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/api/AddProviderModal.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/api/KeySlotModal.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/api/ThirdPartyProviderCard.tsx")),
    false,
  );
});

test("dead admin model catalog refresh helper is removed once refresh logic lives in adminModelService", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/model/adminModelCatalogRefresh.ts")),
    false,
  );
});

test("dead secure-storage example script is removed once hardened helpers are consumed only through live surfaces", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/security/example-usage.ts")),
    false,
  );
});

test("dead user-api key settings subtree is removed once ApiSettingsView is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/settings/UserApiKeySettings.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/settings/SecureApiKeyManager.tsx")),
    false,
  );
});

test("dead settings demo and legacy management views are removed once localized settings routing is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/settings/SettingsDemo.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/settings/SettingsImprovementShowcase.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/components/settings/AgentManagementView.tsx")),
    false,
  );
});

test("dead apiKeySecureStorage facade is removed once ApiSettingsView owns BYOK management", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("apps/web/src/services/security/apiKeySecureStorage.ts")),
    false,
  );
});

test("no runtime source keeps ViaSupabase alias naming after the cloud-record migration", () => {
  const source = readSource("apps/web/src/services/api/userApiCloudRecordStorage.ts");
  assert.doesNotMatch(source, /ViaSupabase/);
});

test("retired public static surfaces are removed from the current web runtime", () => {
  for (const retiredPath of [
    "apps/web/public/newgenre_static",
    "apps/web/public/pay/success",
    "scripts/alipay",
    "docs/setup/ALIPAY_MCP.md",
  ]) {
    assert.equal(
      existsSync(resolveWorkspacePath(retiredPath)),
      false,
      `${retiredPath} must stay out of the current v1.5.8 runtime`,
    );
  }
});

test("current runtime no longer exposes payment v1 or Alipay callback protocol", () => {
  const adminCompatSource = readWorkspaceFile("server/routes/compat/admin.js");
  const billingCompatSource = readWorkspaceFile("server/routes/compat/billing.js");
  const sharedClientSource = readWorkspaceFile("packages/shared/src/contracts/client/kk-api-client.ts");
  const sharedContractsIndexSource = readWorkspaceFile("packages/shared/src/contracts/index.ts");
  const statusEnumsSource = readWorkspaceFile("packages/shared/src/contracts/enums/status.ts");
  const openApiSource = readWorkspaceFile("docs/specs/openapi.yaml");
  const specGuardSource = readWorkspaceFile("scripts/architecture/check-spec-structure.mjs");

  for (const source of [
    adminCompatSource,
    billingCompatSource,
    sharedClientSource,
    sharedContractsIndexSource,
    statusEnumsSource,
    openApiSource,
  ]) {
    assert.doesNotMatch(source, /\/payment\/v1/);
    assert.doesNotMatch(source, /callbacks\/alipay/);
    assert.doesNotMatch(source, /AlipayCallback|CreatePaymentOrder|PaymentOrderDto|PaymentCallback|PaymentOrderStatusView/);
    assert.doesNotMatch(source, /createPaymentOrder|getPaymentOrderStatus/);
  }

  assert.equal(
    existsSync(resolveWorkspacePath("packages/shared/src/contracts/dto/payment.ts")),
    false,
  );
  assert.match(specGuardSource, /\/api\/v1\/billing\/recharge-submissions/);
  assert.doesNotMatch(specGuardSource, /\/payment\/v1/);
});

test("api-client package does not retain legacy endpoint wrappers or browser storage ownership", () => {
  const packageJson = JSON.parse(readWorkspaceFile("packages/api-client/package.json"));
  const indexSource = readWorkspaceFile("packages/api-client/src/index.ts");

  for (const retiredSource of [
    "packages/api-client/src/api.ts",
    "packages/api-client/src/client.ts",
    "packages/api-client/src/hooks.ts",
  ]) {
    assert.equal(
      existsSync(resolveWorkspacePath(retiredSource)),
      false,
      `${retiredSource} must not return as a legacy HTTP wrapper`,
    );
  }

  assert.deepEqual(packageJson.dependencies, { "@kk/shared": "*" });
  assert.equal(packageJson.peerDependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.equal(indexSource.trim(), 'export * from "@kk/shared";');
});
