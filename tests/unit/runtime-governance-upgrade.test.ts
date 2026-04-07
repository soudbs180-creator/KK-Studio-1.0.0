import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

test("project docs publish one runtime truth table for current and transitional runtimes", () => {
  const projectStructureSource = readSource("docs/PROJECT_STRUCTURE.md");
  const rootGuideSource = readSource("PROJECT_ROOT_GUIDE.md");
  const handoffSource = readSource("docs/development/session-handoff.md");

  assert.match(projectStructureSource, /## Runtime truth table/);
  assert.match(projectStructureSource, /\| `src\/` \| `current-live-web` \|/);
  assert.match(projectStructureSource, /\| `apps\/web\/` \| `target-web` \|/);
  assert.match(projectStructureSource, /\| `apps\/api\/` \| `canonical-api` \|/);
  assert.match(projectStructureSource, /\| `apps\/payment-sidecar\/` \| `canonical-payment` \|/);
  assert.match(projectStructureSource, /\| `payment-server\/` \| `transition-bridge` \|/);

  assert.match(rootGuideSource, /current live web runtime is root `src\/`/);
  assert.match(rootGuideSource, /target web runtime is `apps\/web\/`/);
  assert.match(rootGuideSource, /`server\/`, `api\/`, and `payment-server\/` remain transitional/);

  assert.match(handoffSource, /当前在线前端运行时：根目录 `src\/`/);
  assert.match(handoffSource, /目标前端运行时：`apps\/web\/`/);
  assert.match(handoffSource, /主支付运行时：`apps\/payment-sidecar\/`/);
  assert.match(handoffSource, /`payment-server\/` 仍是过渡桥接层/);
});

test("verification chain includes integration tests and payment-server static checks", () => {
  const packageJson = JSON.parse(readSource("package.json")) as {
    scripts: Record<string, string>;
  };
  const testsTsconfig = JSON.parse(readSource("tsconfig.tests.json")) as {
    include: string[];
    exclude?: string[];
  };

  assert.equal(packageJson.scripts["test:integration"], "node --test \"tests/integration/*.test.ts\"");
  assert.match(packageJson.scripts.test, /npm run test:integration/);
  assert.match(packageJson.scripts.typecheck, /npm run typecheck:payment-server/);
  assert.equal(packageJson.scripts["typecheck:payment-server"], "node scripts/check-payment-server.mjs");
  assert.match(packageJson.scripts["verify:changes"], /npm run test/);
  assert.ok(testsTsconfig.include.includes("tests/integration/**/*.ts"));
  assert.ok(testsTsconfig.include.includes("tests/unit/payment-runtime-hardening.test.ts"));
  assert.ok((testsTsconfig.exclude || []).includes("tests/contract/**/*.ts"));
});

test("version governance checks internal package versions against the release manifest", () => {
  const versionCheckSource = readSource("scripts/governance/check-version-consistency.mjs");

  assert.match(versionCheckSource, /packages\/contracts\/package\.json/);
  assert.match(versionCheckSource, /packages\/domain\/package\.json/);
  assert.match(versionCheckSource, /packages\/shared\/package\.json/);
});
