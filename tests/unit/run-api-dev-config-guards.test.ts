import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("run-api-dev only uses primary env files and fails fast on missing VPS PostgreSQL config", () => {
  const bootstrapSource = readFileSync(path.join(ROOT_DIR, "scripts", "lib", "local-api-bootstrap.mjs"), "utf-8");
  const cliSource = readFileSync(path.join(ROOT_DIR, "scripts", "dev", "run-api-dev.mjs"), "utf-8");
  const localOnlyCliSource = readFileSync(path.join(ROOT_DIR, "scripts", "dev", "run-api-local.mjs"), "utf-8");

  assert.match(bootstrapSource, /applyPrimaryEnvToProcess\(repoRoot\)/);
  assert.match(bootstrapSource, /probeServerRuntimePersistence/);
  assert.match(bootstrapSource, /DATABASE_URL/);
  assert.match(bootstrapSource, /PGHOST/);
  assert.match(bootstrapSource, /USER_API_ENCRYPTION_SECRET is missing/);
  assert.match(bootstrapSource, /PostgreSQL persistence probe failed/);
  assert.match(bootstrapSource, /VPS PostgreSQL config is incomplete/);
  assert.match(bootstrapSource, /apps\/api\/\.env\.local\.example/);
  assert.match(bootstrapSource, /KK_API_PROFILE_MAX_JSON_BODY_BYTES/);
  assert.match(bootstrapSource, /KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES/);
  assert.match(bootstrapSource, /applyLocalApiBodyLimitDefaults\(\)/);
  assert.doesNotMatch(bootstrapSource, /canonical Supabase config/);
  assert.doesNotMatch(bootstrapSource, /service-role\/secret key/);
  assert.doesNotMatch(bootstrapSource, /Point both to the same Supabase project/);
  assert.doesNotMatch(bootstrapSource, /server", "\.env/);

  assert.match(cliSource, /from "\.\.\/lib\/local-api-bootstrap\.mjs"/);
  assert.match(cliSource, /await assertLocalApiConfig\(\)/);
  assert.match(cliSource, /await startLocalApiServer\(\{ skipConfigCheck: true \}\)/);

  assert.match(localOnlyCliSource, /from "\.\.\/lib\/local-api-bootstrap\.mjs"/);
  assert.match(localOnlyCliSource, /process\.env\.KKAI_LOCAL_ONLY = "true"/);
  assert.doesNotMatch(localOnlyCliSource, /assertLocalApiConfig/);
  assert.match(localOnlyCliSource, /await startLocalApiServer\(\{ skipConfigCheck: true \}\)/);
});

test("VPS tunnel dev wrapper rewrites DATABASE_URL to an existing local PostgreSQL tunnel", () => {
  const tunnelCliSource = readFileSync(path.join(ROOT_DIR, "scripts", "dev", "run-api-dev-vps-tunnel.mjs"), "utf-8");

  assert.match(tunnelCliSource, /run-api-dev\.mjs/);
  assert.match(tunnelCliSource, /applyPrimaryEnvToProcess/);
  assert.match(tunnelCliSource, /DATABASE_URL/);
  assert.match(tunnelCliSource, /KK_PG_TUNNEL_HOST/);
  assert.match(tunnelCliSource, /KK_PG_TUNNEL_PORT/);
  assert.match(tunnelCliSource, /127\.0\.0\.1/);
  assert.match(tunnelCliSource, /15432/);
  assert.match(tunnelCliSource, /PGSSLMODE/);
  assert.match(tunnelCliSource, /disable/);
  assert.match(tunnelCliSource, /net\.createConnection/);
  assert.doesNotMatch(tunnelCliSource, /\.codex-tmp-vps-key/);
  assert.doesNotMatch(tunnelCliSource, /codex-vps-key-readable/);
});
