import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("dev powershell scripts resolve the repository root from scripts/dev", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");
  const devStatusSource = readSource("scripts/dev/dev-status.ps1");
  const devStopSource = readSource("scripts/dev/dev-stop.ps1");
  const devRestartSource = readSource("scripts/dev/restart-dev.ps1");
  const runViteDevSource = readSource("scripts/dev/run-vite-dev.ps1");
  const runApiDevSource = readSource("scripts/dev/run-api-dev.mjs");
  const runApiLocalSource = readSource("scripts/dev/run-api-local.mjs");
  const runApiRunnerSource = readSource("scripts/dev/run-api-runner.ps1");
  const diagnoseApiEnvSource = readSource("scripts/dev/diagnose-api-env.mjs");
  const statusBatSource = readSource("scripts/查看 KK Studio 状态.bat");
  const stopBatSource = readSource("scripts/停止 KK Studio.bat");

  for (const source of [devLaunchSource, devStatusSource, devStopSource, devRestartSource]) {
    assert.match(
      source,
      /\$projectRoot = Split-Path -Parent \(Split-Path -Parent \$PSScriptRoot\)/,
    );
  }

  assert.match(devRestartSource, /Join-Path \$projectRoot 'scripts\/dev\/dev-launch\.ps1'/);
  assert.match(devLaunchSource, /Join-Path \$projectRoot 'scripts\\dev\\run-api-dev\.mjs'/);
  assert.match(devLaunchSource, /Join-Path \$projectRoot 'scripts\\dev\\run-api-local\.mjs'/);
  assert.match(devLaunchSource, /Join-Path \$projectRoot 'scripts\\dev\\run-api-runner\.ps1'/);
  assert.match(devLaunchSource, /Join-Path \$projectRoot 'scripts\\dev\\run-vite-dev\.ps1'/);
  assert.match(runViteDevSource, /\$projectRoot = Split-Path -Parent \(Split-Path -Parent \$PSScriptRoot\)/);
  assert.match(runApiDevSource, /from "\.\.\/lib\/local-api-bootstrap\.mjs"/);
  assert.match(runApiLocalSource, /from "\.\.\/lib\/local-api-bootstrap\.mjs"/);
  assert.match(runApiRunnerSource, /\$projectRoot = Split-Path -Parent \(Split-Path -Parent \$PSScriptRoot\)/);
  assert.match(runApiRunnerSource, /^\s*param\(/);
  assert.match(runApiRunnerSource, /param\([\s\S]*?\)\s*\r?\n\r?\n\$ErrorActionPreference = 'Stop'/);
  assert.match(runApiRunnerSource, /\[string\]\$ApiScript/);
  assert.match(diagnoseApiEnvSource, /from "\.\.\/lib\/env-contract\.mjs"/);
  assert.match(diagnoseApiEnvSource, /path\.resolve\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\), "\.\.", "\.\."\)/);
  assert.match(statusBatSource, /scripts\/dev\/dev-status\.ps1/);
  assert.match(stopBatSource, /scripts\/dev\/dev-stop\.ps1/);
  assert.match(statusBatSource, /powershell -NoProfile -ExecutionPolicy Bypass/);
  assert.match(stopBatSource, /powershell -NoProfile -ExecutionPolicy Bypass/);
});

test("dev launch keeps frontend startup alive when local API preflight is unavailable", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");

  assert.match(devLaunchSource, /Write-Warning/);
  assert.match(devLaunchSource, /\$apiPreflight = Start-Process/);
  assert.match(devLaunchSource, /-Wait/);
  assert.doesNotMatch(devLaunchSource, /& \$nodeExe \$apiScript --check/);
  assert.match(devLaunchSource, /\$apiScript = \$apiDevScript/);
  assert.match(devLaunchSource, /\$apiScript = \$apiLocalScript/);
  assert.match(devLaunchSource, /Starting Vite with the local-only API fallback/);
  assert.doesNotMatch(devLaunchSource, /API PID: disabled \(missing local API config\)/);
  assert.doesNotMatch(devLaunchSource, /throw "Local API config preflight failed/);
});

test("dev launch reuses an already-healthy local API listener before treating port 3001 as a conflict", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");

  assert.match(devLaunchSource, /function Test-KkApiHealth/);
  assert.match(devLaunchSource, /kk-studio-api/);
  assert.match(devLaunchSource, /\$apiReusedExistingListener = \$false/);
  assert.match(devLaunchSource, /if \(-not \$apiPid -and \(Test-KkApiHealth -Url \$apiUrl\)\) \{/);
  assert.match(devLaunchSource, /Reusing the local API listener that is already healthy on port 3001/);
  assert.match(devLaunchSource, /\$apiPid = Sync-PidFileToPortOwner -PidFile \$apiPidFile -Port 3001 -FallbackProcessId \$existingApiPid/);
  assert.match(devLaunchSource, /if \(-not \$apiReusedExistingListener -and -not \(Wait-UrlReadyOrExit -Url \$apiUrl -ProcessId \$apiPid/);
});

test("dev launch normalizes duplicate PATH environment keys before spawning child processes", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");

  assert.match(devLaunchSource, /Remove-Item Env:PATH -ErrorAction SilentlyContinue/);
  assert.match(devLaunchSource, /\$env:PATH = \$originalPathUpper/);
  assert.match(devLaunchSource, /\$env:Path = \$originalPathMixed/);
});

test("dev launch starts Vite through the detached Node runner", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");
  const runViteDevSource = readSource("scripts/dev/run-vite-dev.ps1");
  const runApiRunnerSource = readSource("scripts/dev/run-api-runner.ps1");

  assert.match(devLaunchSource, /function Start-DetachedPowerShellScript/);
  assert.match(devLaunchSource, /function Start-DetachedNodeProcess/);
  assert.match(devLaunchSource, /\$vitePid = Start-DetachedNodeProcess/);
  assert.match(devLaunchSource, /-NodeArguments @\(\$viteCli, '--configLoader', 'native'\)/);
  assert.doesNotMatch(devLaunchSource, /\$vitePid = Start-DetachedPowerShellScript/);
  assert.match(devLaunchSource, /function Start-ApiProcess/);
  assert.match(devLaunchSource, /\$apiPid = Start-ApiProcess -ApiScript \$apiScript -UseWatch \$true/);
  assert.doesNotMatch(devLaunchSource, /Wait-Process -Id \$vitePid/);
  assert.match(runViteDevSource, /node_modules\\vite\\bin\\vite\.js/);
  assert.match(runViteDevSource, /& \$nodeExe \$viteCli --configLoader native/);
  assert.match(runApiRunnerSource, /if \(\$UseWatch\)/);
  assert.match(runApiRunnerSource, /& \$nodeExe --watch \$ApiScript/);
  assert.match(runApiRunnerSource, /& \$nodeExe \$ApiScript/);
});

test("dev launch does not fail startup when opening the browser is unavailable", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");

  assert.match(devLaunchSource, /if \(\$OpenBrowser\) \{/);
  assert.match(devLaunchSource, /try \{/);
  assert.match(devLaunchSource, /Start-Process 'http:\/\/localhost:3000' \| Out-Null/);
  assert.match(devLaunchSource, /catch \{/);
  assert.match(devLaunchSource, /Write-Warning "Failed to open the browser automatically/);
});

test("dev launch falls back to plain node when watch mode cannot start on this machine", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");

  assert.match(devLaunchSource, /function Start-ApiProcess/);
  assert.match(devLaunchSource, /if \(\$UseWatch\) \{/);
  assert.match(devLaunchSource, /\$runnerArguments = @\('-ApiScript', \$ApiScript\)/);
  assert.match(devLaunchSource, /\$runnerArguments \+= '-UseWatch'/);
  assert.match(devLaunchSource, /return Start-DetachedPowerShellScript/);
  assert.doesNotMatch(devLaunchSource, /return Start-DetachedNodeProcess/);
  assert.match(devLaunchSource, /function Test-ApiWatchSpawnError/);
  assert.match(devLaunchSource, /spawn EPERM/);
  assert.match(devLaunchSource, /watch mode is unavailable/);
});
