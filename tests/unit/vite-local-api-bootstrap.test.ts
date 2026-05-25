import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("vite local API bootstrap uses the shared helper and keeps address-in-use recovery", () => {
  const source = readFileSync(path.join(ROOT_DIR, "scripts/dev/run-api-local.mjs"), "utf-8");

  assert.match(source, /startLocalApiServer/);
  assert.match(source, /KKAI_LOCAL_ONLY/);
  assert.match(source, /startLocalApiServer\(\{ skipConfigCheck: true \}\)/);
});
