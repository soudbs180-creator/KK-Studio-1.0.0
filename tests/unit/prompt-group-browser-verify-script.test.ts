import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

test("package.json exposes a prompt-group browser verification script", () => {
  const pkg = JSON.parse(readSource("package.json")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(pkg.scripts?.["verify:prompt-group-drag"], "node scripts/test/verify-prompt-group-drag.mjs");
});

test("verify:changes pulls prompt-group browser verification into the main verification chain", () => {
  const pkg = JSON.parse(readSource("package.json")) as {
    scripts?: Record<string, string>;
  };

  const verifyChanges = pkg.scripts?.["verify:changes"] || "";
  const testScript = pkg.scripts?.test || "";

  assert.match(verifyChanges, /npm run test && npm run verify:prompt-group-drag/);
  assert.equal((verifyChanges.match(/verify:prompt-group-drag/g) || []).length, 1);
  assert.doesNotMatch(testScript, /verify:prompt-group-drag/);
});

test("prompt-group browser verification script checks both regrouping and connector following", () => {
  const source = readSource("scripts/test/verify-prompt-group-drag.mjs");

  assert.match(source, /mainDragGrouped/);
  assert.match(source, /childConnectorFollows/);
  assert.match(source, /throw new Error\(`Main-card drag did not regroup child cards under the parent:/);
  assert.match(source, /throw new Error\(`Child-card connector did not stay aligned with the dragged image:/);
});
