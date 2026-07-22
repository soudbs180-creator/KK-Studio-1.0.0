import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("package.json exposes a prompt-group browser verification script", () => {
  const pkg = JSON.parse(readSource("package.json")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(pkg.scripts?.["verify:prompt-group-drag"], "node scripts/test/verify-prompt-group-drag.mjs");
});

test("verify:changes pulls prompt-group browser verification into the main verification chain", () => {
  const pkg = JSON.parse(readSource("package.json")) as {
    scripts?: Record<string, string>;
  };

  const verifyChanges = pkg.scripts?.["verify:changes"] || "";
  const testScript = pkg.scripts?.test || "";

  assert.match(verifyChanges, /npm run test && npm run verify:prompt-group-drag/);
  assert.equal((verifyChanges.match(/verify:prompt-group-drag/g) || []).length, 1);
  assert.doesNotMatch(testScript, /verify:prompt-group-drag/);
});

test("prompt-group browser verification script checks both regrouping and connector following", () => {
  const source = readSource("scripts/test/verify-prompt-group-drag.mjs");

  assert.match(source, /mainDragGrouped/);
  assert.match(source, /childConnectorFollows/);
  assert.match(source, /const promptDockTolerance = 60;/);
  assert.match(source, /box\.top >= promptBottomDuringMainDrag - promptDockTolerance/);
  assert.match(source, /getScreenCTM\?\.\(\)/);
  assert.match(source, /new DOMPoint\(Number\(match\[1\]\), Number\(match\[2\]\)\)/);
  assert.match(source, /throw new Error\(`Main-card drag did not regroup child cards under the parent:/);
  assert.match(source, /throw new Error\(`Child-card connector did not stay aligned with the dragged image:/);
});

test("large-canvas browser verification derives drag and connector points from rendered screen geometry", () => {
  const source = readSource("scripts/test/verify-large-canvas-10k-smoke.mjs");

  assert.match(source, /resolvePromptDragStartScreen\(page, 'prompt-main'\)/);
  assert.match(source, /surface\?\.getBoundingClientRect\(\)/);
  assert.match(source, /document\.elementFromPoint\(x, candidateY\)/);
  assert.match(source, /connector-prompt-main-\$\{imageId\}/);
  assert.match(source, /getAttribute\('data-x'\)/);
  assert.match(source, /getAttribute\('data-y'\)/);
  assert.match(source, /promptRuntimePosition/);
  assert.match(source, /imageBox\.centerX/);
  assert.match(source, /imageBox\.top/);
  assert.match(source, /ownerSvg\?\.getScreenCTM\?\.\(\)/);
  assert.doesNotMatch(source, /resolveSeedCanvasPointToScreen/);
});

test("prompt-group browser verification script uses browser preflight and fallback verification when browser spawn is unavailable", () => {
  const source = readSource("scripts/test/verify-prompt-group-drag.mjs");
  const viteHelperSource = readSource("scripts/test/ensure-local-vite-server.mjs");

  assert.match(source, /import \{ runBrowserPreflight \} from '\.\/browser-preflight\.mjs';/);
  assert.match(source, /import \{\s*closeLocalViteServer,\s*ensureLocalViteServer,\s*\} from '\.\/ensure-local-vite-server\.mjs';/);
  assert.match(source, /function isBrowserLaunchUnavailable\(error\)/);
  assert.match(source, /await runFallbackVerification\(error, browserPreflight, targetUrl\);/);
  assert.match(source, /mode: 'fallback'/);
  assert.match(source, /prompt-group-drag-fallback\.json/);
  assert.match(source, /await closeLocalViteServer\(viteServer\);/);
  assert.match(viteHelperSource, /export async function closeLocalViteServer\(server\)/);
  assert.match(viteHelperSource, /server\.waitForRequestsIdle\(\)/);
  assert.match(viteHelperSource, /setTimeout\(resolve, 5000\)/);
});

test("prompt-group browser verification navigates to the Vite helper fallback URL", () => {
  const source = readSource("scripts/test/verify-prompt-group-drag.mjs");

  assert.match(source, /let targetUrl = TARGET_URL;/);
  assert.match(source, /targetUrl = ensured\.url \|\| TARGET_URL;/);
  assert.match(source, /await gotoWithRetry\(page, targetUrl\);/);
  assert.match(source, /assertHttpHtml\(targetUrl\)/);
});

test("local Vite helper reuses only a KK Studio page", () => {
  const source = readSource("scripts/test/ensure-local-vite-server.mjs");

  assert.match(source, /async function isKkStudioReady\(url/);
  assert.match(source, /html\.includes\('<title>KK Studio'/);
  assert.match(source, /if \(await isKkStudioReady\(url\)\)/);
  assert.match(source, /if \(port !== requestedPort && await isKkStudioReady\(candidateOrigin\)\)/);
});

test("prompt-group browser verification script accepts hook-based drag wiring contracts", () => {
  const source = readSource("scripts/test/verify-prompt-group-drag.mjs");

  assert.match(source, /const dragHookSource = readSource\('apps\/web\/src\/app\/usePromptGroupDragHandlers\.ts'\);/);
  assert.match(source, /source:\s*dragHookSource,\s*pattern:\s*\/commitPromptGroupDrag[\s\S]*shouldAutoRegroupPromptGroup/);
});

test("browser preflight detects generic child-process spawn restrictions before probing Playwright browsers", () => {
  const source = readSource("scripts/test/browser-preflight.mjs");

  assert.match(source, /spawn\('cmd\.exe', \['\/c', 'echo', 'spawn-probe'\]/);
  assert.match(source, /reason: 'process-spawn-blocked'/);
  assert.match(source, /reason: 'process-spawn-check-threw'/);
});
