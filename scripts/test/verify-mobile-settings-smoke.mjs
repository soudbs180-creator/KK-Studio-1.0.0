import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { runBrowserPreflight } from './browser-preflight.mjs';
import {
  closeLocalViteServer,
  ensureLocalViteServer,
} from './ensure-local-vite-server.mjs';

const REPO_ROOT = process.cwd();
const ARTIFACT_DIR = path.join(REPO_ROOT, '.tmp-playwright', 'mobile-settings-smoke');
const DEFAULT_TARGET_URL = 'http://127.0.0.1:3000';
const SETTINGS_HOME_PATH = '/settings';
const SETTINGS_API_PATH = '/settings/api-management';
const STORAGE_KEY = 'kk_studio_canvas_state';

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX6lzQAAAAASUVORK5CYII=';

const timestamp = Date.now();

const seededCanvasState = {
  canvases: [
    {
      id: 'default',
      name: 'Project 1',
      promptNodes: [
        {
          id: 'prompt-ecom',
          prompt: 'Smoke mobile ecommerce prompt',
          originalPrompt: 'Smoke mobile ecommerce prompt',
          position: { x: 0, y: 0 },
          aspectRatio: '1:1',
          imageSize: '1K',
          model: 'gemini-2.5-flash-image-preview',
          modelLabel: 'Nano Banana',
          childImageIds: ['image-ecom'],
          referenceImages: [],
          timestamp,
          mode: 'image',
          userMoved: false,
          ecommerce: {
            kind: 'a-plus-module',
            sourceSheet: 'A+',
            sourceRowKey: 'module-hero',
            displayLabel: 'A+ 21:9 4K',
            selectedForGeneration: false,
            stage: 'generated',
            desktopStage: 'generated',
            mobileStage: 'locked',
            declaredSizeText: '21:9 4K',
            needsReview: true,
            reviewWarnings: ['Need confirm'],
            editableTask: {
              taskId: 'task-hero',
              sourceKind: 'a-plus-module',
              sourceSheet: 'A+',
              sourceRowKey: 'module-hero',
              theme: 'Hero',
              outputTypeLabel: 'A+ Hero Banner',
              imageRoleSummary: ['Product image', 'Reference image 1'],
              sparseUserIntent: 'Keep the product clear while following the first reference layout.',
              copy: {
                headline: 'headline',
                subheadline: 'subheadline',
                highlight: 'highlight',
                featureTags: [],
                cta: 'cta',
              },
              style: {
                tone: 'Professional',
                atmosphere: 'Crisp',
                effect: 'Glossy',
                backgroundType: 'Solid',
              },
              layout: {
                productSize: 'balanced',
                textPosition: 'right',
                accessoryPolicy: 'minimal',
              },
              inherit: {
                keepSeriesStyle: true,
                keepFontStyle: true,
                keepLayoutStyle: true,
                keepCopyStyle: true,
                keepPalette: true,
              },
              assetRoles: [
                {
                  assetId: 'product-1',
                  role: 'product',
                  label: 'Product image',
                  normalizedLabel: 'product image',
                  source: 'analysis',
                },
                {
                  assetId: 'ref-1',
                  role: 'reference',
                  label: 'Reference image 1',
                  normalizedLabel: 'reference image 1',
                  source: 'analysis',
                },
              ],
              consistencyChecks: [],
              missingFields: [],
              resolvedPromptPreview: 'A+ Hero Prompt',
              displayLabel: 'A+ 21:9 4K',
            },
          },
        },
      ],
      imageNodes: [
        {
          id: 'image-ecom',
          storageId: 'image-ecom',
          url: tinyPng,
          originalUrl: tinyPng,
          prompt: 'Smoke result image',
          aspectRatio: '1:1',
          imageSize: '1K',
          exactDimensions: { width: 1200, height: 1200 },
          timestamp,
          model: 'gemini-2.5-flash-image-preview',
          modelLabel: 'Nano Banana',
          canvasId: 'default',
          parentPromptId: 'prompt-ecom',
          position: { x: 0, y: 420 },
          userMoved: false,
        },
      ],
      groups: [],
      drawings: [],
      workflow: undefined,
      lastModified: timestamp,
    },
  ],
  activeCanvasId: 'default',
  history: { default: { past: [], future: [] } },
  fileSystemHandle: null,
  folderName: null,
  selectedNodeIds: [],
  subCardLayoutMode: 'row',
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
    || /Playwright module was not found/i.test(message);
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

async function dismissStorageModalIfPresent(page) {
  const saveSettingsButton = page.getByRole('button', { name: /Save settings/i });
  if (await saveSettingsButton.isVisible().catch(() => false)) {
    await saveSettingsButton.click();
    await page.waitForTimeout(1200);
  }
}

async function dismissSettingsPanelIfPresent(page) {
  const closeButton = page.getByRole('button', { name: /Close settings|Close/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(800);
  }
}

async function assertVisible(locator, message) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  if (!(await locator.isVisible())) {
    throw new Error(message);
  }
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

function verifyMobileSourceContracts() {
  const mobileHeaderSource = readSource('src/components/mobile/MobileHeader.tsx');
  const mobileSurfaceSource = readSource('src/components/mobile/MobileWorkspaceSurface.tsx');
  const mobileTileSource = readSource('src/components/mobile/MobileResultTile.tsx');
  const dashboardSource = readSource('src/components/settings/views/DashboardView.localized.tsx');
  const workbenchSectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');
  const scaffoldSource = readSource('src/components/settings/SettingsScaffold.tsx');

  const checks = [
    /data-testid="mobile-header-menu-button"/,
    /data-testid="mobile-more-menu-settings"/,
    /data-testid="mobile-more-sheet"/,
    /data-testid=\{`mobile-result-tile-\$\{entry\.id\}`\}/,
    /settings-dashboard-cockpit__node/,
    /dashboardPrimaryAction\.label/,
    /testId\?: string;/,
    /data-testid=\{testId\}/,
    /testId="settings-workbench-overview"/,
    /testId="settings-workbench-current-view"/,
    /testId="settings-workbench-stage"/,
    /testId="settings-workbench-diagnostics"/,
    /testId="settings-workbench-platform"/,
  ];

  const sources = [
    mobileHeaderSource,
    mobileSurfaceSource,
    mobileTileSource,
    dashboardSource,
    workbenchSectionsSource,
    scaffoldSource,
  ];

  for (const pattern of checks) {
    if (!sources.some((source) => pattern.test(source))) {
      throw new Error(`Mobile settings source contract missing pattern: ${pattern}`);
    }
  }
}

async function runFallbackVerification(error, browserPreflight, targetUrl) {
  verifyMobileSourceContracts();

  const routes = await Promise.all([
    assertHttpHtml(targetUrl),
    assertHttpHtml(`${targetUrl}${SETTINGS_HOME_PATH}`),
    assertHttpHtml(`${targetUrl}${SETTINGS_API_PATH}`),
  ]);

  const summary = {
    mode: 'fallback',
    reason: String(error?.message || error),
    browserPreflight,
    routes,
    artifactDir: ARTIFACT_DIR,
    seededCanvasState: {
      activeCanvasId: seededCanvasState.activeCanvasId,
      canvasCount: seededCanvasState.canvases.length,
      promptNodeCount: seededCanvasState.canvases[0]?.promptNodes.length || 0,
      imageNodeCount: seededCanvasState.canvases[0]?.imageNodes.length || 0,
    },
  };

  writeFileSync(
    path.join(ARTIFACT_DIR, 'mobile-settings-fallback.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

ensureArtifactsDir();

let browser;
let viteServer;
let browserPreflight = null;
let targetUrl = DEFAULT_TARGET_URL;

try {
  const ensured = await ensureLocalViteServer({ root: REPO_ROOT, url: DEFAULT_TARGET_URL });
  viteServer = ensured.server;
  targetUrl = ensured.url || DEFAULT_TARGET_URL;
  browserPreflight = await runBrowserPreflight();

  const playwrightModuleUrl = await resolvePlaywrightModuleUrl();
  const { chromium } = await import(playwrightModuleUrl);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  });

  await gotoWithRetry(page, targetUrl);
  await page.waitForTimeout(1000);
  await dismissStorageModalIfPresent(page);

  await page.evaluate(({ state, storageKey }) => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, {
    state: seededCanvasState,
    storageKey: STORAGE_KEY,
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await dismissStorageModalIfPresent(page);
  await dismissSettingsPanelIfPresent(page);

  const mobileSurface = page.getByTestId('mobile-workspace-surface');
  const mobileShell = page.getByTestId('mobile-app-shell');
  const resultTile = page.getByTestId('mobile-result-tile-image-ecom');

  await assertVisible(mobileSurface, 'Mobile workspace surface did not render.');
  await assertVisible(mobileShell, 'Mobile app shell did not render.');
  await assertVisible(resultTile, 'Seeded mobile result tile did not render.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-home.png'),
    fullPage: true,
  });

  await resultTile.click();

  const detailScreen = page.getByTestId('mobile-result-detail-screen');
  const continuationPanel = page.getByTestId('mobile-ecommerce-continuation-panel');

  await assertVisible(detailScreen, 'Mobile detail screen did not open from the tile projection.');
  await assertVisible(continuationPanel, 'Mobile ecommerce continuation panel did not render in detail view.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-detail.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: /关闭结果详情|Close result detail/i }).click();
  await detailScreen.waitFor({ state: 'hidden', timeout: 10000 });
  await assertVisible(resultTile, 'Mobile result tile did not reappear after closing detail view.');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'post-detail-home.png'),
    fullPage: true,
  });
  const menuButton = page.getByTestId('mobile-header-menu-button');
  await assertVisible(menuButton, 'Mobile header menu button did not reappear after closing detail view.');
  await menuButton.click();
  await page.waitForTimeout(400);

  const moreSheet = page.getByTestId('mobile-more-sheet');
  const settingsEntry = page.getByTestId('mobile-more-menu-settings');

  await assertVisible(moreSheet, 'Mobile more-sheet did not open.');
  await assertVisible(settingsEntry, 'Mobile more-sheet settings entry did not render.');

  await settingsEntry.click();

  const settingsOverviewHeading = page.getByRole('heading', { name: /设置总览|Settings Overview/i });
  const apiEntry = page.getByRole('button', { name: /打开 API 工作台|Open API Workspace/i });

  await assertVisible(settingsOverviewHeading, 'Mobile settings overview did not open by default.');
  await assertVisible(apiEntry, 'Mobile settings overview API action did not render.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings-overview.png'),
    fullPage: true,
  });

  await apiEntry.click();

  const workbenchOverview = page.getByTestId('settings-workbench-overview');
  const workbenchCurrentView = page.getByTestId('settings-workbench-current-view');
  const workbenchStage = page.getByTestId('settings-workbench-stage');
  const workbenchPlatform = page.getByTestId('settings-workbench-platform');

  await assertVisible(workbenchOverview, 'Settings workbench overview section did not render.');
  await assertVisible(workbenchCurrentView, 'Settings workbench current-view section did not render.');
  await assertVisible(workbenchStage, 'Settings workbench stage section did not render.');
  await assertVisible(workbenchPlatform, 'Settings workbench platform section did not render.');

  await workbenchStage.getByRole('button', { name: /鏌ョ湅璇婃柇|Show diagnostics/i }).click();

  const workbenchDiagnostics = page.getByTestId('settings-workbench-diagnostics');
  await assertVisible(workbenchDiagnostics, 'Settings workbench diagnostics section did not appear after toggling.');

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings-workbench.png'),
    fullPage: true,
  });

  console.log(JSON.stringify({
    mode: 'browser',
    browserPreflight,
    mobileHome: {
      shellVisible: true,
      tileVisible: true,
    },
    mobileDetail: {
      detailVisible: true,
      continuationVisible: true,
    },
    settingsWorkbench: {
      settingsOverviewVisible: true,
      overviewVisible: true,
      currentViewVisible: true,
      stageVisible: true,
      diagnosticsVisible: true,
      platformVisible: true,
    },
    artifactDir: ARTIFACT_DIR,
  }, null, 2));
} catch (error) {
  if (isBrowserLaunchUnavailable(error)) {
    await runFallbackVerification(error, browserPreflight, targetUrl);
  } else {
    throw error;
  }
} finally {
  if (browser) {
    await browser.close();
  }
  if (viteServer) {
    await closeLocalViteServer(viteServer);
  }
}
