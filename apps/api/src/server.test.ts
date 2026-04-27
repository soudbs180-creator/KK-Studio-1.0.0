import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import * as adminConsoleModule from "./modules/admin-console/index.ts";
import * as authModule from "./modules/auth/index.ts";
import * as billingModule from "./modules/billing/index.ts";
import * as modelCatalogModule from "./modules/model-catalog/index.ts";
import * as workspaceCanvasModule from "./modules/workspace-canvas/index.ts";

test("api module surfaces no longer expose Supabase runtime adapters", () => {
  const bannedExports = [
    ["admin-console", adminConsoleModule, ["SupabaseAdminConsoleRepository"]],
    ["auth", authModule, [
      "SupabaseAuthDataRepository",
      "SupabaseUserScopedAuthDataMirror",
      "SupabaseWechatAuthRepository",
    ]],
    ["billing", billingModule, [
      "SupabaseCreditAccountRepository",
      "SupabaseCreditExchangeRateRepository",
    ]],
    ["model-catalog", modelCatalogModule, ["SupabaseCreditProviderRepository"]],
    ["workspace-canvas", workspaceCanvasModule, ["SupabaseWorkspaceLayoutRepository"]],
  ] as const;

  for (const [label, moduleExports, exportNames] of bannedExports) {
    for (const exportName of exportNames) {
      assert.equal(
        exportName in moduleExports,
        false,
        `${label} should not export ${exportName}`,
      );
    }
  }
});

test("api server runtime no longer classifies Supabase repository backends", async () => {
  const serverSource = await readFile(new URL("./server.ts", import.meta.url), "utf8");
  const bannedPatterns = [
    /\|\s*"supabase"/,
    /\[\s*"supabase"\s*\]/,
    /SupabaseAdminConsoleRepository/,
    /SupabaseAuthDataRepository/,
    /SupabaseCreditAccountRepository/,
    /SupabaseCreditExchangeRateRepository/,
    /SupabaseCreditProviderRepository/,
    /SupabaseWorkspaceLayoutRepository/,
  ];

  for (const pattern of bannedPatterns) {
    assert.doesNotMatch(serverSource, pattern);
  }
});

test("auth data service no longer imports Supabase-specific cloud mirror contracts", async () => {
  const authDataServiceSource = await readFile(
    new URL("./modules/auth/application/auth-data-service.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(authDataServiceSource, /supabase-user-scoped-auth-data-mirror/);
});

test("api auth runtime copy no longer points users at Supabase flows", async () => {
  const authServiceSource = await readFile(
    new URL("./modules/auth/application/auth-service.ts", import.meta.url),
    "utf8",
  );
  const authDataServiceSource = await readFile(
    new URL("./modules/auth/application/auth-data-service.ts", import.meta.url),
    "utf8",
  );
  const legacyRoutesSource = await readFile(
    new URL("./modules/auth/presentation/mount-legacy-auth-routes.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(authServiceSource, /Supabase/);
  assert.doesNotMatch(authDataServiceSource, /Supabase/);
  assert.doesNotMatch(legacyRoutesSource, /Supabase/);
});

test("api runtime persistence probe no longer imports the Supabase client", async () => {
  const runtimeConfigSource = await readFile(
    new URL("./lib/server-runtime-config.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(runtimeConfigSource, /@supabase\/supabase-js/);
  assert.doesNotMatch(runtimeConfigSource, /\bcreateClient\b/);
});

test("hosted browser session cookies default to Secure even without an explicit cookie env flag", async () => {
  const serverSource = await readFile(new URL("./server.ts", import.meta.url), "utf8");

  assert.match(serverSource, /function resolveBrowserSessionCookieSecure\(\): boolean/);
  assert.match(serverSource, /if \(isHostedRuntime\(\)\) \{\s*return true;\s*\}/);
  assert.match(serverSource, /secure: resolveBrowserSessionCookieSecure\(\)/);
  assert.doesNotMatch(serverSource, /secure:\s*isTruthyValue\(process\.env\.KK_SESSION_COOKIE_SECURE\)/);
});
