import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('dev scripts iterate candidate port owners instead of passing PID arrays into int parameters', () => {
  const devStatusSource = readSource('scripts/dev/dev-status.ps1');
  const devStopSource = readSource('scripts/dev/dev-stop.ps1');
  const devLaunchSource = readSource('scripts/dev/dev-launch.ps1');

  for (const source of [devStatusSource, devStopSource, devLaunchSource]) {
    assert.match(source, /function Get-ListeningConnectionRecords/);
    assert.match(source, /Get-NetTCPConnection -State Listen -ErrorAction Stop/);
    assert.match(source, /cmd \/c netstat -ano -p tcp/);
    assert.match(source, /\$ownerPids = @\(Get-ListeningConnectionRecords \| Where-Object \{ \$_.LocalPort -eq \$Port \}/);
    assert.match(source, /foreach \(\$ownerPid in \$ownerPids\)/);
    assert.match(source, /\[int\]::TryParse\(\[string\]\$ownerPid, \[ref\]\$resolvedOwnerPid\)/);
    assert.match(source, /if \(\$Port -in \$listeningPorts\) \{\s*return \$true\s*}/s);
  }

  assert.match(devStatusSource, /return \$null\s*}\s*function Test-UrlReady/s);
  assert.match(devStopSource, /return \$null\s*}\s*function Get-KnownDevProcessIds/s);
  assert.match(devStatusSource, /if \(\$resolvedOwnerPids\.Count -eq 1\) \{/);
  assert.match(devStopSource, /if \(\$resolvedOwnerPids\.Count -eq 1\) \{/);
  assert.match(devStatusSource, /\$fallbackProcess -and \$fallbackProcess\.ProcessName -in @\('node', 'npm', 'cmd', 'powershell'\)/);
  assert.match(devStopSource, /\$fallbackProcess -and \$fallbackProcess\.ProcessName -in @\('node', 'npm', 'cmd', 'powershell'\)/);
});

test('dev launch tracks the stable API watch supervisor and stop scripts clean stray watcher processes', () => {
  const devLaunchSource = readSource('scripts/dev/dev-launch.ps1');
  const devStopSource = readSource('scripts/dev/dev-stop.ps1');

  assert.match(devLaunchSource, /function Get-KnownDevProcessIds/);
  assert.match(devStopSource, /function Get-KnownDevProcessIds/);
  assert.match(devLaunchSource, /\$knownProcessIds = @\(Get-KnownDevProcessIds -Port \$Port \| Where-Object/);
  assert.match(devStopSource, /foreach \(\$knownProcessId in @\(Get-KnownDevProcessIds -Port \$service\.Port\)\)/);
  assert.match(devLaunchSource, /Stop-Process -Id \$ProcessId -Force -ErrorAction Stop/);
  assert.match(devStopSource, /Stop-Process -Id \$processId -Force -ErrorAction Stop/);
  assert.match(
    devLaunchSource,
    /\$apiPid = Sync-PidFileToPortOwner -PidFile \$apiPidFile -Port 3001 -FallbackProcessId \$apiPid/,
  );
  assert.match(devLaunchSource, /if \(\$resolvedOwnerPids\.Count -eq 1\) \{/);
  assert.match(devLaunchSource, /return \$resolvedOwnerPids\[0\]/);
  assert.match(devLaunchSource, /return Start-DetachedPowerShellScript/);
  assert.match(devLaunchSource, /function Start-DetachedNodeProcess/);
  assert.match(devLaunchSource, /\$vitePid = Start-DetachedNodeProcess/);
});
