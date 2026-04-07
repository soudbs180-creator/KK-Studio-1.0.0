import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("keyManager keeps a first-class Flow2API preset and runtime provider mapping", () => {
  const keyManagerSource = readSource("src/services/auth/keyManager.ts");

  assert.match(keyManagerSource, /'flow2api':\s*\{/);
  assert.match(keyManagerSource, /name:\s*'Flow2API'/);
  assert.match(keyManagerSource, /baseUrl:\s*'http:\/\/127\.0\.0\.1:8000'/);
  assert.match(keyManagerSource, /'Flow2API'\]\.includes\(p\.name\)/);
});
