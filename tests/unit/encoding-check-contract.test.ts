import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("encoding check scans root docs and env examples with readable messaging", () => {
  const source = readFileSync(path.join(ROOT_DIR, "scripts", "check-encoding.js"), "utf-8");

  assert.match(source, /'README\.md'/);
  assert.match(source, /'PROJECT_ROOT_GUIDE\.md'/);
  assert.match(source, /'\.env\.example'/);
  assert.match(source, /'\.agent'/);
  assert.match(source, /apps', 'api', '\.env\.local\.example'/);
  assert.match(source, /Found suspicious mojibake text/);
  assert.match(source, /Encoding check passed/);
});
