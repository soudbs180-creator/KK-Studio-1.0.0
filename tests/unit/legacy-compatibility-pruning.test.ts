import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = process.cwd();

function resolveWorkspacePath(relativePath: string): string {
  return path.join(ROOT_DIR, relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(resolveWorkspacePath(relativePath), "utf8");
}

test("dead browser payment compatibility client is removed once the static recharge flow is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/api/paymentSidecarClient.ts")),
    false,
  );
});

test("dead secure model caller wrapper is removed once modelCaller is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/model/secureModelCaller.ts")),
    false,
  );
});

test("dead supabase user-api cloud shim is removed once cloud-record naming is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/api/supabaseUserApiCloudStorage.ts")),
    false,
  );
});

test("dead legacy user-api key facade is removed once cloud-record storage is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/api/userApiKeyService.ts")),
    false,
  );
});

test("dead CLI proxy facade is removed once browser runtime no longer routes through it", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/api/cliProxyService.ts")),
    false,
  );
});

test("dead admin model advisor helper is removed once admin pricing suggestions are no longer sourced there", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/model/adminModelAdvisor.ts")),
    false,
  );
});

test("dead 12AI alias shim is removed once the canonical service name is AI12APIService", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/api/api12AIService.ts")),
    false,
  );
});

test("dead AI12 API service is removed once provider routing owns 12AI execution", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/api/AI12APIService.ts")),
    false,
  );
});

test("dead NewAPI admin storage helper is removed once the admin view is read-only", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/api/newApiAdmin.ts")),
    false,
  );
});

test("dead read-only API placeholder views are removed once settings becomes the only entrypoint", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/api/ApiManagementView.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/api/NewApiAdminView.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/api/UnifiedApiView.tsx")),
    false,
  );
});

test("dead API modal/card components are removed once ApiSettingsView becomes the canonical management surface", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/api/AddProviderModal.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/api/KeySlotModal.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/api/ThirdPartyProviderCard.tsx")),
    false,
  );
});

test("dead admin model catalog refresh helper is removed once refresh logic lives in adminModelService", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/model/adminModelCatalogRefresh.ts")),
    false,
  );
});

test("dead secure-storage example script is removed once hardened helpers are consumed only through live surfaces", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/security/example-usage.ts")),
    false,
  );
});

test("dead user-api key settings subtree is removed once ApiSettingsView is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/settings/UserApiKeySettings.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/settings/SecureApiKeyManager.tsx")),
    false,
  );
});

test("dead settings demo and legacy management views are removed once localized settings routing is canonical", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/settings/SettingsDemo.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/settings/SettingsImprovementShowcase.tsx")),
    false,
  );
  assert.equal(
    existsSync(resolveWorkspacePath("src/components/settings/AgentManagementView.tsx")),
    false,
  );
});

test("dead apiKeySecureStorage facade is removed once ApiSettingsView owns BYOK management", () => {
  assert.equal(
    existsSync(resolveWorkspacePath("src/services/security/apiKeySecureStorage.ts")),
    false,
  );
});

test("no runtime source keeps ViaSupabase alias naming after the cloud-record migration", () => {
  const source = readSource("src/services/api/userApiCloudRecordStorage.ts");
  assert.doesNotMatch(source, /ViaSupabase/);
});
