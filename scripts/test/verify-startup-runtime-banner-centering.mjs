import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, '.tmp-playwright', 'startup-runtime-banner-centering');
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

const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
const { chromium } = await import(playwrightModuleUrl);

ensureArtifactsDir();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
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
});

try {
  await gotoWithRetry(page, TARGET_URL);

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
    initialResult,
    resizedResult,
    artifactDir: ARTIFACT_DIR,
  }, null, 2));
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
