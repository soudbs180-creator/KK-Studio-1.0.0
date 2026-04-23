import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("run-api-dev only uses primary env files and fails fast on missing canonical Supabase config", () => {
  const bootstrapSource = readFileSync(path.join(ROOT_DIR, "scripts", "lib", "local-api-bootstrap.mjs"), "utf-8");
  const cliSource = readFileSync(path.join(ROOT_DIR, "scripts", "dev", "run-api-dev.mjs"), "utf-8");
  const localOnlyCliSource = readFileSync(path.join(ROOT_DIR, "scripts", "dev", "run-api-local.mjs"), "utf-8");

  assert.match(bootstrapSource, /applyPrimaryEnvToProcess\(repoRoot\)/);
  assert.match(bootstrapSource, /describeSupabaseServerKey/);
  assert.match(bootstrapSource, /probeServerSupabasePersistence/);
  assert.match(bootstrapSource, /SUPABASE_SERVICE_ROLE_KEY is missing or still using a placeholder/);
  assert.match(bootstrapSource, /not a valid Supabase service-role\/secret key/);
  assert.match(bootstrapSource, /did not pass the canonical Supabase probe/);
  assert.match(bootstrapSource, /looks like a database password copied from the connection string/);
  assert.match(bootstrapSource, /apps\/api\/\.env\.local\.example/);
  assert.match(bootstrapSource, /Point both to the same Supabase project/);
  assert.match(bootstrapSource, /KK_API_PROFILE_MAX_JSON_BODY_BYTES/);
  assert.match(bootstrapSource, /KK_API_KEY_MANAGER_MAX_JSON_BODY_BYTES/);
  assert.match(bootstrapSource, /applyLocalApiBodyLimitDefaults\(\)/);
  assert.doesNotMatch(bootstrapSource, /server", "\.env/);

  assert.match(cliSource, /from "\.\.\/lib\/local-api-bootstrap\.mjs"/);
  assert.match(cliSource, /await assertLocalApiConfig\(\)/);
  assert.match(cliSource, /await startLocalApiServer\(\{ skipConfigCheck: true \}\)/);

  assert.match(localOnlyCliSource, /from "\.\.\/lib\/local-api-bootstrap\.mjs"/);
  assert.match(localOnlyCliSource, /process\.env\.KKAI_LOCAL_ONLY = "true"/);
  assert.doesNotMatch(localOnlyCliSource, /assertLocalApiConfig/);
  assert.match(localOnlyCliSource, /await startLocalApiServer\(\{ skipConfigCheck: true \}\)/);
});
