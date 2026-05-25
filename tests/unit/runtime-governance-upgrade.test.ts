import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



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

  assert.match(rootGuideSource, /### Runtime Layout \(严格 AGENTS\)/);
  assert.match(rootGuideSource, /- `apps\/web\/` 为唯一的桌面端 Web 前端运行时。/);
  assert.match(rootGuideSource, /- `apps\/mobile\/` 为手机端 Expo 应用。/);

  assert.match(handoffSource, /当前在线前端运行时：根目录 `src\/`/);
  assert.match(handoffSource, /目标前端运行时：`apps\/web\/`/);
  assert.match(handoffSource, /`apps\/payment-sidecar\/` is the canonical payment runtime/);
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
  assert.match(packageJson.scripts.typecheck, /npm run typecheck:payment-server/);
  assert.equal(packageJson.scripts["typecheck:payment-server"], "node scripts/ci/check-payment-server.mjs");
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
