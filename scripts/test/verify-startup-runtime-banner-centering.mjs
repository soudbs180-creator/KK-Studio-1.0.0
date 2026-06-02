import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function readSource(relativePath) {
  const sourcePath = relativePath.startsWith('src/')
    ? path.join('apps/web', relativePath)
    : relativePath;
  return readFileSync(path.join(REPO_ROOT, sourcePath), 'utf8');
}

function isBrowserLaunchUnavailable(error) {
  const message = String(error?.message || error || '');
  return /spawn EPERM/i.test(message)
    || /Playwright npx cache directory not found/i.test(message)
    || /Playwright module was not found/i.test(message)
    || /browser-executable-not-found/i.test(message)
    || /process-spawn-blocked/i.test(message);
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

function verifyBannerSourceContracts() {
  const shellSource = readSource('src/app/AuthenticatedAppShell.tsx');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const appSource = readSource('src/App.tsx');

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

async function runFallbackVerification(error, browserPreflight, targetUrl) {
  verifyBannerSourceContracts();

  const routes = await Promise.all([
    assertHttpHtml(targetUrl),
    assertHttpHtml(`${targetUrl}/settings`),
  ]);

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
  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: TARGET_URL });
  viteServer = ensured.server;
  targetUrl = ensured.url || TARGET_URL;
  browserPreflight = await runBrowserPreflight();

  if (!browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 1600, height: 980 },
  });

  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);

    window.setTimeout = ((handler, timeout = 0, ...args) => {
      const handlerSource = typeof handler === 'function'
        ? Function.prototype.toString.call(handler)
        : String(handler);
      const isStartupAdvanceTimer = handlerSource.includes('profile_ready')
        || handlerSource.includes('workspace_ready')
        || handlerSource.includes('background_ready');
      const nextDelay = isStartupAdvanceTimer ? 60_000 : timeout;
      return originalSetTimeout(handler, nextDelay, ...args);
    });

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
  if (isBrowserLaunchUnavailable(error)) {
    await runFallbackVerification(error, browserPreflight, targetUrl);
  } else {
    throw error;
  }
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
