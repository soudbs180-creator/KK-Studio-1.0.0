import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("windows start entrypoints always launch the latest dev host from the repo root", () => {
  const startBat = readSource("start.bat");
  const launcherBat = readSource("scripts/启动 KK Studio.bat");
  const packageJson = JSON.parse(readSource("package.json")) as {
    scripts?: Record<string, string>;
  };

  assert.match(startBat, /cd \/d "%~dp0"/);
  assert.match(startBat, /call npm run clean/);
  assert.match(
    startBat,
    /powershell -NoProfile -ExecutionPolicy Bypass -File scripts\/dev\/dev-launch\.ps1 -Restart -SkipVite/,
  );
  assert.match(
    startBat,
    /powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http:\/\/localhost:3000'"/,
  );
  assert.match(
    startBat,
    /powershell -NoProfile -ExecutionPolicy Bypass -File scripts\/dev\/run-vite-dev\.ps1/,
  );
  assert.doesNotMatch(startBat, /start "KK Studio Dev Host"/);
  assert.match(startBat, /Keep this window open while using http:\/\/localhost:3000/);
  assert.equal(packageJson.scripts?.dev, "vite --configLoader native");
  assert.equal(
    packageJson.scripts?.build,
    "vite build --configLoader native",
  );
  assert.equal(
    packageJson.scripts?.preview,
    "vite preview --configLoader native",
  );
  assert.equal(
    packageJson.scripts?.["admin:dev"],
    "vite --configLoader native --config apps/admin/vite.config.ts",
  );
  assert.equal(
    packageJson.scripts?.["admin:build"],
    "vite build --configLoader native --config apps/admin/vite.config.ts",
  );
  assert.equal(
    packageJson.scripts?.["admin:preview"],
    "vite preview --configLoader native --config apps/admin/vite.config.ts",
  );
  assert.equal(
    packageJson.scripts?.["dev:start"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/dev-launch.ps1 -Restart",
  );
  assert.equal(
    packageJson.scripts?.["dev:stop"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/dev-stop.ps1",
  );
  assert.equal(
    packageJson.scripts?.["dev:status"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/dev-status.ps1",
  );
  assert.equal(
    packageJson.scripts?.["dev:restart"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/restart-dev.ps1",
  );
  assert.match(launcherBat, /call "%~dp0\\\.\.\\start\.bat"/);
});
