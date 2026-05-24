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
const SMOKE_PROFILE = {
  id: 'smoke-settings-user',
  email: 'smoke-settings-user@temp.local',
  nickname: 'Smoke Settings User',
  avatarUrl: 'preset-default-local',
  role: 'user',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const SMOKE_AUTH_SESSION = {
  accessToken: 'smoke-settings-access-token',
  refreshToken: 'smoke-settings-refresh-token',
  expiresIn: 3600,
  sessionExpiresAt: '2099-01-01T00:00:00.000Z',
  profile: SMOKE_PROFILE,
};

function ensureArtifactsDir() {
  if (!existsSync(ARTIFACT_DIR)) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
}

function buildSmokeEnvelope(data) {
  return {
    success: true,
    data,
    meta: {
      requestId: `desktop-settings-smoke-${Date.now()}`,
      clientVersion: 'desktop-settings-smoke',
      timestamp: new Date().toISOString(),
    },
  };
}

async function fulfillSmokeJson(route, data) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(buildSmokeEnvelope(data)),
  });
}

async function installSmokeApiRoutes(page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/\/+$/, '');

    if (pathname.endsWith('/api/v1/auth/session') || pathname.endsWith('/api/v1/auth/refresh')) {
      await fulfillSmokeJson(route, SMOKE_AUTH_SESSION);
      return;
    }

    if (pathname.endsWith('/api/v1/profile')) {
      await fulfillSmokeJson(route, SMOKE_PROFILE);
      return;
    }

    if (pathname.endsWith('/api/v1/profile/user-apis')) {
      await fulfillSmokeJson(route, { entries: [] });
      return;
    }

    if (pathname.endsWith('/api/v1/profile/key-manager-state')) {
      await fulfillSmokeJson(route, { version: 1, slots: [], providers: [], entries: [] });
      return;
    }

    await route.fallback();
  });
}

function readSource(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function isBrowserLaunchUnavailable(error) {
  const message = String(error?.message || error || '');
  return /spawn EPERM/i.test(message)
    || /Playwright npx cache directory not found/i.test(message)
    || /Playwright module was not found/i.test(message)
    || /Browser launch unavailable/i.test(message)
    || /browser-executable-not-found/i.test(message)
    || /browser-preflight-threw/i.test(message)
    || /browser-preflight-spawn-error/i.test(message);
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
    const version = readPlaywrightCacheVersion(modulePath);
    candidates.push({
      modulePath,
      mtimeMs: stats.mtimeMs,
      stable: isStablePlaywrightVersion(version),
      version,
    });
  }

  candidates.sort((left, right) => Number(right.stable) - Number(left.stable) || right.mtimeMs - left.mtimeMs);
  if (candidates.length === 0) {
    throw new Error('Playwright module was not found in the npx cache. Run `cmd /c npx playwright --version` once first.');
  }

  return `file:///${candidates[0].modulePath.replace(/\\/g, '/')}`;
}

function readPlaywrightCacheVersion(modulePath) {
  try {
    const packagePath = path.join(path.dirname(modulePath), '..', 'playwright-core', 'package.json');
    return JSON.parse(readFileSync(packagePath, 'utf8')).version || '';
  } catch {
    return '';
  }
}

function isStablePlaywrightVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version || ''));
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

async function clickLocatorWithRetry(page, resolveLocator) {
  let lastError = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const locator = resolveLocator();

    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click({ timeout: 5000 });
      return;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      if (!/detached from the DOM|Timeout/i.test(message)) {
        throw error;
      }
      await page.waitForTimeout(250);
    }
  }

  throw lastError;
}

async function clickButtonByName(page, name) {
  await clickLocatorWithRetry(page, () => page.getByRole('button', { name, exact: true }));
}

async function clickByTestId(page, testId) {
  await clickLocatorWithRetry(page, () => page.getByTestId(testId));
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
var exitCode = 0;

try {
  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: DEFAULT_TARGET_URL });
  viteServer = ensured.server;
  targetUrl = ensured.url || DEFAULT_TARGET_URL;
  browserPreflight = await runBrowserPreflight();

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  browser = await chromium.launch({ headless: true, timeout: 15000 });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
  });
  await installSmokeApiRoutes(page);

  await page.addInitScript(() => {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const createdAtIso = new Date(now).toISOString();
    const tempUser = {
      id: 'smoke-temp-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'smoke-temp-user@temp.local',
      phone: '',
      created_at: createdAtIso,
      updated_at: createdAtIso,
      confirmed_at: createdAtIso,
      last_sign_in_at: createdAtIso,
      app_metadata: {
        isTempUser: true,
        provider: 'temp',
      },
      user_metadata: {
        avatar_url: 'preset-default-local',
        full_name: 'Smoke Temp User',
        isTempUser: true,
      },
    };

    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('kk_theme', 'dark');
    window.localStorage.setItem('kk_language', 'en-US');
    window.localStorage.setItem('kk_studio_storage_mode', 'browser');
    window.localStorage.setItem('kk_tutorial_seen', 'true');
    window.localStorage.setItem('temp_user_session_v1', JSON.stringify({
      user: tempUser,
      createdAt: now,
      expiresAt,
      isTempUser: true,
    }));
    window.localStorage.setItem('kkai.runtime.user-state.v1', JSON.stringify({
      user: tempUser,
      isTempUser: true,
      tempUserExpiry: expiresAt,
    }));
  });

  await gotoWithRetry(page, `${targetUrl}${SETTINGS_HOME_PATH}`);

  const settingsPageRoot = page.getByTestId('settings-page-root');

  await assertVisible(settingsPageRoot, 'Direct settings page root did not render.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings-direct-home.png'),
    fullPage: true,
  });

  await gotoWithRetry(page, `${targetUrl}${SETTINGS_API_PATH}`);

  const addProviderEntry = page.getByTestId('api-official-provider-add');
  const officialEditorBack = page.getByTestId('api-official-editor-back');
  const advancedModeToggle = page.getByRole('button', { name: 'Advanced mode', exact: true });
  const hideAdvancedModeToggle = page.getByRole('button', { name: 'Hide advanced mode', exact: true });
  const hideMoreAdvancedItemsToggle = page.getByRole('button', { name: 'Hide more advanced items', exact: true });
  const workbenchStage = page.getByTestId('settings-workbench-stage');
  const diagnosticsToggle = page.getByTestId('api-workbench-diagnostics-toggle');
  const diagnosticsPanel = page.getByTestId('settings-workbench-diagnostics');

  await assertVisible(addProviderEntry, 'Local API add entry did not render.');
  await addProviderEntry.click();
  await page.waitForURL(`${targetUrl}${SETTINGS_API_PATH}/official/new`, { timeout: 15000, waitUntil: 'domcontentloaded' });
  await assertVisible(officialEditorBack, 'Local API editor did not open.');
  await officialEditorBack.click();
  await page.waitForURL(`${targetUrl}${SETTINGS_API_PATH}`, { timeout: 15000, waitUntil: 'domcontentloaded' });
  await assertVisible(addProviderEntry, 'Local API add entry did not return after closing the editor.');

  await assertVisible(advancedModeToggle, 'Advanced mode toggle did not render.');
  await clickButtonByName(page, 'Advanced mode');
  await assertVisible(hideAdvancedModeToggle, 'Advanced mode did not switch into the expanded state.');
  await assertVisible(workbenchStage, 'API Management stage section did not render.');
  await assertVisible(diagnosticsToggle, 'Diagnostics toggle did not render.');
  await clickByTestId(page, 'api-workbench-diagnostics-toggle');
  await assertVisible(hideMoreAdvancedItemsToggle, 'Diagnostics did not expand the advanced details section.');
  await assertVisible(diagnosticsPanel, 'Diagnostics section did not open.');
  await clickButtonByName(page, 'Hide more advanced items');
  await diagnosticsPanel.waitFor({ state: 'hidden', timeout: 15000 });
  try {
    await workbenchStage.waitFor({ state: 'hidden', timeout: 3000 });
  } catch {
    await clickButtonByName(page, 'Hide advanced mode');
    await workbenchStage.waitFor({ state: 'hidden', timeout: 15000 });
  }

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
    console.error(error);
    exitCode = 1;
  }
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
  process.exit(exitCode);
}
