import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, ".tmp-playwright", "prompt-group-drag");
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
  selectedNodeIds: [],
  subCardLayoutMode: "row",
  viewportCenter: { x: 0, y: 0 },
};

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
    || /Playwright module was not found/i.test(message)
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
  const appSource = readSource('src/App.tsx');
  const dragHookSource = readSource('src/app/usePromptGroupDragHandlers.ts');
  const promptSource = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const imageSource = readSource('src/components/image/ImageCard2.tsx');

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
  const closeButton = page.getByRole("button", { name: /关闭设置|关闭/ }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(800);
  }
}

async function measureScene(page) {
  return page.evaluate(() => {
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
}

ensureArtifactsDir();

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
  await dismissSettingsPanelIfPresent(page);

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
  await page.waitForTimeout(180);
  const mainDragScene = await measureScene(page);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "main-drag.png"),
    fullPage: true,
  });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const mainDragSpread = computeSpread(mainDragScene.imageBoxes);
  const promptBottomDuringMainDrag = mainDragScene.promptBox?.bottom ?? 0;
  const imagesDockedUnderPrompt = mainDragScene.imageBoxes.every((box) => box.top > promptBottomDuringMainDrag - 20);
  const mainDragGrouped = mainDragSpread.ySpread < 90 && imagesDockedUnderPrompt;

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
  if (isBrowserLaunchUnavailable(error)) {
    await runFallbackVerification(error, browserPreflight);
  } else {
    throw error;
  }
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
}
