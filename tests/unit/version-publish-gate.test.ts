import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();
const CHECK_SCRIPT = path.join(ROOT_DIR, 'scripts', 'governance', 'check-version-consistency.mjs');

function releaseManifest() {
  return {
    appName: 'KK Studio',
    schemaVersion: 1,
    version: '1.7.0',
    releasedVersion: '1.7.0',
    displayVersion: 'v1.7.0',
    releaseTarget: '1.7.0',
    releasePhase: 'stable',
    releaseSequence: 10,
    artifactVersion: '1.7.0',
    releaseDate: '2026-08-13',
    releaseNotes: ['fixture'],
    versionTargets: {
      releaseManifest: 'config/release-manifest.json',
      rootPackage: 'package.json',
      serverPackage: 'services/api/package.json',
      stablePortableManifest: 'release/publish/stable/manifest.json',
    },
  };
}

test('source-only validation allows first stable publication before the stable output exists', async (context) => {
  const fixtureDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kk-version-gate-'));
  context.after(async () => fs.promises.rm(fixtureDir, { recursive: true, force: true }));
  await fs.promises.mkdir(path.join(fixtureDir, 'config'), { recursive: true });
  await fs.promises.mkdir(path.join(fixtureDir, 'services', 'api'), { recursive: true });
  await fs.promises.writeFile(
    path.join(fixtureDir, 'config', 'release-manifest.json'),
    JSON.stringify(releaseManifest()),
  );
  await fs.promises.writeFile(path.join(fixtureDir, 'package.json'), JSON.stringify({ version: '1.7.0' }));
  await fs.promises.writeFile(
    path.join(fixtureDir, 'services', 'api', 'package.json'),
    JSON.stringify({ version: '1.7.0' }),
  );

  const sourceResult = spawnSync(process.execPath, [CHECK_SCRIPT, '--scope', 'source'], {
    cwd: fixtureDir,
    encoding: 'utf8',
  });
  assert.equal(sourceResult.status, 0, `${sourceResult.stdout}\n${sourceResult.stderr}`);

  const fullResult = spawnSync(process.execPath, [CHECK_SCRIPT, '--scope', 'full'], {
    cwd: fixtureDir,
    encoding: 'utf8',
  });
  assert.notEqual(fullResult.status, 0);
  assert.match(`${fullResult.stdout}\n${fullResult.stderr}`, /stable.*manifest|stablePortableManifest/i);
});
