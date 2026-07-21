import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

interface PackageManifest {
  scripts?: Record<string, string>;
  workspaces?: string[];
}

function readPackageManifest(relativePath: string): PackageManifest {
  const manifestPath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageManifest;
}

test('verify:changes installs and validates the local runner workspace', () => {
  const rootManifest = readPackageManifest('package.json');
  const localRunnerManifest = readPackageManifest(path.join('local-runner', 'package.json'));

  assert.ok(rootManifest.workspaces?.includes('local-runner'));
  assert.match(rootManifest.scripts?.['local-runner:typecheck'] ?? '', /npm run typecheck -w local-runner/);
  assert.match(rootManifest.scripts?.['local-runner:build'] ?? '', /npm run build -w local-runner/);
  assert.match(rootManifest.scripts?.['verify:changes'] ?? '', /local-runner:typecheck/);
  assert.match(rootManifest.scripts?.['verify:changes'] ?? '', /local-runner:build/);
  assert.equal(localRunnerManifest.scripts?.typecheck, 'tsc --noEmit');
});
