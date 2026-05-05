import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readSource(relativePath)) as T;
}

test('portable release packages the payment sidecar compatibility runtime closure', () => {
  const releaseSource = readSource('scripts/release/create-portable-release.mjs');

  assert.match(releaseSource, /'sidecar_compat_bridge\.js'/);
  assert.equal(releaseSource.includes("'runtime_payment_bridge.js'"), false);
  assert.equal(releaseSource.includes("'settlement_bridge.js'"), false);

  assert.match(releaseSource, /'apps', 'payment-sidecar', 'src'/);
  assert.match(releaseSource, /'apps', 'api', 'src', 'lib', 'request-authenticator\.ts'/);
  assert.match(
    releaseSource,
    /'apps', 'api', 'src', 'modules', 'auth', 'infrastructure', 'kk-session-token\.ts'/,
  );
  assert.match(releaseSource, /'packages', 'contracts', 'src'/);
  assert.match(releaseSource, /'packages', 'shared', 'src'/);

  assert.match(releaseSource, /function buildAppPackageJson\(\)[\s\S]*type: 'module'/);
  assert.match(releaseSource, /writeFile\(path\.join\(appDir, 'package\.json'\), buildAppPackageJson\(\)/);
});

test('portable release exposes payment dependencies to both legacy server and copied app sources', () => {
  const releaseSource = readSource('scripts/release/create-portable-release.mjs');
  const paymentPackage = readJson<{
    dependencies?: Record<string, string>;
  }>('payment-server/package.json');
  const paymentLock = readJson<{
    packages?: Record<string, { dependencies?: Record<string, string>; version?: string }>;
  }>('payment-server/package-lock.json');

  assert.match(releaseSource, /const appNodeModules = path\.join\(appDir, 'node_modules'\)/);
  assert.match(releaseSource, /shell: false/);
  assert.match(releaseSource, /runCommand\('cmd\.exe', \['\/d', '\/s', '\/c', `npm\.cmd \$\{npmArgs\.join\(' '\)\}`]/);
  assert.match(releaseSource, /'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'/);
  assert.doesNotMatch(releaseSource, /paymentSourceDir, 'node_modules'/);
  assert.match(releaseSource, /copyDirectory\(paymentTargetNodeModules, appNodeModules\)/);

  assert.ok(paymentPackage.dependencies?.pg, 'payment-server package.json must include pg');
  assert.ok(paymentLock.packages?.['']?.dependencies?.pg, 'payment-server lock root must include pg');
  assert.ok(paymentLock.packages?.['node_modules/pg']?.version, 'payment-server lock must pin pg');
});

test('portable release packaging fails unless the built frontend has a remote KK API base URL', () => {
  const releaseSource = readSource('scripts/release/create-portable-release.mjs');

  assert.match(releaseSource, /function assertPortableRemoteKkApiBaseUrl/);
  assert.match(releaseSource, /VITE_KK_API_BASE_URL/);
  assert.match(releaseSource, /isLocalOrPrivateKkApiBaseUrl/);
  assert.match(releaseSource, /await assertPortableRemoteKkApiBaseUrl\(distSourceDir\)/);
  assert.match(releaseSource, /does not package the core KK API/);
});
