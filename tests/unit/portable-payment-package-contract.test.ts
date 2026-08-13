import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



function readJson<T>(relativePath: string): T {
  return JSON.parse(readSource(relativePath)) as T;
}

test('portable release packages the current server runtime closure', () => {
  const releaseSource = readSource('scripts/release/create-portable-release.mjs');

  assert.equal(releaseSource.includes("'runtime_payment_bridge.js'"), false);
  assert.equal(releaseSource.includes("'settlement_bridge.js'"), false);

  assert.match(releaseSource, /source: path\.join\(rootDir, 'services', 'api'\)/);
  assert.match(releaseSource, /'packages', 'api-client', 'src'/);
  assert.match(releaseSource, /'packages', 'shared', 'src'/);

  assert.match(releaseSource, /function buildAppPackageJson\(\)[\s\S]*type: 'module'/);
  assert.match(releaseSource, /writeFile\(path\.join\(appDir, 'package\.json'\), buildAppPackageJson\(\)/);
});

test('portable release exposes server dependencies to the current server and copied app sources', () => {
  const releaseSource = readSource('scripts/release/create-portable-release.mjs');
  const serverPackage = readJson<{
    dependencies?: Record<string, string>;
  }>('services/api/package.json');
  const serverLock = readJson<{
    packages?: Record<string, { dependencies?: Record<string, string>; version?: string }>;
  }>('services/api/package-lock.json');

  assert.match(releaseSource, /const appNodeModules = path\.join\(appDir, 'node_modules'\)/);
  assert.match(releaseSource, /shell: false/);
  assert.match(releaseSource, /runCommand\('cmd\.exe', \['\/d', '\/s', '\/c', `npm\.cmd \$\{npmArgs\.join\(' '\)\}`]/);
  assert.match(releaseSource, /'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'/);
  assert.doesNotMatch(releaseSource, /serverSourceDir, 'node_modules'/);
  assert.match(releaseSource, /copyDirectory\(serverTargetNodeModules, appNodeModules\)/);

  assert.ok(serverPackage.dependencies?.pg, 'server package.json must include pg');
  assert.ok(serverLock.packages?.['']?.dependencies?.pg, 'server lock root must include pg');
  assert.ok(serverLock.packages?.['node_modules/pg']?.version, 'server lock must pin pg');
});

test('portable release packaging fails unless the built frontend has a remote KK API base URL', () => {
  const releaseSource = readSource('scripts/release/create-portable-release.mjs');

  assert.match(releaseSource, /function assertPortableRemoteKkApiBaseUrl/);
  assert.match(releaseSource, /VITE_KK_API_BASE_URL/);
  assert.match(releaseSource, /isLocalOrPrivateKkApiBaseUrl/);
  assert.match(releaseSource, /\(\[`"'\]\)\(\.\*\?\)\\1/);
  assert.match(releaseSource, /match\?\.\[2\]/);
  assert.match(releaseSource, /await assertPortableRemoteKkApiBaseUrl\(distSourceDir\)/);
  assert.match(releaseSource, /does not package the core KK API/);
});

test('portable stable release notes describe the hosted same-origin API workaround instead of blocking on api DNS', () => {
  const releaseManifest = readJson<{
    releaseNotes?: string[];
  }>('config/release-manifest.json');

  assert.ok(
    releaseManifest.releaseNotes?.some((note) => note.includes('react-router') || note.includes('brace-expansion')),
    'release notes should identify the latest security updates',
  );
  assert.equal(
    releaseManifest.releaseNotes?.some((note) => note.includes('remaining DNS/TLS smoke gate')),
    false,
    'release notes should not keep the already-mitigated DNS blocker as the active release state',
  );
});

test('portable publish manifest carries build commit metadata from the packaged app manifest', () => {
  const publishSource = readSource('scripts/release/publish-portable-release.mjs');

  assert.match(publishSource, /commitSha: portableAppManifest\.commitSha \?\? null,/);
  assert.match(publishSource, /commitShortSha: portableAppManifest\.commitShortSha \?\? null,/);
  assert.match(publishSource, /buildTime: portableAppManifest\.buildTime \?\? null,/);
});

test('portable packaging preserves explicit candidate provenance without enabling an unavailable feed', () => {
  const releaseSource = readSource('scripts/release/create-portable-release.mjs');

  assert.match(releaseSource, /parseReleaseManifest/);
  assert.match(releaseSource, /function assertPortableBuildProvenance/);
  assert.match(releaseSource, /provenance\?\.kind !== 'kk-studio-web-build'/);
  assert.match(releaseSource, /enabled: releaseManifest\.releasePhase === 'stable'/);
  assert.match(releaseSource, /channel: releaseManifest\.releasePhase/);
  assert.match(releaseSource, /portable\/\$\{releaseManifest\.releasePhase\}\/manifest\.json/);
});
