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

test("verification chain includes integration tests and current backend static checks", () => {
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

test("version governance checks adjacent package-lock root versions", () => {
  const versionCheckSource = readSource("scripts/governance/check-version-consistency.mjs");

  assert.match(versionCheckSource, /packageLockTargets/);
  assert.match(versionCheckSource, /apps\/mobile\/package-lock\.json/);
  assert.match(versionCheckSource, /packages\?\.\[""\]\?\.version/);
  assert.match(versionCheckSource, /expectedVersion/);
});

test("version governance compares release metadata without requiring local build commit freshness", () => {
  const versionCheckSource = readSource("scripts/governance/check-version-consistency.mjs");

  assert.match(versionCheckSource, /function comparableVersionMetadata/);
  assert.match(versionCheckSource, /appName: manifest\.appName \?\? null/);
  assert.match(versionCheckSource, /releaseNotes: manifest\.releaseNotes \|\| \[\]/);
  assert.doesNotMatch(versionCheckSource, /buildTime: stablePortableManifest\.buildTime \?\? null/);
  assert.doesNotMatch(versionCheckSource, /commitSha: portableManifest\.commitSha/);
  assert.doesNotMatch(versionCheckSource, /commitShortSha: portableManifest\.commitShortSha/);
});

test("agent docs governance blocks stale AI assistant version drift", () => {
  const agentDocsSource = readSource("scripts/governance/check-agent-docs.mjs");

  assert.match(agentDocsSource, /requiredCurrentVersionDocs/);
  assert.match(agentDocsSource, /docs\/ai-assistant\/README\.md/);
  assert.match(agentDocsSource, /KK Studio \$\{currentDisplayVersion\}/);
  assert.match(agentDocsSource, /projectVersion: '\$\{releaseManifest\.version\}'/);
});

test("current facts governance blocks stale active governance document versions", () => {
  const manifest = JSON.parse(readSource("config/release-manifest.json")) as {
    version: string;
    displayVersion?: string;
  };
  const currentFactsSource = readSource("scripts/governance/check-current-facts.mjs");
  const activeGovernanceDocs = [
    "docs/governance/SECURITY_AND_BACKLOG.md",
    "docs/governance/VERSION_AND_RELEASE.md",
    "docs/governance/ENCODING_AND_POWERSHELL.md",
    "docs/governance/architecture_review.md",
  ];

  assert.match(currentFactsSource, /activeGovernanceVersionDocs/);
  assert.match(currentFactsSource, /staleDisplayVersions/);

  for (const docPath of activeGovernanceDocs) {
    const source = readSource(docPath);
    assert.match(source, new RegExp(manifest.displayVersion || `v${manifest.version}`));
    assert.doesNotMatch(source, /KK Studio v1\.5\.6|项目版本：KK Studio v1\.5\.6|`v1\.5\.6`/);
  }
});

test("current facts governance blocks stale active architecture and AI assistant versions", () => {
  const currentFactsSource = readSource("scripts/governance/check-current-facts.mjs");

  for (const docPath of [
    "docs/governance/DIAGNOSTICS_AND_DEBUGGING.md",
    "docs/architecture/PROJECT_STRUCTURE.md",
    "docs/specs/current-state-inventory.md",
    "docs/specs/API_INTEGRATION_GUIDE.md",
    "docs/ai-assistant/ui-map.md",
    "docs/ai-assistant/skills/README.md",
    "docs/ai-assistant/AI_ASSISTANT_ROADMAP.md",
  ]) {
    assert.match(currentFactsSource, new RegExp(docPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(currentFactsSource, /staleActiveVersionPattern/);
});

test("current facts governance protects current guidance from local and removed runtime paths", () => {
  const manifest = JSON.parse(readSource("config/release-manifest.json")) as {
    version: string;
    displayVersion?: string;
  };
  const currentFactsSource = readSource("scripts/governance/check-current-facts.mjs");
  const expectedDisplayVersion = manifest.displayVersion || `v${manifest.version}`;
  const currentGuidanceDocs = [
    "docs/INDEX.md",
    "docs/setup/README.md",
    "docs/architecture/NEW_ARCHITECTURE_SOURCE_OF_TRUTH.md",
    "docs/development/COMPLETE_DEVELOPMENT_GUIDE.md",
    "docs/development/multi-vendor-provider-architecture.md",
    "docs/specs/API_DOCS.md",
    "docs/specs/API_STABLE_BASELINE.md",
  ];

  assert.match(currentFactsSource, /activeCurrentGuidanceDocs/);
  assert.match(currentFactsSource, /absoluteUserPathPattern/);
  assert.match(currentFactsSource, /rootLegacyServicesPathPattern/);

  for (const docPath of currentGuidanceDocs) {
    assert.match(currentFactsSource, new RegExp(docPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const source = readSource(docPath);
    assert.match(source, new RegExp(expectedDisplayVersion.replace(/\./g, "\\.")));
    assert.doesNotMatch(source, /v1\.5\.9/);
    assert.doesNotMatch(source, /[a-z]:[\\/]users[\\/]/iu);
    assert.doesNotMatch(source, /(?<!apps\/web\/)src\/services\//u);
  }
});
