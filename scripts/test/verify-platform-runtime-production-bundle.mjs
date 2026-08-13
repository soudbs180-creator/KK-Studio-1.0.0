import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'apps', 'web', 'dist');
const ASSETS_ROOT = path.join(DIST_ROOT, 'assets');

function readRequiredFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[platform-runtime-bundle] Missing ${description}: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertContains(source, marker, description) {
  if (!source.includes(marker)) {
    throw new Error(`[platform-runtime-bundle] ${description} is absent from the production bundle.`);
  }
}

const htmlSource = readRequiredFile(path.join(DIST_ROOT, 'index.html'), 'production index');
const entryMatch = htmlSource.match(/src="\/assets\/(index-[^"]+\.js)"/);
if (!entryMatch) {
  throw new Error('[platform-runtime-bundle] Production index does not reference an index JavaScript asset.');
}

const entrySource = readRequiredFile(path.join(ASSETS_ROOT, entryMatch[1]), 'production entry asset');
assertContains(entrySource, 'Unsupported platform release phase', 'browser platform adapter');
assertContains(entrySource, 'desktop_only', 'desktop capability fallback');

const loginMatch = entrySource.match(/LoginScreen-[A-Za-z0-9_-]+\.js/);
if (!loginMatch) {
  throw new Error('[platform-runtime-bundle] Production entry does not retain the reachable LoginScreen chunk.');
}

const loginSource = readRequiredFile(path.join(ASSETS_ROOT, loginMatch[0]), 'LoginScreen asset');
assertContains(loginSource, 'usePlatformRuntime must be used within PlatformRuntimeProvider.', 'platform runtime consumer');
assertContains(loginSource, 'auth-version', 'reachable version surface');
assertContains(loginSource, 'displayVersion', 'runtime-provided version value');

process.stdout.write('[platform-runtime-bundle] production adapter and reachable consumer verified.\n');
