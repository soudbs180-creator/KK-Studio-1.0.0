import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

const CHECKER_PATH = path.resolve('scripts/governance/check-compatibility-registry.mjs');
const fixtureRoots: string[] = [];

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

function createFixture(entries: unknown[]) {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'kk-compat-governance-'));
  fixtureRoots.push(fixtureRoot);

  mkdirSync(path.join(fixtureRoot, 'docs', 'architecture'), { recursive: true });
  mkdirSync(path.join(fixtureRoot, 'server', 'routes', 'compat'), { recursive: true });
  mkdirSync(path.join(fixtureRoot, 'tests', 'unit'), { recursive: true });

  writeFileSync(
    path.join(fixtureRoot, 'docs', 'architecture', 'COMPATIBILITY_LAYER_REGISTRY.json'),
    JSON.stringify({ generatedFromPlan: 'test fixture', entries }, null, 2),
  );
  writeFileSync(path.join(fixtureRoot, 'server', 'routes', 'compat', 'example.js'), 'module.exports = {};\n');
  writeFileSync(path.join(fixtureRoot, 'tests', 'unit', 'compat.test.ts'), '// fixture regression test\n');

  return fixtureRoot;
}

function runChecker(cwd: string) {
  return spawnSync(process.execPath, [CHECKER_PATH], {
    cwd,
    encoding: 'utf8',
  });
}

test('registered compatibility directories cover discovered descendant files', () => {
  const fixtureRoot = createFixture([
    {
      path: 'server/routes/compat',
      role: 'compatibility-layer',
      owner: 'server-platform',
      reviewBy: '2026-09-30',
      currentPurpose: 'Keeps transitional HTTP contracts available.',
      upstreamCanonicalSource: 'server/routes/apiRouter.js',
      downstreamDependents: ['apps/web/src/services/api/kkApiClient.ts'],
      riskLevel: 'high',
      regressionTests: ['tests/unit/compat.test.ts'],
      removalCondition: 'Delete after all consumers use typed v1 contracts.',
    },
  ]);

  const result = runChecker(fixtureRoot);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /1 registered layer/);
  assert.match(result.stdout, /1 discovered compatibility file/);
});

test('compatibility entries require accountable owner and review date metadata', () => {
  const fixtureRoot = createFixture([
    {
      path: 'server/routes/compat/example.js',
      role: 'compatibility-layer',
      currentPurpose: 'Keeps a transitional HTTP contract available.',
      upstreamCanonicalSource: 'server/routes/apiRouter.js',
      downstreamDependents: ['apps/web/src/services/api/kkApiClient.ts'],
      riskLevel: 'high',
      regressionTests: ['tests/unit/compat.test.ts'],
      removalCondition: 'Delete after all consumers use typed v1 contracts.',
    },
  ]);

  const result = runChecker(fixtureRoot);

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /owner/);
  assert.match(result.stderr, /reviewBy/);
});
