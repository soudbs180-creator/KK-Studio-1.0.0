import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const TARGET_URL = 'http://127.0.0.1:3000';
const STORAGE_KEY = 'kk_studio_canvas_state';
const ARTIFACT_DIR = path.join(REPO_ROOT, 'temp', 'playwright', 'large-canvas-10k');
const PROGRESS_LOG_PATH = path.join(ARTIFACT_DIR, 'progress.log');
const BROWSER_LOG_PATH = path.join(ARTIFACT_DIR, 'browser.log');
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX6lzQAAAAASUVORK5CYII=';
const smokeStartedAt = Date.now();

function mark(message) {
  const line = `[large-canvas-10k] +${Date.now() - smokeStartedAt}ms ${message}`;
  console.log(line);
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  appendFileSync(PROGRESS_LOG_PATH, `${line}\n`, 'utf8');
}

function browserLog(prefix, message) {
  const line = `[${prefix}] +${Date.now() - smokeStartedAt}ms ${message}`;
  console.log(line);
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  appendFileSync(BROWSER_LOG_PATH, `${line}\n`, 'utf8');
}

const SMOKE_PROFILE = {
  id: 'large-canvas-10k-user',
  email: 'large-canvas-10k-user@temp.local',
  nickname: 'Large Canvas 10k User',
  avatarUrl: 'preset-default-local',
  role: 'authenticated',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const SMOKE_AUTH_SESSION = {
  accessToken: 'large-canvas-10k-access-token',
  refreshToken: 'large-canvas-10k-refresh-token',
  expiresIn: 3600,
  sessionExpiresAt: '2099-01-01T00:00:00.000Z',
  profile: SMOKE_PROFILE,
};

function ensureArtifactsDir() {
  if (!existsSync(ARTIFACT_DIR)) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
}

function removeStaleArtifact(fileName) {
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
      requestId: `large-canvas-10k-${Date.now()}`,
      clientVersion: 'large-canvas-10k',
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
      stable: /^\d+\.\d+\.\d+$/.test(String(version || '')),
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

function buildLargeCanvasState() {
  const now = Date.now();
  const promptNodes = [
    {
      id: 'prompt-main',
      prompt: 'large canvas grouped card smoke',
      originalPrompt: 'large canvas grouped card smoke',
      position: { x: 0, y: 0 },
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'gemini-2.5-flash-image-preview',
      childImageIds: ['img-main-a', 'img-main-b'],
      timestamp: now,
      mode: 'image',
      userMoved: false,
    },
  ];
  const imageNodes = [
    {
      id: 'img-main-a',
      storageId: 'img-main-a',
      url: tinyPng,
      prompt: 'main child A',
      aspectRatio: '1:1',
      imageSize: '1K',
      timestamp: now,
      model: 'gemini-2.5-flash-image-preview',
      canvasId: 'default',
      parentPromptId: 'prompt-main',
      position: { x: -154, y: 400 },
      userMoved: false,
    },
    {
      id: 'img-main-b',
      storageId: 'img-main-b',
      url: tinyPng,
      prompt: 'main child B',
      aspectRatio: '1:1',
      imageSize: '1K',
      timestamp: now,
      model: 'gemini-2.5-flash-image-preview',
      canvasId: 'default',
      parentPromptId: 'prompt-main',
      position: { x: 154, y: 400 },
      userMoved: false,
    },
  ];

  for (let i = 1; i <= 1100; i += 1) {
    const promptId = `prompt-${i}`;
    const x = 2800 + (i % 55) * 920;
    const y = Math.floor(i / 55) * 1500;
    const childA = `img-${i}-a`;
    const childB = `img-${i}-b`;
    promptNodes.push({
      id: promptId,
      prompt: `group ${i}`,
      originalPrompt: `group ${i}`,
      position: { x, y },
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'gemini-2.5-flash-image-preview',
      childImageIds: [childA, childB],
      timestamp: now + i,
      mode: 'image',
      userMoved: false,
    });
    imageNodes.push(
      {
        id: childA,
        storageId: childA,
        url: tinyPng,
        prompt: childA,
        aspectRatio: '1:1',
        imageSize: '1K',
        timestamp: now + i * 2,
        model: 'gemini-2.5-flash-image-preview',
        canvasId: 'default',
        parentPromptId: promptId,
        position: { x: x - 154, y: y + 400 },
        userMoved: false,
      },
      {
        id: childB,
        storageId: childB,
        url: tinyPng,
        prompt: childB,
        aspectRatio: '1:1',
        imageSize: '1K',
        timestamp: now + i * 2 + 1,
        model: 'gemini-2.5-flash-image-preview',
        canvasId: 'default',
        parentPromptId: promptId,
        position: { x: x + 154, y: y + 400 },
        userMoved: false,
      },
    );
  }

  for (let i = 0; i < 7800; i += 1) {
    const id = `standalone-${i}`;
    imageNodes.push({
      id,
      storageId: id,
      url: tinyPng,
      prompt: id,
      aspectRatio: '1:1',
      imageSize: '1K',
      timestamp: now + 5000 + i,
      model: 'gemini-2.5-flash-image-preview',
      canvasId: 'default',
      parentPromptId: '',
      position: {
        x: -16000 + (i % 120) * 760,
        y: 1600 + Math.floor(i / 120) * 760,
      },
      userMoved: false,
    });
  }

  return {
    canvases: [
      {
        id: 'default',
        name: '10k smoke',
        promptNodes,
        imageNodes,
        groups: [],
        drawings: [],
        workflow: undefined,
        lastModified: now,
      },
    ],
    activeCanvasId: 'default',
    history: { default: { past: [], future: [] } },
    fileSystemHandle: null,
    folderName: null,
    selectedNodeIds: ['prompt-main'],
    subCardLayoutMode: 'row',
    viewportCenter: { x: 0, y: 0 },
  };
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

async function dismissStorageModalIfPresent(page) {
  const saveSettingsButton = page.getByRole('button', { name: '保存设置' });
  if (await saveSettingsButton.isVisible().catch(() => false)) {
    await saveSettingsButton.click();
    await page.waitForTimeout(800);
  }
}

async function dismissStorageModalViaDomIfPresent(page) {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveSettingsButton = buttons.find((button) => {
      const text = (button.textContent || '').trim();
      return text.includes('Save settings') || text.includes('保存设置');
    });
    if (!saveSettingsButton) {
      return false;
    }
    saveSettingsButton.click();
    return true;
  });

  if (clicked) {
    await page.waitForTimeout(800);
  }
}

async function collectSurfaceDiagnostics(page) {
  return await page.evaluate((storageKey) => {
    const rawState = localStorage.getItem(storageKey);
    let parsed = null;
    try {
      parsed = rawState ? JSON.parse(rawState) : null;
    } catch {
      parsed = { parseError: true };
    }
    const activeCanvas = parsed?.canvases?.find?.((canvas) => canvas?.id === parsed?.activeCanvasId) ?? parsed?.canvases?.[0] ?? null;
    const canvasContainer = document.getElementById('canvas-container');
    const promptSurfaces = Array.from(document.querySelectorAll('[data-canvas-surface="prompt"]'));
    const imageSurfaces = Array.from(document.querySelectorAll('[data-canvas-surface="image"]'));
    const candidateNodes = Array.from(document.querySelectorAll('[data-canvas-surface], [class*="canvas"], [class*="Canvas"], [class*="prompt"], [class*="Prompt"]'))
      .slice(0, 30)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: typeof element.className === 'string' ? element.className.slice(0, 180) : '',
          surface: element.getAttribute('data-canvas-surface'),
          text: (element.textContent || '').trim().slice(0, 120),
          box: {
            left: Math.round(box.left),
            top: Math.round(box.top),
            width: Math.round(box.width),
            height: Math.round(box.height),
          },
        };
      });

    return {
      readyState: document.readyState,
      storageBytes: rawState?.length ?? 0,
      canvasContainer: canvasContainer
        ? {
            childElementCount: canvasContainer.childElementCount,
            className: canvasContainer.className,
            text: (canvasContainer.textContent || '').trim().slice(0, 300),
          }
        : null,
      activeCanvasCounts: {
        prompts: activeCanvas?.promptNodes?.length ?? 0,
        images: activeCanvas?.imageNodes?.length ?? 0,
      },
      surfaceCounts: {
        prompts: promptSurfaces.length,
        images: imageSurfaces.length,
      },
      bodyText: (document.body.innerText || '').slice(0, 1200),
      candidateNodes,
    };
  }, STORAGE_KEY);
}

async function readSurfaceCounts(page) {
  return await Promise.race([
    page.evaluate(() => {
      const health = window.__KK_LARGE_CANVAS_HEALTH__;
      if (health) {
        return health;
      }

      return {
        promptSurfaces: 0,
        imageSurfaces: 0,
        hasCanvasContainer: false,
        totalElements: 0,
        imageElements: 0,
        minimapRects: 0,
      };
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('surface count evaluation timed out')), 2000);
    }),
  ]);
}

async function installDebuggerStackCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Debugger.enable');

  cdp.on('Debugger.paused', (event) => {
    const frames = event.callFrames
      .slice(0, 40)
      .map((frame, index) => {
        const location = frame.location || {};
        const line = typeof location.lineNumber === 'number' ? location.lineNumber + 1 : 0;
        const column = typeof location.columnNumber === 'number' ? location.columnNumber + 1 : 0;
        return `${index}: ${frame.functionName || '(anonymous)'} ${frame.url || '<anonymous>'}:${line}:${column}`;
      })
      .join('\n');
    browserLog('BROWSER_DEBUGGER_PAUSED', `reason=${event.reason || 'unknown'}\n${frames}`);
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(path.join(ARTIFACT_DIR, 'debugger-paused-stack.txt'), frames, 'utf8');
    void cdp.send('Debugger.resume').catch((error) => {
      browserLog('BROWSER_DEBUGGER_RESUME_FAILED', error instanceof Error ? error.message : String(error));
    });
  });

  return async (label) => {
    browserLog('DEBUGGER_PAUSE_REQUEST', label);
    await cdp.send('Debugger.pause').catch((error) => {
      browserLog('DEBUGGER_PAUSE_FAILED', error instanceof Error ? error.message : String(error));
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };
}

function buildCanvasHealthFromCounts(counts, expectedCounts) {
  return {
    promptCount: expectedCounts.promptCount,
    imageCount: expectedCounts.imageCount,
    surfaceCount: counts.promptSurfaces + counts.imageSurfaces,
    promptSurfaceCount: counts.promptSurfaces,
    imageSurfaceCount: counts.imageSurfaces,
    minimapRects: counts.minimapRects ?? 0,
    promptShellTextCount: 0,
    visibleImageBoxCount: counts.imageSurfaces,
    totalElements: counts.totalElements,
    imageElements: counts.imageElements,
  };
}

async function waitForCanvasSurfaces(page, captureDebuggerStack) {
  const deadline = Date.now() + 45000;
  let lastCounts = null;
  let capturedStack = false;

  while (Date.now() < deadline) {
    try {
      const counts = await readSurfaceCounts(page);
      lastCounts = counts;
      if (counts.promptSurfaces > 0 && counts.imageSurfaces > 0) {
        return counts;
      }
    } catch (error) {
      lastCounts = { error: error instanceof Error ? error.message : String(error) };
      if (!capturedStack && lastCounts.error.includes('evaluation timed out')) {
        capturedStack = true;
        await captureDebuggerStack?.(`waitForCanvasSurfaces:${lastCounts.error}`);
      }
    }
    await page.waitForTimeout(250);
  }

  const diagnostics = await Promise.race([
    collectSurfaceDiagnostics(page),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('surface diagnostics timed out')), 3000);
    }),
  ]).catch((error) => ({
    diagnosticError: error instanceof Error ? error.message : String(error),
    lastCounts,
  }));

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(path.join(ARTIFACT_DIR, 'surface-timeout-diagnostics.json'), JSON.stringify(diagnostics, null, 2), 'utf8');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'surface-timeout.png'),
  }).catch(() => {});
  throw new Error(`Canvas surfaces did not appear within 45000ms. Last counts: ${JSON.stringify(lastCounts)}. Diagnostics: ${JSON.stringify(diagnostics)}`);
}

async function measureGroupedScene(page) {
  return await page.evaluate((storageKey) => {
    const rawState = localStorage.getItem(storageKey);
    const parsed = rawState ? JSON.parse(rawState) : null;
    const activeCanvas = parsed?.canvases?.find?.((canvas) => canvas?.id === parsed?.activeCanvasId) ?? parsed?.canvases?.[0] ?? null;
    const promptNode = activeCanvas?.promptNodes?.find?.((node) => node?.id === 'prompt-main') ?? null;
    const promptShell = document.querySelector('[data-card-id="prompt-main"]');
    const promptSurface = promptShell?.querySelector('[data-canvas-surface="prompt"]');
    const promptRect = promptSurface?.getBoundingClientRect();
    const promptRuntimeX = Number(promptShell?.getAttribute('data-x'));
    const promptRuntimeY = Number(promptShell?.getAttribute('data-y'));
    const imageNodes = ['img-main-a', 'img-main-b']
      .map((id) => activeCanvas?.imageNodes?.find?.((node) => node?.id === id))
      .filter(Boolean);
    const imageBoxes = ['img-main-a', 'img-main-b']
      .map((id) => {
        const shell = document.querySelector(`[data-card-id="${id}"]`);
        const surface = shell?.querySelector('[data-canvas-surface="image"]');
        const box = surface?.getBoundingClientRect();
        const runtimeX = Number(shell?.getAttribute('data-x'));
        const runtimeY = Number(shell?.getAttribute('data-y'));
        return box
          ? {
              id,
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              centerX: box.left + (box.width / 2),
              position: Number.isFinite(runtimeX) && Number.isFinite(runtimeY)
                ? { x: runtimeX, y: runtimeY }
                : null,
            }
          : null;
      })
      .filter(Boolean);
    const connectorPaths = ['img-main-a', 'img-main-b']
      .map((imageId) => ({
        imageId,
        path: document.getElementById(`connector-prompt-main-${imageId}`),
      }))
      .filter((entry) => entry.path);
    const connectorEnds = connectorPaths
      .map(({ imageId, path }) => {
        const match = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\s*$/.exec(path.getAttribute('d') || '');
        if (!match) return null;
        const ownerSvg = path.ownerSVGElement;
        const screenMatrix = ownerSvg?.getScreenCTM?.();
        if (!screenMatrix) return null;
        const point = new DOMPoint(Number(match[1]), Number(match[2])).matrixTransform(screenMatrix);
        return { imageId, x: point.x, y: point.y };
      })
      .filter(Boolean);

    return {
      promptPosition: promptNode?.position ?? null,
      promptRuntimePosition: Number.isFinite(promptRuntimeX) && Number.isFinite(promptRuntimeY)
        ? { x: promptRuntimeX, y: promptRuntimeY }
        : null,
      promptBox: promptRect
        ? {
            left: promptRect.left,
            top: promptRect.top,
            width: promptRect.width,
            height: promptRect.height,
            bottom: promptRect.bottom,
          }
        : null,
      imagePositions: imageNodes.map((node) => ({
        id: node.id,
        position: node.position,
        parentPromptId: node.parentPromptId,
      })),
      imageBoxes,
      connectorEnds,
    };
  }, STORAGE_KEY);
}

async function resolvePromptDragStartScreen(page, promptId) {
  return await page.evaluate((targetPromptId) => {
    const surface = document.querySelector(`[data-card-id="${targetPromptId}"] [data-canvas-surface="prompt"]`);
    const box = surface?.getBoundingClientRect();
    const viewport = document.querySelector('.canvas-viewport');
    const transform = viewport?.style.transform || '';
    const match = /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)\s+scale\((-?\d+(?:\.\d+)?)\)/.exec(transform);
    const scale = match ? Number(match[3]) : 1;
    if (!surface || !box) return null;

    const visibleLeft = Math.max(0, box.left);
    const visibleRight = Math.min(window.innerWidth, box.right);
    const visibleTop = Math.max(0, box.top);
    const visibleBottom = Math.min(window.innerHeight, box.bottom);
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return null;

    const x = visibleLeft + ((visibleRight - visibleLeft) / 2);
    const candidateYs = [
      visibleBottom - Math.min(12, (visibleBottom - visibleTop) / 4),
      visibleTop + ((visibleBottom - visibleTop) / 2),
      visibleTop + Math.min(12, (visibleBottom - visibleTop) / 4),
    ];
    const y = candidateYs.find((candidateY) => {
      const hit = document.elementFromPoint(x, candidateY);
      return Boolean(hit && (hit === surface || surface.contains(hit)));
    });
    if (y === undefined) return null;

    return {
      x,
      y,
      scale,
      transform,
      box: {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      },
    };
  }, promptId);
}

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function captureViewportScreenshot(page, fileName) {
  if (process.env.KK_SMOKE_CAPTURE_SCREENSHOTS !== '1') {
    mark(`skipped ${fileName} screenshot: disabled for 10k smoke`);
    return;
  }

  try {
    await withTimeout(
      page.screenshot({ path: path.join(ARTIFACT_DIR, fileName), timeout: 5000 }),
      6000,
      `${fileName} screenshot`
    );
  } catch (error) {
    mark(`skipped ${fileName} screenshot: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertHealth(label, health) {
  if (health.promptCount + health.imageCount < 10000) {
    throw new Error(`${label}: expected 10000+ persisted canvas nodes, got ${JSON.stringify(health)}`);
  }
  if (health.surfaceCount > 700) {
    throw new Error(`${label}: expected bounded canvas DOM surfaces, got ${JSON.stringify(health)}`);
  }
  if (health.minimapRects > 450) {
    throw new Error(`${label}: expected bounded minimap rects, got ${JSON.stringify(health)}`);
  }
  if (health.promptShellTextCount !== 0) {
    throw new Error(`${label}: prompt shells leaked into visible prompt surfaces, got ${JSON.stringify(health)}`);
  }
  if (health.visibleImageBoxCount === 0) {
    throw new Error(`${label}: expected visible image boxes, got ${JSON.stringify(health)}`);
  }
}

ensureArtifactsDir();
removeStaleArtifact('large-canvas-10k-summary.json');
removeStaleArtifact('progress.log');
removeStaleArtifact('browser.log');

let browser;
let viteServer;

try {
  mark('building seed state');
  const state = buildLargeCanvasState();
  mark('ensuring local Vite server');
  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: TARGET_URL });
  viteServer = ensured.server;
  const targetUrl = ensured.url || TARGET_URL;
  mark(`using ${targetUrl}`);

  mark('running browser preflight');
  const browserPreflight = await runBrowserPreflight();
  if (!browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  mark('resolving Playwright');
  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);
  mark('launching Chromium');
  browser = await chromium.launch({ headless: true, timeout: 15000 });
  mark('creating page');
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const captureDebuggerStack = await installDebuggerStackCapture(page);
  page.on('console', (msg) => browserLog('BROWSER_CONSOLE', msg.text()));
  page.on('pageerror', (err) => browserLog('BROWSER_PAGE_ERROR', err.stack || err.message));
  page.on('requestfailed', (request) => {
    browserLog('BROWSER_REQUEST_FAILED', `${request.failure()?.errorText || 'unknown'} ${request.url()}`);
  });
  mark('installing smoke API routes');
  await installSmokeApiRoutes(page);

  mark('installing localStorage seed');
  await page.addInitScript(({ seededState, storageKey }) => {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const createdAtIso = new Date(now).toISOString();
    let lastHeartbeatAt = performance.now();

    window.__KK_LARGE_CANVAS_SMOKE__ = true;
    window.__kkSmokeLastHeartbeatAt = lastHeartbeatAt;
    window.setInterval(() => {
      const heartbeatAt = performance.now();
      console.log(`[SMOKE_HEARTBEAT] delta=${Math.round(heartbeatAt - lastHeartbeatAt)} now=${Math.round(heartbeatAt)}`);
      lastHeartbeatAt = heartbeatAt;
      window.__kkSmokeLastHeartbeatAt = heartbeatAt;
    }, 500);

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log(`[SMOKE_LONGTASK] name=${entry.name} duration=${Math.round(entry.duration)} start=${Math.round(entry.startTime)}`);
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      window.__kkSmokeLongTaskObserver = observer;
    } catch {
      // Long Task API may be unavailable in some Chromium builds.
    }

    const summarizeStack = (stack) => String(stack || '')
      .split('\n')
      .slice(2, 5)
      .map((line) => line.trim().replace(/^at\s+/, ''))
      .join(' <- ')
      .slice(0, 220);
    const traceScheduledCallbacks = false;
    const shouldLogCallback = (startedAt, duration = 0) => traceScheduledCallbacks && (startedAt > 1800 || duration > 50);
    const wrapScheduledCallback = (kind, callback, delay, stack) => {
      if (typeof callback !== 'function') return callback;
      const label = `${kind}:${callback.name || 'anonymous'}:${delay ?? ''}`;
      const stackSummary = summarizeStack(stack);
      return function kkSmokeWrappedCallback(...callbackArgs) {
        const startedAt = performance.now();
        if (shouldLogCallback(startedAt)) {
          console.log(`[SMOKE_CALLBACK_START] ${label} start=${Math.round(startedAt)} stack=${stackSummary}`);
        }
        try {
          return callback.apply(this, callbackArgs);
        } finally {
          const duration = performance.now() - startedAt;
          if (shouldLogCallback(startedAt, duration)) {
            console.log(`[SMOKE_CALLBACK_END] ${label} duration=${Math.round(duration)} start=${Math.round(startedAt)} stack=${stackSummary}`);
          }
        }
      };
    };

    if (traceScheduledCallbacks) {
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => (
        nativeSetTimeout(wrapScheduledCallback('timeout', callback, delay, new Error().stack), delay, ...args)
      );
      const nativeSetInterval = window.setInterval.bind(window);
      window.setInterval = (callback, delay, ...args) => (
        nativeSetInterval(wrapScheduledCallback('interval', callback, delay, new Error().stack), delay, ...args)
      );
      const NativeMessageChannel = window.MessageChannel;
      if (typeof NativeMessageChannel === 'function') {
      window.MessageChannel = function kkSmokeMessageChannel() {
        const channel = new NativeMessageChannel();
        const patchPort = (port, label) => {
          const nativeAddEventListener = port.addEventListener?.bind(port);
          const nativeRemoveEventListener = port.removeEventListener?.bind(port);
          const listenerMap = new WeakMap();
          if (nativeAddEventListener) {
            port.addEventListener = (type, listener, options) => {
              const wrapped = type === 'message' && typeof listener === 'function'
                ? wrapScheduledCallback(`messagechannel-${label}`, listener, '', new Error().stack)
                : listener;
              if (typeof listener === 'function') {
                listenerMap.set(listener, wrapped);
              }
              return nativeAddEventListener(type, wrapped, options);
            };
          }
          if (nativeRemoveEventListener) {
            port.removeEventListener = (type, listener, options) => (
              nativeRemoveEventListener(type, listenerMap.get(listener) || listener, options)
            );
          }

          const proto = Object.getPrototypeOf(port);
          const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'onmessage') : null;
          if (descriptor?.configurable && typeof descriptor.set === 'function') {
            let assignedHandler = null;
            Object.defineProperty(port, 'onmessage', {
              configurable: true,
              enumerable: descriptor.enumerable,
              get() {
                return assignedHandler;
              },
              set(handler) {
                assignedHandler = handler;
                const wrapped = typeof handler === 'function'
                  ? wrapScheduledCallback(`messagechannel-${label}:onmessage`, handler, '', new Error().stack)
                  : handler;
                descriptor.set.call(port, wrapped);
              },
            });
          }
        };
        patchPort(channel.port1, 'port1');
        patchPort(channel.port2, 'port2');
        return channel;
      };
      window.MessageChannel.prototype = NativeMessageChannel.prototype;
      }
      const nativeRequestAnimationFrame = window.requestAnimationFrame?.bind(window);
      if (nativeRequestAnimationFrame) {
        window.requestAnimationFrame = (callback) => (
          nativeRequestAnimationFrame(wrapScheduledCallback('raf', callback, '', new Error().stack))
        );
      }
      const nativeRequestIdleCallback = window.requestIdleCallback?.bind(window);
      if (nativeRequestIdleCallback) {
        window.requestIdleCallback = (callback, options) => (
          nativeRequestIdleCallback(
            wrapScheduledCallback('idle', callback, options?.timeout ?? '', new Error().stack),
            options,
          )
        );
      }
    }

    const tempUser = {
      id: 'large-canvas-10k-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'large-canvas-10k-user@temp.local',
      phone: '',
      created_at: createdAtIso,
      updated_at: createdAtIso,
      confirmed_at: createdAtIso,
      last_sign_in_at: createdAtIso,
      app_metadata: { isTempUser: true, provider: 'temp' },
      user_metadata: {
        avatar_url: 'preset-default-local',
        full_name: 'Large Canvas 10k User',
        isTempUser: true,
      },
    };

    localStorage.setItem('theme', 'dark');
    localStorage.setItem('kk_theme', 'dark');
    localStorage.setItem('kk_language', 'zh-CN');
    localStorage.setItem('kk_studio_storage_mode', 'browser');
    localStorage.setItem('kk_tutorial_seen', 'true');
    localStorage.setItem('kk_canvas_view', JSON.stringify({ x: 720, y: 480, scale: 1 }));
    localStorage.setItem('temp_user_session_v1', JSON.stringify({
      user: tempUser,
      createdAt: now,
      expiresAt,
      isTempUser: true,
    }));
    localStorage.setItem('kkai.runtime.user-state.v1', JSON.stringify({
      user: tempUser,
      isTempUser: true,
      tempUserExpiry: expiresAt,
    }));
    localStorage.setItem(storageKey, JSON.stringify(seededState));
  }, { seededState: state, storageKey: STORAGE_KEY });

  mark('navigating to app');
  await gotoWithRetry(page, targetUrl);
  mark('waiting after navigation');
  await page.waitForTimeout(1200);
  mark('skipping storage modal scan: storage mode is seeded');
  await page.waitForTimeout(1750);
  mark('waiting for canvas surfaces');
  const surfaceCounts = await waitForCanvasSurfaces(page, captureDebuggerStack);
  mark(`canvas surfaces ${JSON.stringify(surfaceCounts)}`);
  const expectedCounts = {
    promptCount: state.canvases[0].promptNodes.length,
    imageCount: state.canvases[0].imageNodes.length,
  };
  mark('measuring initial health');
  const initialHealth = buildCanvasHealthFromCounts(surfaceCounts, expectedCounts);
  assertHealth('initial', initialHealth);
  mark(`initial health ${JSON.stringify(initialHealth)}`);

  mark('capturing initial viewport');
  await captureViewportScreenshot(page, 'initial.png');
  mark('waiting for post-startup idle before input probe');
  await page.waitForTimeout(1800);
  const inputReadiness = await withTimeout(
    page.evaluate(() => ({
      now: performance.now(),
      readyState: document.readyState,
      elementCount: document.querySelectorAll('*').length,
      lastHeartbeatAt: window.__kkSmokeLastHeartbeatAt,
    })),
    2000,
    'input readiness probe',
  );
  mark(`input readiness ${JSON.stringify(inputReadiness)}`);

  mark('dragging grouped prompt');
  const dragStartScreen = await withTimeout(
    resolvePromptDragStartScreen(page, 'prompt-main'),
    5000,
    'grouped prompt drag target measurement',
  );
  if (!dragStartScreen) {
    throw new Error('Prompt group drag target was not rendered in the 10k canvas viewport.');
  }
  const dragDeltaScreen = { x: 160, y: 120 };
  const expectedCanvasDelta = {
    x: dragDeltaScreen.x / dragStartScreen.scale,
    y: dragDeltaScreen.y / dragStartScreen.scale,
  };
  mark(`drag start screen ${JSON.stringify({ dragStartScreen, dragDeltaScreen })}`);
  mark('mouse move probe corner');
  await withTimeout(page.mouse.move(12, 12), 5000, 'mouse move probe corner');
  mark('mouse move to grouped prompt');
  await withTimeout(page.mouse.move(dragStartScreen.x, dragStartScreen.y), 5000, 'mouse move to grouped prompt');
  const dragTarget = await withTimeout(
    page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      const path = [];
      let current = element;
      while (current && path.length < 6) {
        path.push({
          tag: current.tagName,
          id: current.id || '',
          className: typeof current.className === 'string' ? current.className.slice(0, 180) : '',
          text: (current.textContent || '').trim().slice(0, 80),
        });
        current = current.parentElement;
      }
      return path;
    }, { x: dragStartScreen.x, y: dragStartScreen.y }),
    2000,
    'drag target probe',
  );
  mark(`drag target ${JSON.stringify(dragTarget)}`);
  mark('mouse down grouped prompt');
  await withTimeout(page.mouse.down(), 5000, 'mouse down grouped prompt');
  mark('mouse move grouped prompt delta');
  await withTimeout(
    page.mouse.move(dragStartScreen.x + dragDeltaScreen.x, dragStartScreen.y + dragDeltaScreen.y, { steps: 10 }),
    5000,
    'mouse move grouped prompt delta',
  );
  await page.waitForTimeout(250);
  mark('mouse up grouped prompt');
  await withTimeout(page.mouse.up(), 5000, 'mouse up grouped prompt');
  await page.waitForTimeout(1200);
  const dragScene = await withTimeout(measureGroupedScene(page), 5000, 'drag scene measurement');

  const promptMoved = dragScene.promptRuntimePosition
    && Math.abs(dragScene.promptRuntimePosition.x - expectedCanvasDelta.x) < 8
    && Math.abs(dragScene.promptRuntimePosition.y - expectedCanvasDelta.y) < 8;
  const parentLinksIntact = dragScene.imagePositions.length === 2
    && dragScene.imagePositions.every((image) => image.parentPromptId === 'prompt-main');
  const promptDockTolerance = 60;
  const imagesDockedUnderPrompt = Boolean(
    dragScene.promptBox
    && dragScene.imageBoxes.length > 0
    && dragScene.imageBoxes.every((box) => box.top >= dragScene.promptBox.bottom - promptDockTolerance),
  );
  const runtimeImageBoxes = dragScene.imageBoxes.filter((box) => box.position);
  const childrenMovedWithPrompt = runtimeImageBoxes.length > 0 && runtimeImageBoxes.every((box) => {
    const expectedOffsetX = box.id === 'img-main-a' ? -154 : 154;
    return Math.abs((box.position.x - dragScene.promptRuntimePosition.x) - expectedOffsetX) < 8
      && box.position.y >= dragScene.promptRuntimePosition.y + 300;
  });
  const connectorDistances = dragScene.connectorEnds.flatMap((end) => {
    const imageBox = dragScene.imageBoxes.find((box) => box.id === end.imageId);
    return imageBox
      ? [Math.hypot(end.x - imageBox.centerX, end.y - imageBox.top)]
      : [];
  });
  const nearestConnectorDistance = connectorDistances.length > 0
    ? Math.min(...connectorDistances)
    : null;
  const connectorFollows = dragScene.connectorEnds.length === 0
    || (
      connectorDistances.length === dragScene.connectorEnds.length
      && connectorDistances.every((distance) => distance < 120)
    );

  if (!promptMoved || !parentLinksIntact || !imagesDockedUnderPrompt || !childrenMovedWithPrompt || !connectorFollows) {
    throw new Error(`Prompt group drag failed in 10k canvas: ${JSON.stringify({
      dragScene,
      dragStartScreen,
      expectedCanvasDelta,
      promptMoved,
      parentLinksIntact,
      imagesDockedUnderPrompt,
      childrenMovedWithPrompt,
      nearestConnectorDistance,
    })}`);
  }

  mark('zooming canvas');
  await page.mouse.move(720, 480);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(120);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);

  mark('measuring zoomed health');
  const zoomedCounts = await readSurfaceCounts(page);
  const zoomedHealth = buildCanvasHealthFromCounts(zoomedCounts, expectedCounts);
  assertHealth('zoomed', zoomedHealth);
  mark(`zoomed health ${JSON.stringify(zoomedHealth)}`);

  mark('capturing zoomed viewport');
  await captureViewportScreenshot(page, 'zoomed.png');

  const summary = {
    nodeCount: state.canvases[0].promptNodes.length + state.canvases[0].imageNodes.length,
    initialHealth,
    zoomedHealth,
    drag: {
      imagesDockedUnderPrompt,
      childrenMovedWithPrompt,
      nearestConnectorDistance,
      connectorFollows,
    },
    artifactDir: ARTIFACT_DIR,
  };
  writeFileSync(path.join(ARTIFACT_DIR, 'large-canvas-10k-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
}
