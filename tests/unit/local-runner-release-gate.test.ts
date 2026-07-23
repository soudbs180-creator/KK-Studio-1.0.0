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
  assert.match(rootManifest.scripts?.['local-runner:test'] ?? '', /npm run test -w local-runner/);
  assert.match(rootManifest.scripts?.['verify:changes'] ?? '', /local-runner:typecheck/);
  assert.match(rootManifest.scripts?.['verify:changes'] ?? '', /local-runner:build/);
  assert.match(rootManifest.scripts?.['verify:changes'] ?? '', /local-runner:test/);
  assert.equal(localRunnerManifest.scripts?.typecheck, 'tsc --noEmit');
  assert.match(localRunnerManifest.scripts?.test ?? '', /tsc -p tsconfig\.test\.json/);
});

test('local runner handshake has no shared fallback credential', () => {
  const tokenSource = fs.readFileSync(path.join(process.cwd(), 'local-runner/src/security/localToken.ts'), 'utf8');
  const clientSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/src/features/browser-assistant/opencli/opencliClient.ts'), 'utf8');

  assert.doesNotMatch(tokenSource, /local_handshake_token_default/);
  assert.doesNotMatch(clientSource, /local_handshake_token_default/);
});
