import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("app treats localhost and loopback IPs as the same local dev runtime", () => {
  const appSource = readSource("src/App.tsx");

  assert.match(
    appSource,
    /const isDevMode = window\.location\.hostname === 'localhost'\s*\|\|\s*window\.location\.hostname === '127\.0\.0\.1'\s*\|\|\s*window\.location\.hostname === '::1';/,
  );
});

test("local dev launch keeps localhost as the browser-facing origin while loopback IP stays supported internally", () => {
  const devLaunchSource = readSource("scripts/dev/dev-launch.ps1");
  const startScriptSource = readSource("start.bat");

  assert.match(devLaunchSource, /\$viteUrl = 'http:\/\/127\.0\.0\.1:3000\/'/);
  assert.match(devLaunchSource, /Start-Process 'http:\/\/localhost:3000'/);
  assert.match(devLaunchSource, /Write-Host "KK Studio dev server is ready at http:\/\/localhost:3000"/);
  assert.match(startScriptSource, /URL: http:\/\/localhost:3000/);
});
