import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("vite local API bootstrap uses the shared helper and keeps address-in-use recovery", () => {
  const source = readFileSync(path.join(ROOT_DIR, "vite.config.ts"), "utf-8");

  assert.match(source, /import\('\.\/scripts\/lib\/local-api-bootstrap\.mjs'\)/);
  assert.doesNotMatch(source, /import\('\.\/scripts\/run-api-dev\.mjs'\)/);
  assert.match(source, /await startLocalApiServer\(\)/);
  assert.match(source, /if \(!isAddressInUseError\(error\)\) {\s*throw error;\s*}/s);
  assert.match(source, /for \(let attempt = 0; attempt < 40; attempt \+= 1\)/);
  assert.match(source, /localApiServerPromise = null;/);
});
