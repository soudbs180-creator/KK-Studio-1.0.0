import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("run-api-local exists as a standalone local-only startup entry", () => {
  const scriptPath = path.join(ROOT_DIR, "scripts", "dev", "run-api-local.mjs");
  assert.equal(existsSync(scriptPath), true);

  if (!existsSync(scriptPath)) {
    return;
  }

  const source = readFileSync(scriptPath, "utf-8");
  assert.match(source, /startLocalApiServer/);
  assert.match(source, /KKAI_LOCAL_ONLY\s*=\s*"true"/);
  assert.match(source, /skipConfigCheck:\s*true/);
  assert.doesNotMatch(source, /startApiServer\(/);
  assert.doesNotMatch(source, /assertLocalApiConfig\(/);
});

test("local-only API startup skips database-backed reconciliation daemon", () => {
  const source = readFileSync(
    path.join(ROOT_DIR, "services", "api", "lib", "dispatcher", "reconciliation.js"),
    "utf-8",
  );

  assert.match(
    source,
    /function shouldSkipReconciliationDaemon/,
    "reconciliation startup should centralize runtime skip conditions",
  );
  assert.match(
    source,
    /process\.env\.KKAI_LOCAL_ONLY === 'true'/,
    "local-only runtime should not start the database-backed reconciliation daemon",
  );
  assert.match(
    source,
    /!\s*String\(process\.env\.DATABASE_URL \|\| ''\)\.trim\(\)/,
    "missing database URL should not start the database-backed reconciliation daemon",
  );
  assert.match(
    source,
    /if \(shouldSkipReconciliationDaemon\(\)\) \{/,
    "the reconciliation daemon should check skip conditions before scheduling database polling",
  );
});

test("server health route exposes the canonical KK API health envelope", () => {
  const source = readFileSync(path.join(ROOT_DIR, "services", "api", "index.js"), "utf-8");

  assert.match(source, /app\.get\('\/healthz'/);
  assert.match(
    source,
    /success:\s*true/,
    "healthz should expose success:true for dev scripts and VPS probes",
  );
  assert.match(
    source,
    /service:\s*'kk-studio-api'/,
    "healthz should use the canonical KK Studio API service id",
  );
  assert.match(
    source,
    /status:\s*'ok'/,
    "healthz should expose an ok status for hosted readiness probes",
  );
  assert.match(
    source,
    /selfHostedCoreReady/,
    "healthz should expose the self-hosted runtime readiness flag",
  );
  assert.match(
    source,
    /canonicalPersistenceReady/,
    "healthz should expose canonical persistence readiness for remote API checks",
  );
});
