import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, 'temp', 'playwright', 'desktop-settings-smoke');
const DEFAULT_TARGET_URL = 'http://127.0.0.1:3000';
const SETTINGS_HOME_PATH = '/settings';
const SETTINGS_API_PATH = '/settings/capability-sources'; // '/settings/api-management'
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

function rmStaleFallbackArtifact(fileName) {
  const artifactPath = path.join(ARTIFACT_DIR, fileName);
  if (existsSync(artifactPath)) {
    rmSync(artifactPath, { force: true });
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
  await page.route('**/healthz**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        success: true,
        data: {
          service: 'kk-studio-api',
          status: 'ok',
          selfHostedCoreReady: true,
          config: {
            hasPostgresConfig: true,
            hasAuthKey: true,
            hasUserApiEncryptionSecret: true,
          },
          repositories: {
            adminConsole: 'postgres',
            authData: 'postgres',
            creditAccounts: 'postgres',
            creditProviders: 'postgres',
            workspaceLayout: 'postgres',
          },
          persistence: {
            userApiKeys: true,
            keyManager: true,
            authData: true,
            authSessions: true,
            tempUsers: true,
            credits: true,
            creditProviders: true,
            workspaceLayout: true,
          },
        },
      }),
    });
  });

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

    if (pathname.endsWith('/api/v1/model-catalog/active') || pathname.endsWith('/api/v1/model-catalog/active-credit-models')) {
      await fulfillSmokeJson(route, { items: [] });
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
    || /browser-executable-not-found/i.test(message)
    || /process-spawn-blocked/i.test(message);
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

function assertBuiltHtml(routePath) {
  const htmlPath = path.join(REPO_ROOT, 'apps', 'web', 'dist', 'index.html');
  if (!existsSync(htmlPath)) {
    throw new Error(`Expected built web HTML at ${htmlPath}. Run the build step before CI fallback smoke checks.`);
  }

  const html = readFileSync(htmlPath, 'utf8');
  if (!/<html/i.test(html)) {
    throw new Error(`Expected built web HTML content for ${routePath}.`);
  }

  return {
    url: `dist:${routePath}`,
    status: 'built',
    length: html.length,
  };
}

async function resolveFallbackRoutes(browserPreflight, targetUrl) {
  if (process.env.CI === 'true' && !browserPreflight?.ok) {
    return [
      assertBuiltHtml(SETTINGS_HOME_PATH),
      assertBuiltHtml(SETTINGS_API_PATH),
      assertBuiltHtml('/'),
    ];
  }

  return await Promise.all([
    assertHttpHtml(`${targetUrl}${SETTINGS_HOME_PATH}`),
    assertHttpHtml(`${targetUrl}${SETTINGS_API_PATH}`),
    assertHttpHtml(targetUrl),
  ]);
}

function verifyDesktopSourceContracts() {
  const appSource = readSource('apps/web/src/App.tsx');
  const appDesktopChromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const settingsPanelSource = readSource('apps/web/src/components/settings/SettingsPanel.localized.tsx');
  const apiSettingsViewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const workbenchSectionsSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');
  const dashboardSource = readSource('apps/web/src/components/settings/views/DashboardView.localized.tsx');

  const checks = [
    /data-testid="desktop-user-menu-trigger"/,
    /desktop-user-menu-settings/,
    /data-testid="settings-page-root"/,
    /sections=\{sections\}/,
    /dashboard-grid-card/,
    /Provider settings and capability routing|dashboardPrimaryAction/,
    /data-testid="api-official-editor-back"/,
    /testId="settings-workbench-overview"/,
    /testId="settings-workbench-capability"|Capability roles/,
    /testId="settings-model-center"/,
    /data-testid="api-model-center-provider-pool"/,
    /data-testid="api-model-center-preset-directory"/,
    /data-testid="api-proxy-provider-add"/,
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

  const routes = await resolveFallbackRoutes(browserPreflight, targetUrl);

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
rmStaleFallbackArtifact('desktop-settings-fallback.json');

let browser;
let page;
let viteServer;
let browserPreflight = null;
let targetUrl = DEFAULT_TARGET_URL;

try {
  browserPreflight = await runBrowserPreflight();

  if (process.env.CI === 'true' && !browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: DEFAULT_TARGET_URL });
  viteServer = ensured.server;
  targetUrl = ensured.url || DEFAULT_TARGET_URL;

  if (!browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  browser = await chromium.launch({ headless: true, timeout: 15000 });
  page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
  });
  await installSmokeApiRoutes(page);

  page.on('console', (msg) => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.error(`[Browser PageError] ${err.message}\n${err.stack}`);
  });

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
  const proxyProviderEntry = page.getByTestId('api-proxy-provider-add');
  const officialEditorBack = page.getByTestId('api-official-editor-back');
  const modelCenter = page.getByTestId('settings-model-center');
  const providerPool = page.getByTestId('api-model-center-provider-pool');
  const presetDirectory = page.getByTestId('api-model-center-preset-directory');

  await assertVisible(modelCenter, 'API model center did not render.');
  await assertVisible(providerPool, 'API provider card pool did not render.');
  await assertVisible(presetDirectory, 'API preset directory did not render.');
  await assertVisible(addProviderEntry, 'Local API add entry did not render.');
  await assertVisible(proxyProviderEntry, 'Proxy provider add entry did not render.');
  await addProviderEntry.click();
  await page.waitForURL(`${targetUrl}${SETTINGS_API_PATH}/official/new`, { timeout: 15000, waitUntil: 'domcontentloaded' });
  await assertVisible(officialEditorBack, 'Local API editor did not open.');
  await officialEditorBack.click();
  await page.waitForURL(`${targetUrl}${SETTINGS_API_PATH}`, { timeout: 15000, waitUntil: 'domcontentloaded' });
  await assertVisible(modelCenter, 'API model center did not return after closing the editor.');
  await assertVisible(addProviderEntry, 'Local API add entry did not return after closing the editor.');

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
  if (page) {
    try {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'desktop-error-debug.png'),
        fullPage: true,
      });
      const html = await page.content();
      writeFileSync(path.join(ARTIFACT_DIR, 'desktop-error-debug.html'), html, 'utf8');
      console.log(`[Smoke Check] Saved error debug screenshot and HTML source to ${ARTIFACT_DIR}`);
    } catch (debugError) {
      console.error('Failed to capture error debug state:', debugError);
    }
  }
  if (!isBrowserLaunchUnavailable(error)) {
    throw error;
  }
  console.warn(`[Smoke Check] Playwright 运行时异常或超时，正在执行降级契约校验...`);
  await runFallbackVerification(error, browserPreflight, targetUrl);
} finally {
  if (browser) {
    await browser.close();
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
}
