import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('dev scripts iterate candidate port owners instead of passing PID arrays into int parameters', () => {
  const devStatusSource = readSource('scripts/dev-status.ps1');
  const devStopSource = readSource('scripts/dev-stop.ps1');
  const devLaunchSource = readSource('scripts/dev-launch.ps1');

  for (const source of [devStatusSource, devStopSource, devLaunchSource]) {
    assert.match(source, /\$ownerPids = @\(Get-NetTCPConnection -State Listen -LocalPort \$Port/);
    assert.match(source, /foreach \(\$ownerPid in \$ownerPids\)/);
    assert.match(source, /\[int\]::TryParse\(\[string\]\$ownerPid, \[ref\]\$resolvedOwnerPid\)/);
  }

  assert.match(devStatusSource, /return \$null\s*}\s*function Test-UrlReady/s);
  assert.match(devStopSource, /return \$null\s*}\s*foreach \(\$service in \$services\)/s);
});
