import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, '.tmp-playwright', 'desktop-settings-smoke');
const DEFAULT_TARGET_URL = 'http://127.0.0.1:3000';
const SETTINGS_HOME_PATH = '/settings';
const SETTINGS_API_PATH = '/settings/api-management';

function ensureArtifactsDir() {
  if (!existsSync(ARTIFACT_DIR)) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
}

function readSource(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function isBrowserLaunchUnavailable(error) {
  const message = String(error?.message || error || '');
  return /spawn EPERM/i.test(message)
    || /Playwright npx cache directory not found/i.test(message)
    || /Playwright module was not found/i.test(message);
}

async function resolvePlaywrightModuleUrl() {
  const npxCacheRoot = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  if (!npxCacheRoot || !existsSync(npxCacheRoot)) {
    throw new Error('Playwright npx cache directory not found. Run `cmd /c npx playwright --version` once first.');
  }

  const cacheEntries = await readdir(npxCacheRoot, { withFileTypes: true });
  const candidates = [];

  for (const entry of cacheEntries) {
    if (!entry.isDirectory()) continue;
    const modulePath = path.join(npxCacheRoot, entry.name, 'node_modules', 'playwright', 'index.mjs');
    if (!existsSync(modulePath)) continue;
    const stats = await stat(modulePath);
    candidates.push({ modulePath, mtimeMs: stats.mtimeMs });
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (candidates.length === 0) {
    throw new Error('Playwright module was not found in the npx cache. Run `cmd /c npx playwright --version` once first.');
  }

  return `file:///${candidates[0].modulePath.replace(/\\/g, '/')}`;
}

async function gotoWithRetry(page, url) {
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }

  throw lastError;
}

async function assertVisible(locator, message) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  if (!(await locator.isVisible())) {
    throw new Error(message);
  }
}

async function assertHttpHtml(url) {
  const response = await fetch(url, { redirect: 'manual' });
  if (!response.ok) {
    throw new Error(`Expected ${url} to respond successfully, got ${response.status}.`);
  }

  const html = await response.text();
  if (!/<html/i.test(html)) {
    throw new Error(`Expected ${url} to return HTML content.`);
  }

  return {
    url,
    status: response.status,
    length: html.length,
  };
}

function verifyDesktopSourceContracts() {
  const appSource = readSource('src/App.tsx');
  const appDesktopChromeSource = readSource('src/app/AppDesktopChrome.tsx');
  const settingsPanelSource = readSource('src/components/settings/SettingsPanel.localized.tsx');
  const apiSettingsViewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const workbenchSectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const dashboardSource = readSource('src/components/settings/views/DashboardView.localized.tsx');

  const checks = [
    /data-testid="desktop-user-menu-trigger"/,
    /desktop-user-menu-settings/,
    /data-testid="settings-page-root"/,
    /sections=\{sections\}/,
    /settings-dashboard-cockpit__node/,
    /API setup/,
    /data-testid="api-official-editor-back"/,
    /testId="settings-workbench-stage"/,
    /testId="settings-workbench-diagnostics"/,
    /testId="settings-workbench-platform"/,
    /Traffic overview/,
    /Operational health/,
    /Quick routes/,
  ];

  const sources = [
    appSource,
    appDesktopChromeSource,
    settingsPanelSource,
    apiSettingsViewSource,
    workbenchSectionsSource,
    dashboardSource,
  ];

  for (const pattern of checks) {
    if (!sources.some((source) => pattern.test(source))) {
      throw new Error(`Desktop settings source contract missing pattern: ${pattern}`);
    }
  }
}

async function runFallbackVerification(error, browserPreflight, targetUrl) {
  verifyDesktopSourceContracts();

  const routes = await Promise.all([
    assertHttpHtml(`${targetUrl}${SETTINGS_HOME_PATH}`),
    assertHttpHtml(`${targetUrl}${SETTINGS_API_PATH}`),
    assertHttpHtml(targetUrl),
  ]);

  const summary = {
    mode: 'fallback',
    reason: String(error?.message || error),
    browserPreflight,
    routes,
    artifactDir: ARTIFACT_DIR,
  };

  writeFileSync(
    path.join(ARTIFACT_DIR, 'desktop-settings-fallback.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

ensureArtifactsDir();

let browser;
let viteServer;
let browserPreflight = null;
let targetUrl = DEFAULT_TARGET_URL;

try {
  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: DEFAULT_TARGET_URL });
  viteServer = ensured.server;
  targetUrl = ensured.url || DEFAULT_TARGET_URL;
  browserPreflight = await runBrowserPreflight();

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('kk_theme', 'dark');
    window.localStorage.setItem('kk_language', 'en-US');
    window.localStorage.setItem('kk_studio_storage_mode', 'browser');
    window.localStorage.setItem('kk_tutorial_seen', 'true');
  });

  await gotoWithRetry(page, `${targetUrl}${SETTINGS_HOME_PATH}`);

  const settingsPageRoot = page.getByTestId('settings-page-root');

  await assertVisible(settingsPageRoot, 'Direct settings page root did not render.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings-direct-home.png'),
    fullPage: true,
  });

  await gotoWithRetry(page, `${targetUrl}${SETTINGS_API_PATH}`);

  const workbenchStage = page.getByTestId('settings-workbench-stage');
  const diagnosticsToggle = page.getByTestId('api-workbench-diagnostics-toggle');
  const diagnosticsPanel = page.getByTestId('settings-workbench-diagnostics');
  const officialEditorBack = page.getByTestId('api-official-editor-back');

  await assertVisible(workbenchStage, 'API Management stage section did not render.');
  await assertVisible(diagnosticsToggle, 'Diagnostics toggle did not render.');
  await diagnosticsToggle.click();
  await assertVisible(diagnosticsPanel, 'Diagnostics section did not open.');
  await diagnosticsToggle.click();
  await diagnosticsPanel.waitFor({ state: 'hidden', timeout: 15000 });
  const emptyCreateButton = page.getByTestId('api-official-empty-create');
  if (await emptyCreateButton.isVisible().catch(() => false)) {
    await emptyCreateButton.click();
  } else {
    await page.getByTestId('api-workbench-primary-action').click();
  }
  await assertVisible(officialEditorBack, 'Local API editor did not open.');
  await officialEditorBack.click();
  await assertVisible(workbenchStage, 'API Management did not return from the local API editor.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings-direct-api-management.png'),
    fullPage: true,
  });

  await gotoWithRetry(page, targetUrl);

  const desktopUserMenuTrigger = page.getByTestId('desktop-user-menu-trigger');
  await assertVisible(desktopUserMenuTrigger, 'Desktop user menu trigger did not render on the workspace.');
  await desktopUserMenuTrigger.click();
  await page.getByTestId('desktop-user-menu-settings').click();

  const overlayShell = page.locator('.settings-shell-backdrop');
  await assertVisible(overlayShell, 'Workspace settings overlay did not open.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings-overlay-from-workspace.png'),
    fullPage: true,
  });

  console.log(JSON.stringify({
    mode: 'browser',
    browserPreflight,
    artifactDir: ARTIFACT_DIR,
  }, null, 2));
} catch (error) {
  if (isBrowserLaunchUnavailable(error)) {
    await runFallbackVerification(error, browserPreflight, targetUrl);
  } else {
    throw error;
  }
} finally {
  if (browser) {
    await browser.close();
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
}
