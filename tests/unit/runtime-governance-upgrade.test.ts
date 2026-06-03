import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("project docs publish one truth table for current and transitional runtimes", () => {
  const projectStructureSource = readSource("docs/architecture/PROJECT_STRUCTURE.md");
  const rootGuideSource = readSource("docs/PROJECT_ROOT_GUIDE.md");
  const handoffSource = readSource("docs/development/session-handoff.md");

  assert.match(projectStructureSource, /## Runtime truth table/);
  assert.match(projectStructureSource, /\| `apps\/web\/` \| primary Web runtime \|/);
  assert.match(projectStructureSource, /\| `apps\/mobile\/` \| mobile workspace \|/);
  assert.match(projectStructureSource, /\| `packages\/shared\/` \| pure shared logic \|/);
  assert.match(projectStructureSource, /\| `server\/` \| Express \/ VPS backend \|/);

  assert.match(rootGuideSource, /Runtime Layout/);
  assert.match(rootGuideSource, /PROJECT_STRUCTURE/);

  assert.match(handoffSource, /Primary Web runtime: `apps\/web\/`/);
  assert.match(handoffSource, /Mobile workspace: `apps\/mobile\/`/);
});

test("verification chain includes integration tests and payment-server static checks", () => {
  const packageJson = JSON.parse(readSource("package.json")) as {
    scripts: Record<string, string>;
  };
  const testsTsconfig = JSON.parse(readSource("tsconfig.tests.json")) as {
    include: string[];
    exclude?: string[];
  };

  assert.equal(packageJson.scripts["test:integration"], "node --test --test-isolation=none \"tests/integration/*.test.ts\"");
  assert.equal(packageJson.scripts["test:contract"], "node --test --test-isolation=none \"tests/contract/*.test.ts\"");
  assert.equal(packageJson.scripts["test:e2e"], "node --test --test-isolation=none \"tests/e2e/*.test.ts\"");
  assert.match(packageJson.scripts.test, /npm run test:integration/);
  assert.match(packageJson.scripts.typecheck, /npm run typecheck:server/);
  assert.equal(packageJson.scripts["typecheck:server"], "node scripts/ci/check-server.mjs");
  assert.match(packageJson.scripts["verify:changes"], /npm run test/);
  assert.match(packageJson.scripts["verify:changes"], /verify:prompt-group-drag/);
  assert.match(packageJson.scripts["verify:changes"], /verify:mobile-settings-smoke/);
  assert.match(packageJson.scripts["verify:changes"], /verify:desktop-settings-smoke/);
  assert.ok(testsTsconfig.include.includes("tests/integration/**/*.ts"));
  assert.ok(testsTsconfig.include.includes("tests/unit/**/*.ts"));
  assert.ok(testsTsconfig.include.includes("tests/unit/runtime-governance-upgrade.test.ts"));
  assert.ok(testsTsconfig.include.includes("tests/contract/**/*.ts"));
  assert.ok((testsTsconfig.exclude || []).includes("tests/e2e/**/*.ts"));
});

test("version governance checks internal package versions against the release manifest", () => {
  const versionCheckSource = readSource("scripts/governance/check-version-consistency.mjs");

  assert.match(versionCheckSource, /packages\/contracts\/package\.json/);
  assert.match(versionCheckSource, /packages\/domain\/package\.json/);
  assert.match(versionCheckSource, /packages\/shared\/package\.json/);
});
