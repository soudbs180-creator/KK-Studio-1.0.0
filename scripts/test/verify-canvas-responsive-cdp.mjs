import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  ensureLocalViteServer,
  closeLocalViteServer,
} from "./ensure-local-vite-server.mjs";
import { runBrowserPreflight } from "./browser-preflight.mjs";

const repoRoot = process.cwd();
const stress10k = process.env.KK_CANVAS_CDP_10K === "1";
const artifactDir = path.join(
  repoRoot,
  "temp",
  "playwright",
  stress10k ? "canvas-10k-cdp" : "canvas-responsive-cdp",
);
const profileDir = path.join(artifactDir, "chrome-profile");
const port = 9337;
const targetUrl = "http://127.0.0.1:3000";
const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX6lzQAAAAASUVORK5CYII=";

const responsiveViewportCases = [
  { width: 1440, height: 900, surface: "canvas" },
  { width: 1280, height: 720, surface: "canvas" },
  { width: 1024, height: 720, surface: "canvas" },
  { width: 1180, height: 820, surface: "canvas" },
  { width: 1023, height: 720, surface: "canvas" },
  { width: 834, height: 1112, surface: "results" },
  { width: 768, height: 1024, surface: "results" },
  { width: 430, height: 932, surface: "results" },
  { width: 390, height: 844, surface: "results" },
  { width: 375, height: 812, surface: "results" },
];

function createCanvasState() {
  if (!stress10k)
    return {
      canvases: [
        {
          id: "default",
          name: "Responsive V2",
          presentationVersion: 2,
          promptNodes: [
            {
              id: "prompt-responsive",
              prompt: "Responsive canvas card",
              position: { x: 0, y: 200 },
              height: 180,
              aspectRatio: "1:1",
              imageSize: "1K",
              model: "gemini-2.5-flash-image",
              childImageIds: ["image-responsive"],
              timestamp: 1,
              presentation: {
                kind: "prompt-result-group",
                layoutMode: "column",
                size: "standard",
              },
            },
          ],
          imageNodes: [
            {
              id: "image-responsive",
              url: tinyPng,
              prompt: "Responsive result",
              position: { x: 0, y: 560 },
              aspectRatio: "1:1",
              model: "gemini-2.5-flash-image",
              parentPromptId: "prompt-responsive",
              canvasId: "default",
              timestamp: 2,
              presentation: {
                kind: "media-only",
                layoutMode: "column",
                size: "standard",
              },
            },
          ],
          noteNodes: [],
          groups: [],
          drawings: [],
          lastModified: 2,
        },
      ],
      activeCanvasId: "default",
      selectedNodeIds: [],
      history: {},
      fileSystemHandle: null,
      folderName: null,
    };

  const promptNodes = [];
  const imageNodes = [];
  for (let groupIndex = 0; groupIndex < 100; groupIndex += 1) {
    const groupColumn = groupIndex % 10;
    const groupRow = Math.floor(groupIndex / 10);
    const originX = groupColumn * 4200;
    const originY = groupRow * 3600 + 200;
    const childImageIds = [];
    for (let childIndex = 0; childIndex < 99; childIndex += 1) {
      const id = `image-stress-${groupIndex}-${childIndex}`;
      childImageIds.push(id);
      imageNodes.push({
        id,
        url: "data:,",
        position: {
          x: originX + (childIndex % 11) * 300,
          y: originY + 360 + Math.floor(childIndex / 11) * 300,
        },
        parentPromptId: `prompt-stress-${groupIndex}`,
        canvasId: "default",
      });
    }
    promptNodes.push({
      id: `prompt-stress-${groupIndex}`,
      prompt: `10k canvas group ${groupIndex + 1}`,
      position: { x: originX, y: originY },
      childImageIds,
      timestamp: groupIndex * 100 + 1,
    });
  }

  return {
    canvases: [
      {
        id: "default",
        name: "10k Virtualized Canvas",
        presentationVersion: 2,
        promptNodes,
        imageNodes,
        noteNodes: [],
        groups: [],
        drawings: [],
        lastModified: 10000,
      },
    ],
    activeCanvasId: "default",
    selectedNodeIds: [],
    history: {},
    fileSystemHandle: null,
    folderName: null,
  };
}

const viewportCases = stress10k
  ? [{ width: 1440, height: 900, surface: "canvas" }]
  : responsiveViewportCases;
const seedState = createCanvasState();
const seededCanvas = seedState.canvases[0];
const sceneNodeCount =
  seededCanvas.promptNodes.length +
  seededCanvas.imageNodes.length +
  seededCanvas.noteNodes.length;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const handlers = pending.get(message.id);
    if (!handlers) return;
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.text || "Runtime evaluation failed",
    );
  return result.result.value;
}

async function clickMobileTab(cdp, label) {
  return evaluate(
    cdp,
    `(() => {
      const label = ${JSON.stringify(label)};
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => (
          candidate.getAttribute('aria-label') === label
          || candidate.textContent?.trim() === label
        ));
      button?.click();
      return !!button;
    })()`,
  );
}

async function measureMobileCanvasCard(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const surface = document.querySelector('[data-testid="mobile-canvas-v3"]');
      const card = document.querySelector('.kk-mobile-canvas-card');
      const rect = card?.getBoundingClientRect();
      return {
        surface: !!surface,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        card: rect ? {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        } : null,
      };
    })()`,
  );
}

async function dispatchMobileTouchDrag(cdp, start, movement) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: start.x + movement.x, y: start.y + movement.y, id: 1 }],
  });
}

async function verifyMobileCanvasDrag(cdp, viewport) {
  if (!await clickMobileTab(cdp, "画布")) {
    throw new Error(`${viewport.width}x${viewport.height} mobile canvas tab is unavailable`);
  }
  await wait(500);
  const initial = await measureMobileCanvasCard(cdp);
  if (!initial.surface || !initial.card) {
    throw new Error(`${viewport.width}x${viewport.height} mobile canvas rendered no card`);
  }

  const start = { x: initial.card.centerX, y: initial.card.centerY };
  const movement = { x: 72, y: 44 };
  await dispatchMobileTouchDrag(cdp, start, movement);
  await wait(120);
  const during = await measureMobileCanvasCard(cdp);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(180);
  const released = await measureMobileCanvasCard(cdp);
  await wait(350);
  const settled = await measureMobileCanvasCard(cdp);
  const pointerError = {
    x: Math.abs((during.card?.centerX || 0) - initial.card.centerX - movement.x),
    y: Math.abs((during.card?.centerY || 0) - initial.card.centerY - movement.y),
  };
  const settledPositionError = {
    x: Math.abs((settled.card?.centerX || 0) - initial.card.centerX - movement.x),
    y: Math.abs((settled.card?.centerY || 0) - initial.card.centerY - movement.y),
  };
  const postReleaseDrift = Math.hypot(
    (settled.card?.centerX || 0) - (released.card?.centerX || 0),
    (settled.card?.centerY || 0) - (released.card?.centerY || 0),
  );
  await clickMobileTab(cdp, "创作");
  await wait(250);
  return {
    initial,
    during,
    settled,
    pointerError,
    settledPositionError,
    postReleaseDrift,
  };
}

mkdirSync(artifactDir, { recursive: true });
if (existsSync(profileDir))
  rmSync(profileDir, { recursive: true, force: true });

const server = await ensureLocalViteServer({ root: repoRoot, url: targetUrl });
const preflight = await runBrowserPreflight();
if (!preflight.ok || !preflight.executablePath)
  throw new Error(`Browser unavailable: ${preflight.reason}`);

const chrome = spawn(
  preflight.executablePath,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let cdp;
try {
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: "PUT",
  }).then((response) => response.json());
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const now = Date.now();
      const user = {
        id: 'canvas-responsive-user', aud: 'authenticated', role: 'authenticated',
        email: 'canvas-responsive@temp.local', created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(), app_metadata: { isTempUser: true },
        user_metadata: { full_name: 'Canvas Responsive User', isTempUser: true }
      };
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('kk_theme', 'dark');
      localStorage.setItem('kk_language', 'zh-CN');
      localStorage.setItem('kk_studio_storage_mode', 'browser');
      localStorage.setItem('kk_tutorial_seen', 'true');
      localStorage.setItem('temp_user_session_v1', JSON.stringify({ user, createdAt: now, expiresAt: now + 86400000, isTempUser: true }));
      localStorage.setItem('kkai.runtime.user-state.v1', JSON.stringify({ user, isTempUser: true, tempUserExpiry: now + 86400000 }));
      localStorage.setItem('kk_studio_canvas_state', ${JSON.stringify(JSON.stringify(seedState))});
      localStorage.setItem('kk_canvas_view:default:desktop', JSON.stringify({ x: 720, y: 460, scale: 1 }));
      localStorage.setItem('kk_canvas_view:default:tablet-landscape', JSON.stringify({ x: 510, y: 400, scale: 0.85 }));
    })();`,
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: targetUrl });

  const documentStartedAt = Date.now();
  while (Date.now() - documentStartedAt < 10000) {
    if (await evaluate(cdp, `document.readyState === 'complete'`)) break;
    await wait(100);
  }
  await wait(1200);
  if (await evaluate(cdp, `!!document.querySelector('.kk-landing-root')`)) {
    await evaluate(
      cdp,
      `document.querySelector('.kk-landing-nav__login')?.click()`,
    );
    const modalStartedAt = Date.now();
    while (Date.now() - modalStartedAt < 5000) {
      if (await evaluate(cdp, `!!document.querySelector('.auth-social-row')`))
        break;
      await wait(100);
    }
    await evaluate(
      cdp,
      `document.querySelector('.auth-social-row .auth-social-btn:last-child')?.click()`,
    );
  }

  const readyStartedAt = Date.now();
  while (Date.now() - readyStartedAt < 25000) {
    const ready = await evaluate(
      cdp,
      `!!localStorage.getItem('temp_user_session_v1') && document.readyState === 'complete' && (!!document.querySelector('.canvas-container') || !!document.querySelector('[data-testid="mobile-app-shell"]'))`,
    );
    if (ready) break;
    await wait(200);
  }
  await wait(1200);
  const readyDurationMs = Date.now() - readyStartedAt;

  const results = [];
  for (const viewport of viewportCases) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width <= 1023,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    await wait(500);
    if (viewport.surface === "canvas") {
      await evaluate(
        cdp,
        `(() => {
          const card = document.querySelector('[data-card-kind]');
          const rect = card?.getBoundingClientRect();
          if (!card || !rect) return false;
          card.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 2,
            buttons: 2,
          }));
          card.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 2,
          }));
          return true;
        })()`,
      );
      await wait(100);
    }
    const metrics = await evaluate(
      cdp,
      `(() => {
      const canvas = document.querySelector('.canvas-container');
      const mobileShell = document.querySelector('[data-testid="mobile-app-shell"]');
      const composer = document.querySelector('#prompt-bar-container[data-composer-layout="desktop"]');
      const rail = document.getElementById('project-manager-container');
      const selectionToolbar = document.querySelector('.kk-canvas-selection-menu[data-placement]');
      const composerRect = composer?.getBoundingClientRect();
      const railRect = rail?.getBoundingClientRect();
      const selectionToolbarRect = selectionToolbar?.getBoundingClientRect();
      const cardRects = [...document.querySelectorAll('[data-card-kind]')]
        .map((card) => card.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const rectsOverlap = (first, second) => !(
        first.right <= second.left
        || first.left >= second.right
        || first.bottom <= second.top
        || first.top >= second.bottom
      );
      return {
        url: location.href,
        title: document.title,
        bodyText: document.body.innerText.slice(0, 240),
        authReady: !!localStorage.getItem('temp_user_session_v1'),
        canvasSeeded: !!localStorage.getItem('kk_studio_canvas_state'),
        seededNodeCount: (() => {
          try {
            const state = JSON.parse(localStorage.getItem('kk_studio_canvas_state') || '{}');
            const seededCanvas = state.canvases?.[0];
            return (seededCanvas?.promptNodes?.length || 0) + (seededCanvas?.imageNodes?.length || 0) + (seededCanvas?.noteNodes?.length || 0);
          } catch {
            return 0;
          }
        })(),
        canvas: !!canvas,
        mobileShell: !!mobileShell,
        composerHeight: composerRect?.height || 0,
        railWidth: railRect?.width || 0,
        cardCount: document.querySelectorAll('[data-card-kind]').length,
        selectionToolbarVisible: !!selectionToolbarRect,
        selectionToolbarOverflow: !!selectionToolbarRect && (
          selectionToolbarRect.left < 0
          || selectionToolbarRect.right > window.innerWidth
          || selectionToolbarRect.top < 48
          || selectionToolbarRect.bottom > window.innerHeight
        ),
        selectionToolbarCardOverlap: !!selectionToolbarRect
          && cardRects.some((cardRect) => rectsOverlap(selectionToolbarRect, cardRect)),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        chromeOverlap: !!(composerRect && railRect && composerRect.left < railRect.right && composerRect.right > railRect.left && composerRect.top < railRect.bottom && composerRect.bottom > railRect.top),
      };
    })()`,
    );
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const screenshotPath = path.join(
      artifactDir,
      `${viewport.width}x${viewport.height}.png`,
    );
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    console.log(JSON.stringify({ viewport, metrics, screenshotPath }));
    if (viewport.surface === "canvas") {
      if (!metrics.canvas || metrics.mobileShell)
        throw new Error(
          `${viewport.width}x${viewport.height} did not render the canvas surface`,
        );
      if (Math.abs(metrics.composerHeight - 94) > 1)
        throw new Error(
          `${viewport.width}x${viewport.height} composer height=${metrics.composerHeight}`,
        );
      if (Math.abs(metrics.railWidth - 30) > 1)
        throw new Error(
          `${viewport.width}x${viewport.height} rail width=${metrics.railWidth}`,
        );
      if (metrics.cardCount < 1)
        throw new Error(
          `${viewport.width}x${viewport.height} rendered no cards`,
        );
      if (
        !metrics.selectionToolbarVisible
        || metrics.selectionToolbarOverflow
        || metrics.selectionToolbarCardOverlap
      )
        throw new Error(
          `${viewport.width}x${viewport.height} selection toolbar is hidden, outside the viewport, or overlapping a card`,
        );
      if (metrics.seededNodeCount !== sceneNodeCount)
        throw new Error(
          `${viewport.width}x${viewport.height} loaded ${metrics.seededNodeCount}/${sceneNodeCount} seeded nodes`,
        );
      if (stress10k && metrics.cardCount >= 1000)
        throw new Error(
          `10k canvas rendered ${metrics.cardCount} DOM cards instead of a virtualized subset`,
        );
    } else if (!metrics.mobileShell || metrics.canvas) {
      throw new Error(
        `${viewport.width}x${viewport.height} did not preserve the result-flow surface`,
      );
    } else {
      const mobileCanvasDrag = await verifyMobileCanvasDrag(cdp, viewport);
      if (
        mobileCanvasDrag.pointerError.x > 2
        || mobileCanvasDrag.pointerError.y > 2
        || mobileCanvasDrag.settledPositionError.x > 2
        || mobileCanvasDrag.settledPositionError.y > 2
        || mobileCanvasDrag.postReleaseDrift > 1
        || mobileCanvasDrag.settled.horizontalOverflow
      ) {
        throw new Error(
          `${viewport.width}x${viewport.height} mobile canvas drag is unstable: ${JSON.stringify(mobileCanvasDrag)}`,
        );
      }
      metrics.mobileCanvasDrag = mobileCanvasDrag;
    }
    if (metrics.horizontalOverflow || metrics.chromeOverlap)
      throw new Error(
        `${viewport.width}x${viewport.height} has UI overflow or chrome overlap`,
      );
    if (Buffer.byteLength(screenshot.data, "base64") < 10000)
      throw new Error(
        `${viewport.width}x${viewport.height} screenshot is unexpectedly blank`,
      );
    results.push({ ...viewport, ...metrics, screenshotPath });
  }
  const report = {
    targetUrl,
    stress10k,
    sceneNodeCount,
    readyDurationMs,
    results,
  };
  writeFileSync(
    path.join(artifactDir, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  cdp?.close();
  chrome.kill();
  await closeLocalViteServer(server.server);
}
