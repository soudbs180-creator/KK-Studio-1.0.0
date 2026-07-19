import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, 'temp', 'playwright', 'ai-takeover-smoke');
const TARGET_URL = 'http://127.0.0.1:3007';

const SMOKE_PROFILE = {
  id: 'ai-takeover-smoke-user',
  email: 'ai-takeover-smoke-user@temp.local',
  nickname: 'AI Takeover Smoke User',
  avatarUrl: 'preset-default-local',
  role: 'user',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SMOKE_AUTH_SESSION = {
  accessToken: 'ai-takeover-smoke-access-token',
  refreshToken: 'ai-takeover-smoke-refresh-token',
  expiresIn: 3600,
  sessionExpiresAt: '2099-01-01T00:00:00.000Z',
  profile: SMOKE_PROFILE,
};

const SMOKE_DURABLE_QUEUE_JOBS = [
  {
    id: 'job_ai_takeover_smoke_queue',
    idempotencyKey: 'ai-takeover-smoke-queue',
    canvasId: 'default',
    status: 'paused',
    createdBy: 'assistant',
    prompts: [
      {
        id: 'prompt_smoke_completed',
        prompt: 'Smoke queue completed output',
        status: 'completed',
        promptNodeId: 'smoke-prompt-node',
        resultImageNodeIds: ['smoke-image-node'],
        retryCount: 0,
      },
      {
        id: 'prompt_smoke_failed',
        prompt: 'Smoke queue failed output',
        status: 'failed',
        error: 'smoke failure reason',
        retryCount: 3,
      },
    ],
    options: {
      modelId: 'gemini-2.5-flash',
      aspectRatio: '1:1',
      imageSize: '1K',
      countPerPrompt: 1,
      concurrency: 1,
      layout: 'grid',
      layoutPreset: 'compact-grid',
      columns: 2,
      gap: 48,
    },
    outputGroup: {
      label: 'Smoke queue',
      color: '#8b5cf6',
      includePromptNodes: true,
      nodeIds: ['smoke-prompt-node', 'smoke-image-node'],
      tags: ['ai-takeover-smoke'],
    },
    createdAt: 0,
    updatedAt: 0,
  },
];

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

function buildSmokeEnvelope(data) {
  return {
    success: true,
    data,
    meta: {
      requestId: `ai-takeover-smoke-${Date.now()}`,
      clientVersion: 'ai-takeover-smoke',
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
      body: JSON.stringify({ success: true, data: { service: 'kk-studio-api', status: 'ok' } }),
    });
  });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/\/+$/, '');

    if (pathname.endsWith('/api/v1/auth/temp-users')) {
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await fulfillSmokeJson(route, {
        userId: 'temp-ai-takeover-smoke',
        email: 'temp-ai-takeover-smoke@temp.local',
        nickname: 'AI Takeover Smoke User',
        createdAt,
        expiresAt,
        isTempUser: true,
      });
      return;
    }

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
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  if (!(await locator.isVisible())) {
    throw new Error(message);
  }
}

async function assertElementInViewport(locator, message) {
  const rect = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  if (rect.width <= 0 || rect.height <= 0 || rect.left < 0 || rect.top < 0 || rect.right > rect.viewportWidth || rect.bottom > rect.viewportHeight) {
    throw new Error(`${message}: ${JSON.stringify(rect)}`);
  }
}

async function isVisibleWithin(locator, timeout = 5000) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function captureFailureScreenshot(page, fileName) {
  if (!page) return null;

  const artifactPath = path.join(ARTIFACT_DIR, fileName);
  try {
    await page.screenshot({ path: artifactPath, fullPage: true });
    return artifactPath;
  } catch {
    return null;
  }
}

async function collectFailureDiagnostics(page) {
  if (!page) return null;

  try {
    return await page.evaluate(() => {
      const serializeElement = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          selector,
          html: element.outerHTML.slice(0, 2000),
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
        };
      };

      return {
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        desktopEntry: serializeElement('#btn-desktop-ai-assistant'),
        desktopChrome: serializeElement('.desktop-left-chrome'),
        workspaceChromeSurface: serializeElement('.kk-workspace-chrome-surface'),
        durableQueuePanel: serializeElement('.ai-takeover-durable-queue-panel'),
        bodyText: document.body.innerText.slice(0, 1500),
      };
    });
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}

async function ensureWorkspaceReady(page) {
  const desktopEntry = page.locator('#btn-desktop-ai-assistant');
  if (await isVisibleWithin(desktopEntry, 6000)) {
    return desktopEntry;
  }

  const landingLogin = page.locator('.kk-landing-nav__login').first();
  if (await isVisibleWithin(landingLogin, 10000)) {
    await landingLogin.click();
  }

  const tempAccessButton = page.locator('.auth-social-row .auth-social-btn').last();
  if (await isVisibleWithin(tempAccessButton, 10000)) {
    await tempAccessButton.click();
  }

  await assertVisible(desktopEntry, 'Desktop AI assistant entry did not render after temporary access.');
  return desktopEntry;
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

function verifySourceContracts() {
  const chatSidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const modeSwitchSource = readSource('apps/web/src/features/ai-takeover/components/AITakeoverToggle.tsx');
  const dockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');
  const generationToolsSource = readSource('apps/web/src/features/ai-assistant-runtime/tools/generationTools.ts');

  const checks = [
    { source: chatSidebarSource, pattern: /id="btn-desktop-ai-assistant"/, label: 'desktop AI assistant edge entrypoint' },
    { source: chatSidebarSource, pattern: /data-chat-shell-action=\{CHAT_SHELL_ACTIONS\.toggleSidebar\.uiAction\}/, label: 'desktop AI entry state' },
    { source: modeSwitchSource, pattern: /id:\s*['"]btn-ai-direct-mode['"]/, label: 'direct mode toggle' },
    { source: modeSwitchSource, pattern: /id:\s*['"]btn-ai-assist-mode['"]/, label: 'assist mode toggle' },
    { source: modeSwitchSource, pattern: /id:\s*['"]btn-ai-takeover-toggle['"]/, label: 'takeover mode toggle' },
    { source: chatSidebarSource, pattern: /kk-chat-sidebar-composer-actions[^"]*min-w-0[^"]*flex-wrap/, label: 'composer action wrapping' },
    { source: chatSidebarSource, pattern: /ai-takeover-run-timeline/, label: 'chat sidebar run timeline surface' },
    { source: chatSidebarSource, pattern: /ai-takeover-composer-input/, label: 'chat sidebar takeover input' },
    { source: chatSidebarSource, pattern: /durableGenerationQueue,\s*type GenerationBatchJob/, label: 'durable queue runtime import' },
    { source: chatSidebarSource, pattern: /ai-takeover-durable-queue-panel/, label: 'durable queue panel surface' },
    { source: chatSidebarSource, pattern: /data-action="resume-durable-job"/, label: 'durable queue resume action' },
    { source: chatSidebarSource, pattern: /data-action="retry-durable-job"/, label: 'durable queue retry action' },
    { source: chatSidebarSource, pattern: /data-action="locate-durable-job"/, label: 'durable queue locate action' },
    { source: chatSidebarSource, pattern: /data-action="cancel-durable-job"/, label: 'durable queue cancel action' },
    { source: dockSource, pattern: /ai-takeover-run-timeline/, label: 'run timeline surface' },
    { source: dockSource, pattern: /id="ai-takeover-dock-composer-input"/, label: 'dock composer input' },
    { source: generationToolsSource, pattern: /name: 'generation\.createVideoJob'[\s\S]*ctx\.notify\.success\('Video job submitted'/, label: 'video queue notification state' },
    { source: generationToolsSource, pattern: /name: 'generation\.createAudioJob'[\s\S]*ctx\.notify\.success\('Audio job submitted'/, label: 'audio queue notification state' },
  ];

  for (const check of checks) {
    if (!check.pattern.test(check.source)) {
      throw new Error(`AI takeover source contract missing: ${check.label}`);
    }
  }

  if (/createProgressToast|document\.createElement\('div'\)|kk-progress-toast/.test(generationToolsSource)) {
    throw new Error('generationTools still contains raw DOM progress toast code.');
  }
}

async function runFallbackVerification(error, browserPreflight, targetUrl, diagnostics = null) {
  verifySourceContracts();

  const routes = await Promise.all([
    assertHttpHtml(targetUrl),
  ]);

  const summary = {
    mode: 'fallback',
    reason: String(error?.message || error),
    browserPreflight,
    routes,
    artifactDir: ARTIFACT_DIR,
    diagnostics,
  };

  writeFileSync(
    path.join(ARTIFACT_DIR, 'ai-takeover-smoke-fallback.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

ensureArtifactsDir();
rmStaleFallbackArtifact('ai-takeover-smoke-fallback.json');
rmStaleFallbackArtifact('ai-takeover-smoke-failure.png');

let browser;
let page;
let viteServer;
let browserPreflight = null;
let targetUrl = TARGET_URL;

try {
  browserPreflight = await runBrowserPreflight();

  const ensured = await ensureLocalViteServer({
    root: REPO_ROOT,
    url: TARGET_URL,
    fallbackPorts: [3008, 3009, 3010],
  });
  viteServer = ensured.server;
  targetUrl = ensured.url || TARGET_URL;

  if (!browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  browser = await chromium.launch({
    headless: true,
    timeout: 15000,
    executablePath: browserPreflight.executablePath || undefined,
  });
  page = await browser.newPage({ viewport: { width: 1600, height: 980 } });
  await installSmokeApiRoutes(page);

  await page.addInitScript(({ seedDurableQueueJobs, authenticatedOwnerId }) => {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const createdAtIso = new Date(now).toISOString();
    const tempUser = {
      id: 'ai-takeover-smoke-temp-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'ai-takeover-smoke-temp-user@temp.local',
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
        full_name: 'AI Takeover Smoke User',
        isTempUser: true,
      },
    };

    try {
      window.localStorage.setItem('theme', 'dark');
      window.localStorage.setItem('kk_theme', 'dark');
      window.localStorage.setItem('kk_language', 'zh-CN');
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
      const queueSnapshot = JSON.stringify(seedDurableQueueJobs.map((job) => ({
        ...job,
        createdAt: now,
        updatedAt: now,
      })));
      const queueStorageKey = 'kk_durable_generation_jobs';
      window.localStorage.setItem(queueStorageKey, queueSnapshot);
      for (const ownerId of new Set([tempUser.id, authenticatedOwnerId])) {
        window.localStorage.setItem(
          `${queueStorageKey}:owner:${encodeURIComponent(ownerId)}`,
          queueSnapshot,
        );
      }
    } catch (e) {
      console.warn('InitScript localStorage error:', e);
    }
  }, {
    seedDurableQueueJobs: SMOKE_DURABLE_QUEUE_JOBS,
    authenticatedOwnerId: SMOKE_PROFILE.id,
  });

  await gotoWithRetry(page, targetUrl);
  await page.waitForTimeout(1200);

  const desktopEntry = await ensureWorkspaceReady(page);
  await assertElementInViewport(desktopEntry, 'Desktop AI assistant entry is outside the viewport');
  await desktopEntry.click();

  const assistToggle = page.locator('#btn-ai-assist-mode');
  await assertVisible(assistToggle, 'AI assist mode did not render after opening chat.');
  await assistToggle.click();
  await assertVisible(page.locator('.ai-context-suggestions'), 'Context suggestions did not render in AI assist mode.');

  const takeoverToggle = page.locator('#btn-ai-takeover-toggle');
  await assertVisible(takeoverToggle, 'AI takeover toggle did not render after opening chat.');
  await assertElementInViewport(takeoverToggle, 'AI takeover toggle is outside the viewport after opening chat');
  await takeoverToggle.click();

  const durableQueuePanel = page.locator('.ai-takeover-durable-queue-panel');
  await assertVisible(durableQueuePanel, 'DurableGenerationQueue panel did not render after enabling AI takeover.');

  const durableQueueJob = page.locator('.ai-takeover-durable-queue__job').first();
  await assertVisible(durableQueueJob, 'DurableGenerationQueue job did not render.');
  await assertVisible(page.locator('[data-action="resume-durable-job"]').first(), 'DurableGenerationQueue resume action did not render.');
  await assertVisible(page.locator('[data-action="retry-durable-job"]').first(), 'DurableGenerationQueue retry action did not render.');
  await assertVisible(page.locator('[data-action="locate-durable-job"]').first(), 'DurableGenerationQueue locate action did not render.');
  await assertVisible(page.locator('[data-action="cancel-durable-job"]').first(), 'DurableGenerationQueue cancel action did not render.');

  const durableQueueText = await durableQueuePanel.textContent();
  if (!durableQueueText?.includes('smoke failure reason')) {
    throw new Error(`DurableGenerationQueue failure reason did not render: ${durableQueueText || ''}`);
  }

  const takeoverInput = page.locator('#ai-takeover-composer-input');
  await assertVisible(takeoverInput, 'AI takeover composer input did not render.');
  await takeoverInput.fill('Open system log');
  await takeoverInput.press('Enter');

  const timeline = page.locator('.ai-takeover-run-timeline');
  await assertVisible(timeline, 'AI takeover run timeline did not render after sending an instruction.');

  const statuses = await page.locator('.ai-takeover-run-timeline__step').evaluateAll((steps) => steps.map((step) => ({
    text: step.textContent?.trim() || '',
    status: step.getAttribute('data-status') || '',
  })));

  if (statuses.length < 5) {
    throw new Error(`Expected 5 AI takeover timeline steps, got ${statuses.length}.`);
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'ai-takeover-timeline.png'),
    fullPage: true,
  });

  console.log(JSON.stringify({
    mode: 'browser',
    browserPreflight,
    targetUrl,
    statuses,
    durableQueueText,
    artifactDir: ARTIFACT_DIR,
  }, null, 2));
} catch (error) {
  const failureScreenshot = await captureFailureScreenshot(page, 'ai-takeover-smoke-failure.png');
  const diagnostics = await collectFailureDiagnostics(page);
  if (!isBrowserLaunchUnavailable(error)) {
    throw error;
  }
  console.warn(`[AI Takeover Smoke] Browser path failed, running fallback contracts: ${String(error?.message || error)}${failureScreenshot ? ` (screenshot: ${failureScreenshot})` : ''}`);
  await runFallbackVerification(error, browserPreflight, targetUrl, diagnostics);
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
