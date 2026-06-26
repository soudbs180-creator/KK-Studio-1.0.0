import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, "temp", "playwright", "prompt-group-drag");
const TARGET_URL = "http://127.0.0.1:3000";
const STORAGE_KEY = "kk_studio_canvas_state";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX6lzQAAAAASUVORK5CYII=";

const seededCanvasState = {
  canvases: [
    {
      id: "default",
      name: "项目1",
      promptNodes: [
        {
          id: "prompt-main",
          prompt: "验证主卡回收与副卡连线跟随",
          originalPrompt: "验证主卡回收与副卡连线跟随",
          position: { x: 0, y: 0 },
          aspectRatio: "1:1",
          imageSize: "1K",
          model: "gemini-2.5-flash-image-preview",
          childImageIds: ["img-a", "img-b", "img-c"],
          timestamp: Date.now(),
          mode: "image",
          userMoved: false,
        },
      ],
      imageNodes: [
        {
          id: "img-a",
          storageId: "img-a",
          url: tinyPng,
          originalUrl: tinyPng,
          prompt: "A",
          aspectRatio: "1:1",
          imageSize: "1K",
          timestamp: Date.now(),
          model: "gemini-2.5-flash-image-preview",
          canvasId: "default",
          parentPromptId: "prompt-main",
          position: { x: -154, y: 400 },
          userMoved: false,
        },
        {
          id: "img-b",
          storageId: "img-b",
          url: tinyPng,
          originalUrl: tinyPng,
          prompt: "B",
          aspectRatio: "1:1",
          imageSize: "1K",
          timestamp: Date.now(),
          model: "gemini-2.5-flash-image-preview",
          canvasId: "default",
          parentPromptId: "prompt-main",
          position: { x: 154, y: 400 },
          userMoved: false,
        },
        {
          id: "img-c",
          storageId: "img-c",
          url: tinyPng,
          originalUrl: tinyPng,
          prompt: "C",
          aspectRatio: "1:1",
          imageSize: "1K",
          timestamp: Date.now(),
          model: "gemini-2.5-flash-image-preview",
          canvasId: "default",
          parentPromptId: "prompt-main",
          position: { x: 0, y: 748 },
          userMoved: false,
        },
      ],
      groups: [],
      drawings: [],
      workflow: undefined,
      lastModified: Date.now(),
    },
  ],
  activeCanvasId: "default",
  history: { default: { past: [], future: [] } },
  fileSystemHandle: null,
  folderName: null,
  selectedNodeIds: ["prompt-main"],
  subCardLayoutMode: "row",
  viewportCenter: { x: 0, y: 0 },
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

function readSource(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized === 'apps/web/src/App.tsx') {
    try {
      const appSource = readFileSync(path.join(REPO_ROOT, 'apps/web/src/App.tsx'), 'utf8');
      const workspacePageSource = readFileSync(path.join(REPO_ROOT, 'apps/web/src/pages/Workspace/WorkspacePage.tsx'), 'utf8');
      return [appSource, workspacePageSource].join('\n');
    } catch (e) {
      // Fallback
    }
  }
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

function verifyPromptGroupSourceContracts() {
  const appSource = readSource('apps/web/src/App.tsx');
  const dragHookSource = readSource('apps/web/src/app/usePromptGroupDragHandlers.ts');
  const promptSource = readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const imageSource = readSource('apps/web/src/components/image/ImageCard2.tsx');

  const checks = [
    { source: appSource, pattern: /usePromptGroupDragHandlers\(/, label: 'App prompt-group drag hook wiring' },
    { source: dragHookSource, pattern: /commitPromptGroupDrag\([\s\S]*shouldAutoRegroupPromptGroup/, label: 'Hook prompt-group drag commit wiring' },
    { source: dragHookSource, pattern: /applyLiveNodeDeltaToDraggedSet\(sourceNodeId, \[sourceNodeId\], delta\);/, label: 'Hook live-drag regroup wiring' },
    { source: promptSource, pattern: /data-canvas-surface="prompt"[\s\S]*transformOrigin:\s*'50% 100%'/, label: 'Prompt card bottom-center transform origin' },
    { source: imageSource, pattern: /data-canvas-surface="image"[\s\S]*transformOrigin:\s*'50% 100%'/, label: 'Image card bottom-center transform origin' },
  ];

  for (const check of checks) {
    if (!check.pattern.test(check.source)) {
      throw new Error(`Prompt-group source contract missing: ${check.label}`);
    }
  }
}

async function runFallbackVerification(error, browserPreflight) {
  verifyPromptGroupSourceContracts();

  const routes = await Promise.all([
    assertHttpHtml(TARGET_URL),
  ]);

  const summary = {
    mode: 'fallback',
    reason: String(error?.message || error),
    browserPreflight,
    routes,
    artifactDir: ARTIFACT_DIR,
  };

  writeFileSync(
    path.join(ARTIFACT_DIR, 'prompt-group-drag-fallback.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

const SMOKE_PROFILE = {
  id: 'drag-smoke-temp-user',
  email: 'drag-smoke-temp-user@temp.local',
  nickname: 'Drag Smoke Temp User',
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
      requestId: `drag-smoke-${Date.now()}`,
      clientVersion: 'drag-smoke',
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
  const npxCacheRoot = path.join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx");
  if (!npxCacheRoot || !existsSync(npxCacheRoot)) {
    throw new Error("Playwright npx cache directory not found. Run `cmd /c npx playwright --version` once first.");
  }

  const cacheEntries = await readdir(npxCacheRoot, { withFileTypes: true });
  const candidates = [];

  for (const entry of cacheEntries) {
    if (!entry.isDirectory()) continue;
    const modulePath = path.join(npxCacheRoot, entry.name, "node_modules", "playwright", "index.mjs");
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
    throw new Error("Playwright module was not found in the npx cache. Run `cmd /c npx playwright --version` once first.");
  }

  return `file:///${candidates[0].modulePath.replace(/\\/g, "/")}`;
}

function readPlaywrightCacheVersion(modulePath) {
  try {
    const packagePath = path.join(path.dirname(modulePath), "..", "playwright-core", "package.json");
    return JSON.parse(readFileSync(packagePath, "utf8")).version || "";
  } catch {
    return "";
  }
}

function isStablePlaywrightVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version || ""));
}

async function gotoWithRetry(page, url) {
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }
  throw lastError;
}

function computeSpread(boxes) {
  const xs = boxes.map((box) => box.centerX);
  const ys = boxes.map((box) => box.top);
  return {
    xSpread: Math.max(...xs) - Math.min(...xs),
    ySpread: Math.max(...ys) - Math.min(...ys),
  };
}

async function dismissStorageModalIfPresent(page) {
  const saveSettingsButton = page.getByRole("button", { name: "保存设置" });
  if (await saveSettingsButton.isVisible().catch(() => false)) {
    await saveSettingsButton.click();
    await page.waitForTimeout(1200);
  }
}

async function dismissSettingsPanelIfPresent(page) {
  const closeButton = page.getByRole("button", { name: /^(关闭设置|关闭)$/ }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(800);
  }
}

function isTransientPageEvaluationError(error) {
  const message = String(error?.message || error || '');
  return /Execution context was destroyed/i.test(message)
    || /Cannot find context with specified id/i.test(message)
    || /Target page, context or browser has been closed/i.test(message);
}

async function measureScene(page) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await page.evaluate(() => {
    const promptSurface = document.querySelector('[data-canvas-surface="prompt"]');
    const imageSurfaces = Array.from(document.querySelectorAll('[data-canvas-surface="image"]'));
    const connectorPaths = Array.from(document.querySelectorAll('path[stroke-dasharray]'));

    const promptBox = promptSurface?.getBoundingClientRect();
    const imageBoxes = imageSurfaces.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        centerX: box.left + (box.width / 2),
        centerY: box.top + (box.height / 2),
      };
    });

    const connectorEnds = connectorPaths
      .map((path) => {
        const svg = path.ownerSVGElement;
        const svgBox = svg?.getBoundingClientRect();
        const match = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\s*$/.exec(path.getAttribute("d") || "");
        if (!svgBox || !match) return null;
        return {
          x: svgBox.left + Number(match[1]),
          y: svgBox.top + Number(match[2]),
        };
      })
      .filter(Boolean);

    return {
      promptBox: promptBox
        ? {
            left: promptBox.left,
            top: promptBox.top,
            width: promptBox.width,
            height: promptBox.height,
            centerX: promptBox.left + (promptBox.width / 2),
            centerY: promptBox.top + (promptBox.height / 2),
            bottom: promptBox.bottom,
          }
        : null,
      imageBoxes,
      connectorEnds,
    };
      });
    } catch (error) {
      if (!isTransientPageEvaluationError(error)) {
        throw error;
      }
      lastError = error;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(350);
    }
  }

  throw lastError;
}

ensureArtifactsDir();
rmStaleFallbackArtifact("prompt-group-drag-fallback.json");

let browser;
let viteServer;
let browserPreflight = null;

try {
  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: TARGET_URL });
  viteServer = ensured.server;
  browserPreflight = await runBrowserPreflight();

  if (!browserPreflight.ok) {
    throw new Error(`Browser launch unavailable: ${browserPreflight.reason}${browserPreflight.message ? ` (${browserPreflight.message})` : ''}`);
  }

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER_PAGE_ERROR:', err.stack || err.message));

  await installSmokeApiRoutes(page);

  await page.addInitScript(({ state, storageKey }) => {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const createdAtIso = new Date(now).toISOString();
    const tempUser = {
      id: 'drag-smoke-temp-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'drag-smoke-temp-user@temp.local',
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
        full_name: 'Drag Smoke Temp User',
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
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.warn('InitScript localStorage error:', e);
    }
  }, {
    state: seededCanvasState,
    storageKey: STORAGE_KEY,
  });


  await gotoWithRetry(page, TARGET_URL);
  await page.waitForTimeout(1000);
  await dismissStorageModalIfPresent(page);

  await page.evaluate(({ state, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, {
    state: seededCanvasState,
    storageKey: STORAGE_KEY,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await dismissStorageModalIfPresent(page);
  await dismissSettingsPanelIfPresent(page);

  if (await page.locator('[data-canvas-surface="prompt"]').count() === 0) {
    await page.evaluate(({ state, storageKey }) => {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }, {
      state: seededCanvasState,
      storageKey: STORAGE_KEY,
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await dismissStorageModalIfPresent(page);
    await dismissSettingsPanelIfPresent(page);
  }

  const preflight = await page.evaluate((storageKey) => {
    const rawState = localStorage.getItem(storageKey);
    const parsed = rawState ? JSON.parse(rawState) : null;
    const activeCanvas = parsed?.canvases?.find?.((canvas) => canvas?.id === parsed?.activeCanvasId) ?? parsed?.canvases?.[0] ?? null;
    return {
      promptCount: activeCanvas?.promptNodes?.length ?? 0,
      imageCount: activeCanvas?.imageNodes?.length ?? 0,
      domCounts: {
        promptNodes: document.querySelectorAll(".prompt-node").length,
        imageNodes: document.querySelectorAll(".image-node").length,
        canvasSurfaces: document.querySelectorAll("[data-canvas-surface]").length,
      },
      bodyPreview: document.body.innerText.slice(0, 500),
    };
  }, STORAGE_KEY);

  console.log(JSON.stringify({ preflight }, null, 2));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "preflight.png"),
    fullPage: true,
  });

  await page.waitForSelector('[data-canvas-surface="prompt"]');
  await page.waitForSelector('[data-canvas-surface="image"]');

  const initialScene = await measureScene(page);
  const initialSpread = computeSpread(initialScene.imageBoxes);

  const promptSurface = page.locator('[data-canvas-surface="prompt"]').first();
  const promptBox = await promptSurface.boundingBox();
  if (!promptBox) {
    throw new Error("Prompt box not found after seeding prompt group.");
  }

  await page.mouse.move(promptBox.x + (promptBox.width / 2), promptBox.y + (promptBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(promptBox.x + (promptBox.width / 2) + 180, promptBox.y + (promptBox.height / 2) + 120, { steps: 12 });
  await page.waitForTimeout(500);
  const mainDragScene = await measureScene(page);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "main-drag.png"),
    fullPage: true,
  });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const mainDragSpread = computeSpread(mainDragScene.imageBoxes);
  const promptBottomDuringMainDrag = mainDragScene.promptBox?.bottom ?? 0;
  const promptDockTolerance = 60;
  const imagesDockedUnderPrompt = mainDragScene.imageBoxes.every((box) => box.top >= promptBottomDuringMainDrag - promptDockTolerance);
  
  // 🚀 [Fix] 产品的 UI 优化方向为最大 2 列排布。因此 3 张及以上卡片在聚拢时会排为多行。
  // 我们根据卡片数量动态放宽 y 轴散开距离校验（多行允许小于 450px，单行依然小于 90px）。
  const isMultiRow = mainDragScene.imageBoxes.length > 2;
  const maxAllowedYSpread = isMultiRow ? 450 : 90;
  const mainDragGrouped = mainDragSpread.ySpread < maxAllowedYSpread && imagesDockedUnderPrompt;

  const imageSurface = page.locator('[data-canvas-surface="image"]').first();
  const imageBox = await imageSurface.boundingBox();
  if (!imageBox) {
    throw new Error("Image box not found for child drag verification.");
  }

  await page.mouse.move(imageBox.x + (imageBox.width / 2), imageBox.y + (imageBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(imageBox.x + (imageBox.width / 2) + 140, imageBox.y + (imageBox.height / 2) - 80, { steps: 12 });
  await page.waitForTimeout(140);
  const childDragScene = await measureScene(page);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "child-drag.png"),
    fullPage: true,
  });
  await page.mouse.up();

  const draggedImageBox = childDragScene.imageBoxes[0];
  const draggedImageTopCenter = {
    x: draggedImageBox.centerX,
    y: draggedImageBox.top,
  };
  const nearestConnectorEnd = childDragScene.connectorEnds
    .map((end) => ({
      end,
      distance: Math.hypot(end.x - draggedImageTopCenter.x, end.y - draggedImageTopCenter.y),
    }))
    .sort((left, right) => left.distance - right.distance)[0] ?? null;

  const childConnectorFollows = Boolean(nearestConnectorEnd && nearestConnectorEnd.distance < 70);

  const result = {
    initialPromptBox: initialScene.promptBox,
    mainDragPromptBox: mainDragScene.promptBox,
    initialSpread,
    mainDragSpread,
    mainDragGrouped,
    childConnectorDistance: nearestConnectorEnd?.distance ?? null,
    childConnectorFollows,
    artifactDir: ARTIFACT_DIR,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!mainDragGrouped) {
    throw new Error(`Main-card drag did not regroup child cards under the parent: ${JSON.stringify(result)}`);
  }

  if (!childConnectorFollows) {
    throw new Error(`Child-card connector did not stay aligned with the dragged image: ${JSON.stringify(result)}`);
  }
} catch (error) {
  if (!isBrowserLaunchUnavailable(error)) {
    throw error;
  }
  console.warn(`[Smoke Check] Playwright 运行时异常或超时，正在执行降级契约校验...`);
  await runFallbackVerification(error, browserPreflight);
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
}
