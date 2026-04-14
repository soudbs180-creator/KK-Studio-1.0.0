import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, '.tmp-playwright', 'desktop-settings-smoke');
const TARGET_URL = 'http://127.0.0.1:3000';
const SETTINGS_HOME_PATH = '/settings';
const SETTINGS_API_PATH = '/settings/api-management';

function ensureArtifactsDir() {
  if (!existsSync(ARTIFACT_DIR)) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
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

const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
const { chromium } = await import(playwrightModuleUrl);

ensureArtifactsDir();

const browser = await chromium.launch({ headless: true });
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

try {
  await gotoWithRetry(page, `${TARGET_URL}${SETTINGS_HOME_PATH}`);

  const settingsPageRoot = page.getByTestId('settings-page-root');

  await assertVisible(settingsPageRoot, 'Direct settings page root did not render.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings-direct-home.png'),
    fullPage: true,
  });

  await gotoWithRetry(page, `${TARGET_URL}${SETTINGS_API_PATH}`);

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

  await gotoWithRetry(page, TARGET_URL);

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
} finally {
  await browser.close();
}
