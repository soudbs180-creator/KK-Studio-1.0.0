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
