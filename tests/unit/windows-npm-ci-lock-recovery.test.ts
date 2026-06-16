import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Windows npm clean-install recovery is explicit and stays out of verify:changes', () => {
  const packageJson = JSON.parse(readSource('package.json')) as {
    scripts: Record<string, string>;
  };
  const diagnoseSource = readSource('scripts/dev/diagnose-install-locks.ps1');

  assert.equal(
    packageJson.scripts['install:diagnose-locks'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/diagnose-install-locks.ps1',
  );
  assert.equal(
    packageJson.scripts['install:recover'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/diagnose-install-locks.ps1 -StopProjectDevProcesses -CleanStaleNativeAddonDirs',
  );
  assert.doesNotMatch(packageJson.scripts['verify:changes'], /install:(?:diagnose-locks|recover)|npm ci/);

  assert.match(diagnoseSource, /Split-Path -Parent \(Split-Path -Parent \$PSScriptRoot\)/);
  assert.match(diagnoseSource, /RmStartSession/);
  assert.match(diagnoseSource, /RmRegisterResources/);
  assert.match(diagnoseSource, /RmGetList/);
  assert.match(diagnoseSource, /Get-NativeAddonFiles/);
  assert.match(diagnoseSource, /lightningcss/);
  assert.match(diagnoseSource, /tailwindcss/);
  assert.match(diagnoseSource, /rollup/);
  assert.match(diagnoseSource, /function Get-ProjectDevOrTestProcesses/);
  assert.match(diagnoseSource, /node --test/);
  assert.match(diagnoseSource, /npm(?:\.cmd)? run (?:dev|test|verify|typecheck|build)/);
  assert.match(diagnoseSource, /\[switch\]\$StopProjectDevProcesses/);
  assert.match(diagnoseSource, /\[switch\]\$CleanStaleNativeAddonDirs/);
  assert.match(diagnoseSource, /scripts\\dev\\dev-stop\.ps1/);
  assert.match(diagnoseSource, /Remove-Item -LiteralPath \$directory\.FullName -Recurse -Force/);
});
