import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { workspacePath } from '../support/workspacePaths.js';

interface MarkerPayload {
  scriptPath: string;
  cwd: string;
  argv?: string[];
  marker?: string;
  remainingArguments?: string[];
}

interface FixtureWorkspace {
  temporaryRoot: string;
  outputRoot: string;
  nodeMarkerPath: string;
  powershellMarkerPath: string;
  copiedHelperPath: string;
  copiedNodeExe: string;
  harnessPath: string;
}

const WINDOWS_ONLY = process.platform !== 'win32';

function readMarker(markerPath: string): MarkerPayload {
  const source = readFileSync(markerPath, 'utf8').replace(/^\uFEFF/u, '');
  return JSON.parse(source) as MarkerPayload;
}

function writeHarness(harnessPath: string): void {
  const source = String.raw`param(
    [string]$HelperPath,
    [string]$NodeExe,
    [string]$NodeMarkerPath,
    [string]$PowerShellMarkerPath,
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
. $HelperPath

$powershellOutput = Join-Path $OutputRoot 'powershell marker.json'
$powershellProcess = Start-KkProcess -FilePath 'powershell.exe' -Arguments @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PowerShellMarkerPath,
    '-OutputPath', $powershellOutput, '-Marker', 'PowerShell 空格',
    '-ExitCode', '0', 'plain', 'two words', '中文参数', 'embedded"quote', 'trailing slash\'
) -WorkingDirectory $OutputRoot -WindowStyle Hidden -PassThru -Wait
if ($powershellProcess.ExitCode -ne 0) {
    throw "PowerShell marker exited with $($powershellProcess.ExitCode)."
}

foreach ($launchKind in @('detached-node', 'vite', 'api-preflight', 'portable')) {
    $nodeOutput = Join-Path $OutputRoot "$launchKind marker.json"
    $nodeProcess = Start-KkProcess -FilePath $NodeExe -Arguments @(
        $NodeMarkerPath, '--output', $nodeOutput, '--label', $launchKind,
        '--value', 'path with spaces', '--unicode', '中文参数',
        '--quoted', 'embedded"quote', '--trailing', 'trailing slash\', '--empty', ''
    ) -WorkingDirectory $OutputRoot -WindowStyle Hidden -PassThru -Wait
    if ($nodeProcess.ExitCode -ne 0) {
        throw "$launchKind marker exited with $($nodeProcess.ExitCode)."
    }
}

$exitOutput = Join-Path $OutputRoot 'exit-code marker.json'
$exitProcess = Start-KkProcess -FilePath $NodeExe -Arguments @(
    $NodeMarkerPath, '--output', $exitOutput, '--exit-code', '7'
) -WorkingDirectory $OutputRoot -WindowStyle Hidden -PassThru -Wait
if ($exitProcess.ExitCode -ne 7) {
    throw "Exit-code marker returned $($exitProcess.ExitCode) instead of 7."
}
`;
  // Windows PowerShell 5.1 needs a BOM to decode non-ASCII script literals as UTF-8.
  writeFileSync(harnessPath, `\uFEFF${source}`, 'utf8');
}

function createFixtureWorkspace(): FixtureWorkspace {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'KK Studio 空格-'));
  const fixtureRoot = path.join(temporaryRoot, 'fixture files 中文');
  const outputRoot = path.join(temporaryRoot, 'marker output 空格');
  const supportRoot = path.join(temporaryRoot, 'portable support 中文');
  const runtimeRoot = path.join(temporaryRoot, 'portable runtime 中文');
  for (const directory of [fixtureRoot, outputRoot, supportRoot, runtimeRoot]) {
    mkdirSync(directory, { recursive: true });
  }

  const nodeMarkerPath = path.join(fixtureRoot, 'node argv marker 空格.mjs');
  const powershellMarkerPath = path.join(fixtureRoot, 'powershell argv marker 空格.ps1');
  const copiedHelperPath = path.join(supportRoot, 'process-launch.ps1');
  const copiedNodeExe = path.join(runtimeRoot, 'node runtime.exe');
  const harnessPath = path.join(fixtureRoot, 'launcher harness 空格.ps1');
  copyFileSync(workspacePath('tests/fixtures/process-launch/argv-marker.mjs'), nodeMarkerPath);
  copyFileSync(workspacePath('tests/fixtures/process-launch/argv-marker.ps1'), powershellMarkerPath);
  copyFileSync(workspacePath('scripts/lib/process-launch.ps1'), copiedHelperPath);
  copyFileSync(process.execPath, copiedNodeExe);
  writeHarness(harnessPath);
  return { temporaryRoot, outputRoot, nodeMarkerPath, powershellMarkerPath, copiedHelperPath, copiedNodeExe, harnessPath };
}

function runHarness(fixture: FixtureWorkspace): void {
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', fixture.harnessPath,
    '-HelperPath', fixture.copiedHelperPath,
    '-NodeExe', fixture.copiedNodeExe,
    '-NodeMarkerPath', fixture.nodeMarkerPath,
    '-PowerShellMarkerPath', fixture.powershellMarkerPath,
    '-OutputRoot', fixture.outputRoot,
  ], {
    cwd: fixture.temporaryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });

  assert.equal(result.status, 0, `launcher harness failed:\n${result.stdout}\n${result.stderr}`);
}

function assertPowerShellMarker(fixture: FixtureWorkspace): void {
  const payload = readMarker(path.join(fixture.outputRoot, 'powershell marker.json'));
  assert.equal(path.normalize(payload.scriptPath), path.normalize(fixture.powershellMarkerPath));
  assert.equal(path.normalize(payload.cwd), path.normalize(fixture.outputRoot));
  assert.equal(payload.marker, 'PowerShell 空格');
  assert.deepEqual(payload.remainingArguments, [
    'plain', 'two words', '中文参数', 'embedded"quote', 'trailing slash\\',
  ]);
}

function assertNodeMarkers(fixture: FixtureWorkspace): void {
  for (const launchKind of ['detached-node', 'vite', 'api-preflight', 'portable']) {
    const outputPath = path.join(fixture.outputRoot, `${launchKind} marker.json`);
    const payload = readMarker(outputPath);
    assert.equal(path.normalize(payload.scriptPath), path.normalize(fixture.nodeMarkerPath));
    assert.equal(path.normalize(payload.cwd), path.normalize(fixture.outputRoot));
    assert.deepEqual(payload.argv, [
      '--output', outputPath, '--label', launchKind,
      '--value', 'path with spaces', '--unicode', '中文参数',
      '--quoted', 'embedded"quote', '--trailing', 'trailing slash\\', '--empty', '',
    ]);
  }
}

function assertExitCodeMarker(fixture: FixtureWorkspace): void {
  const outputPath = path.join(fixture.outputRoot, 'exit-code marker.json');
  const payload = readMarker(outputPath);
  assert.deepEqual(payload.argv, ['--output', outputPath, '--exit-code', '7']);
}

test('shared Windows launcher preserves spaces and Unicode for PowerShell, Node, Vite, API preflight, and Portable shapes', { skip: WINDOWS_ONLY }, () => {
  const fixture = createFixtureWorkspace();

  try {
    runHarness(fixture);
    assertPowerShellMarker(fixture);
    assertNodeMarkers(fixture);
    assertExitCodeMarker(fixture);
  } finally {
    rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }
});
