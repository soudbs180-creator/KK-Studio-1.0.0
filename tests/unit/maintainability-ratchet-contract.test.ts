import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();
const CHECK_SCRIPT = path.join(ROOT_DIR, 'scripts/governance/architecture/check-maintainability-ratchet.mjs');

function runCheck(configPath: string, previousConfigPath?: string) {
  const args = [CHECK_SCRIPT, '--config', configPath];
  if (previousConfigPath) args.push('--previous-config', previousConfigPath);
  return spawnSync(process.execPath, args, { cwd: ROOT_DIR, encoding: 'utf8' });
}

test('architecture check uses the hotspot maintainability ratchet', () => {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const architectureCheck = packageJson.scripts['architecture:check'];

  assert.match(architectureCheck, /check-maintainability-ratchet\.mjs/);
  assert.doesNotMatch(architectureCheck, /check-workspace-page-growth\.mjs/);
});

test('ratchet rejects hotspot growth and strict module violations', (t) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'kk-maintainability-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  const hotspotPath = path.join(tempDir, 'hotspot.ts');
  const strictPath = path.join(tempDir, 'strict.ts');
  const configPath = path.join(tempDir, 'config.json');

  writeFileSync(hotspotPath, 'const value: any = 1;\nconsole.log(value);\n', 'utf8');
  writeFileSync(strictPath, `function tooLong() {\n${'  void 0;\n'.repeat(51)}}\n`, 'utf8');
  writeFileSync(configPath, JSON.stringify({
    version: 1,
    hotspots: [{ path: hotspotPath, maxLines: 2, maxExplicitAny: 0, maxConsoleLog: 0 }],
    strictPaths: [strictPath],
  }), 'utf8');

  const result = runCheck(configPath);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /explicit any.*1.*limit 0/i);
  assert.match(`${result.stdout}\n${result.stderr}`, /console\.log.*1.*limit 0/i);
  assert.match(`${result.stdout}\n${result.stderr}`, /function tooLong.*50 lines/i);
});

test('ratchet baselines may stay equal or decrease, but never increase', (t) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'kk-ratchet-baseline-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  const sourcePath = path.join(tempDir, 'source.ts');
  const previousPath = path.join(tempDir, 'previous.json');
  const currentPath = path.join(tempDir, 'current.json');
  writeFileSync(sourcePath, 'export const value = 1;\n', 'utf8');

  const hotspot = { path: sourcePath, maxLines: 2, maxExplicitAny: 0, maxConsoleLog: 0 };
  writeFileSync(previousPath, JSON.stringify({ version: 1, hotspots: [hotspot], strictPaths: [] }), 'utf8');
  writeFileSync(currentPath, JSON.stringify({
    version: 1,
    hotspots: [{ ...hotspot, maxLines: 3 }],
    strictPaths: [],
  }), 'utf8');

  const result = runCheck(currentPath, previousPath);
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /baseline maxLines cannot increase from 2 to 3/i);
});
