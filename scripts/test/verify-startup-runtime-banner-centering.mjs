import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, 'temp', 'playwright', 'startup-runtime-banner-centering');
const TARGET_URL = 'http://127.0.0.1:3000';
const BANNER_TEST_ID = 'startup-runtime-banner';
const PROMPT_BAR_CONTAINER_ID = 'prompt-bar-container';
const PROMPT_BAR_TEXTAREA_SELECTOR = 'textarea.input-bar-textarea, textarea';
const MAX_CENTER_DELTA_PX = 4;

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

function readSource(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function isBrowserLaunchUnavailable(error) {
  const message = String(error?.message || error || '');
  return /spawn EPERM/i.test(message)
    || /Playwright npx cache directory not found/i.test(message)
    || /Playwright module was not found/i.test(message)
    || /browser-executable-not-found/i.test(message)
    || /process-spawn-blocked/i.test(message)
    || /browser-preflight-(?:nonzero-exit|timeout|spawn-error|threw)/i.test(message);
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
      assertBuiltHtml('/'),
      assertBuiltHtml('/settings'),
    ];
  }

  return await Promise.all([
    assertHttpHtml(targetUrl),
    assertHttpHtml(`${targetUrl}/settings`),
  ]);
}

function verifyBannerSourceContracts() {
  const shellSource = readSource('apps/web/src/app/AuthenticatedAppShell.tsx');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const appSource = readSource('apps/web/src/App.tsx');

  const checks = [
    /data-testid="startup-runtime-banner"/,
    /PROMPT_BAR_CONTAINER_ID = 'prompt-bar-container'/,
    /PROMPT_BAR_TEXTAREA_SELECTOR = 'textarea\.input-bar-textarea, textarea'/,
    /transform: 'translateX\(-50%\)'/,
    /showStartupBanner\?: boolean;/,
    /showStartupBanner = true/,
    /const showStartupRuntimeBanner = showStartupBanner && !isBackgroundReady;/,
    /\{showStartupRuntimeBanner \? <StartupRuntimeBanner \/> : null\}/,
    /showStartupBanner=\{rootMode === 'workspace'\}/,
    /id="prompt-bar-container"/,
    /className=\{`input-bar-textarea/,
  ];

  const sources = [shellSource, promptBarSource, appSource];

  for (const pattern of checks) {
    if (!sources.some((source) => pattern.test(source))) {
      throw new Error(`Startup runtime banner source contract missing pattern: ${pattern}`);
    }
  }
}

const SMOKE_PROFILE = {
  id: 'banner-smoke-temp-user',
  email: 'banner-smoke-temp-user@temp.local',
  nickname: 'Banner Smoke Temp User',
  avatarUrl: 'preset-default-local',
  role: 'authenticated',
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

function buildSmokeEnvelope(data) {
  return {
    success: true,
    data,
    meta: {
      requestId: `banner-smoke-${Date.now()}`,
      clientVersion: 'banner-smoke',
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

async function measureBannerAlignment(page) {
  return page.evaluate(({ bannerTestId, promptBarContainerId, promptTextareaSelector }) => {
    const banner = document.querySelector(`[data-testid="${bannerTestId}"]`);
    const promptBar = document.getElementById(promptBarContainerId);
    const anchorCandidates = promptBar
      ? Array.from(promptBar.querySelectorAll(promptTextareaSelector))
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .sort((left, right) => {
          if (right.rect.width !== left.rect.width) {
            return right.rect.width - left.rect.width;
          }

          return right.rect.top - left.rect.top;
        })
      : [];
    const anchor = anchorCandidates[0]?.element ?? promptBar;

    if (!banner || !promptBar || !anchor) {
      return {
        bannerFound: Boolean(banner),
        promptBarFound: Boolean(promptBar),
        anchorFound: Boolean(anchor),
      };
    }

    const bannerRect = banner.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const bannerCenterX = bannerRect.left + (bannerRect.width / 2);
    const anchorCenterX = anchorRect.left + (anchorRect.width / 2);

    return {
      bannerFound: true,
      promptBarFound: true,
      anchorFound: true,
      bannerText: banner.textContent?.trim() || '',
      bannerCenterX,
      anchorCenterX,
      deltaX: Math.abs(bannerCenterX - anchorCenterX),
      viewportWidth: window.innerWidth,
    };
  }, {
    bannerTestId: BANNER_TEST_ID,
    promptBarContainerId: PROMPT_BAR_CONTAINER_ID,
    promptTextareaSelector: PROMPT_BAR_TEXTAREA_SELECTOR,
  });
}

function assertCentered(result, label) {
  if (!result?.bannerFound || !result?.promptBarFound || !result?.anchorFound) {
    throw new Error(`Startup runtime banner centering precondition failed at ${label}: ${JSON.stringify(result)}`);
  }

  if (typeof result.deltaX !== 'number' || result.deltaX > MAX_CENTER_DELTA_PX) {
    throw new Error(`Startup runtime banner is not centered to the prompt input at ${label}: ${JSON.stringify(result)}`);
  }
}

ensureArtifactsDir();
rmStaleFallbackArtifact('startup-runtime-banner-fallback.json');

async function runFallbackVerification(error, browserPreflight, targetUrl) {
  verifyBannerSourceContracts();

  const routes = await resolveFallbackRoutes(browserPreflight, targetUrl);

  const summary = {
    mode: 'fallback',
    reason: String(error?.message || error),
    browserPreflight,
    routes,
    sourceContractsVerified: true,
    artifactDir: ARTIFACT_DIR,
  };

  writeFileSync(
    path.join(ARTIFACT_DIR, 'startup-runtime-banner-fallback.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

let browser;
let page;
let viteServer;
let browserPreflight = null;
let targetUrl = TARGET_URL;

try {
  browserPreflight = await runBrowserPreflight();

  if (process.env.CI === 'true' && !browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: TARGET_URL });
  viteServer = ensured.server;
  targetUrl = ensured.url || TARGET_URL;

  if (!browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
  });

  await installSmokeApiRoutes(page);

  await page.addInitScript(() => {
    window.__KK_STARTUP_SMOKE_HOLD_MS = 60_000;
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('kk_theme', 'dark');
    window.localStorage.setItem('kk_language', 'zh-CN');
    window.localStorage.setItem('kk_studio_storage_mode', 'browser');
    window.localStorage.setItem('kk_tutorial_seen', 'true');
    window.localStorage.setItem('kk_has_logged_in', 'true');

    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const createdAtIso = new Date(now).toISOString();
    const tempUser = {
      id: 'banner-smoke-temp-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'banner-smoke-temp-user@temp.local',
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
        full_name: 'Banner Smoke Temp User',
        isTempUser: true,
      },
    };
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

  await gotoWithRetry(page, targetUrl);

  const promptBar = page.locator(`#${PROMPT_BAR_CONTAINER_ID}`);
  const banner = page.getByTestId(BANNER_TEST_ID);

  await assertVisible(promptBar, 'Prompt bar did not render on the workspace.');
  await assertVisible(banner, 'Startup runtime banner did not render.');
  await page.waitForTimeout(250);

  const initialResult = await measureBannerAlignment(page);
  assertCentered(initialResult, 'initial');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'startup-runtime-banner-initial.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1280, height: 980 });
  await page.waitForTimeout(300);

  const resizedResult = await measureBannerAlignment(page);
  assertCentered(resizedResult, 'resized');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'startup-runtime-banner-resized.png'),
    fullPage: true,
  });

  console.log(JSON.stringify({
    mode: 'browser',
    browserPreflight,
    initialResult,
    resizedResult,
    artifactDir: ARTIFACT_DIR,
  }, null, 2));
} catch (error) {
  if (!isBrowserLaunchUnavailable(error)) {
    throw error;
  }
  console.warn(`[Smoke Check] Playwright 运行时异常或超时，正在执行降级契约校验...`);
  await runFallbackVerification(error, browserPreflight, targetUrl);
} finally {
  if (page) {
    await page.close().catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
}
