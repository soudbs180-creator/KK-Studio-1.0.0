import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

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

async function resolvePlaywrightModuleUrl() {
  const { readdir } = await import("node:fs/promises");
  const { stat } = await import("node:fs/promises");

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
    candidates.push({ modulePath, mtimeMs: stats.mtimeMs });
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (candidates.length === 0) {
    throw new Error("Playwright module was not found in the npx cache. Run `cmd /c npx playwright --version` once first.");
  }

  return `file:///${candidates[0].modulePath.replace(/\\/g, "/")}`;
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

const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
const { chromium } = await import(playwrightModuleUrl);

ensureArtifactsDir();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

try {
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
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
