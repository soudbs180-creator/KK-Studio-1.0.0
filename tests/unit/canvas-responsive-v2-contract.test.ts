import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getCanvasViewportSurfaceKey,
  isCanvasWorkspaceResultFlow,
  resolveCanvasWorkspaceSurface,
  resolveStableResponsiveViewport,
} from '../../apps/web/src/utils/responsiveSurface.ts';
import {
  canvasScreenPointToWorld,
  getAvailableCanvasViewport,
} from '../../apps/web/src/canvas/canvasAvailableViewport.ts';
import { resolveWorkspaceLayoutInsets } from '../../apps/web/src/app/workspaceLayoutRegistry.ts';

test('workspace keeps phones and portrait tablets in the result flow', () => {
  assert.equal(resolveCanvasWorkspaceSurface(390, 844), 'phone-results');
  assert.equal(resolveCanvasWorkspaceSurface(834, 1112), 'tablet-portrait-results');
  assert.equal(isCanvasWorkspaceResultFlow('phone-results'), true);
  assert.equal(isCanvasWorkspaceResultFlow('tablet-portrait-results'), true);
});

test('landscape tablets use the touch canvas and a separate viewport key', () => {
  assert.equal(resolveCanvasWorkspaceSurface(1023, 720), 'tablet-landscape-canvas');
  assert.equal(resolveCanvasWorkspaceSurface(1180, 820), 'desktop-canvas');
  assert.equal(isCanvasWorkspaceResultFlow('tablet-landscape-canvas'), false);
  assert.equal(getCanvasViewportSurfaceKey('tablet-landscape-canvas'), 'tablet-landscape');
  assert.equal(getCanvasViewportSurfaceKey('desktop-canvas'), 'desktop');
});

test('soft keyboards do not switch a portrait tablet into landscape canvas mode', () => {
  const stable = resolveStableResponsiveViewport(
    { width: 834, height: 1112 },
    { width: 834, height: 640 },
    true,
  );
  assert.deepEqual(stable, { width: 834, height: 1112 });
  assert.equal(resolveCanvasWorkspaceSurface(stable.width, stable.height), 'tablet-portrait-results');
  assert.deepEqual(resolveStableResponsiveViewport(
    { width: 834, height: 1112 },
    { width: 1023, height: 720 },
    true,
  ), { width: 1023, height: 720 });
});

test('workspace persists canvas views per responsive surface', () => {
  const source = fs.readFileSync('apps/web/src/pages/Workspace/WorkspacePage.tsx', 'utf8');
  assert.match(source, /resolveCanvasWorkspaceSurface/);
  assert.match(source, /getCanvasViewportSurfaceKey\(canvasWorkspaceSurface\)/);
  assert.match(source, /isCanvasWorkspaceResultFlow\(canvasWorkspaceSurface\)/);
  assert.match(source, /selectionMenu=\{isMobile \? null : selectionMenuOverlay\}/);
  assert.doesNotMatch(source, /getCanvasViewportStorageKey\([^)]*,\s*'desktop'\)/);
});

test('desktop canvas keeps the composer centered in available space at a compact scale', () => {
  const promptBar = fs.readFileSync('apps/web/src/components/layout/PromptBar.tsx', 'utf8');
  const projectManager = fs.readFileSync('apps/web/src/components/settings/ProjectManager.tsx', 'utf8');
  const css = fs.readFileSync('apps/web/src/styles/canvas.css', 'utf8');

  assert.match(promptBar, /if \(!isExpanded && isMobile\)/);
  assert.match(promptBar, /data-desktop-composer-state="expanded"/);
  assert.match(promptBar, /resolveWorkspaceLayoutInsets/);
  assert.match(promptBar, /'--kk-workspace-left-inset'/);
  assert.match(promptBar, /'--kk-workspace-right-inset'/);
  assert.match(promptBar, /<ComposerReferenceButton/);
  assert.match(promptBar, /placeholder="随心输入"/);
  assert.match(promptBar, /const PROMPT_TEXTAREA_MAX_ROWS = 10;/);
  assert.match(promptBar, /rows=\{PROMPT_TEXTAREA_MIN_ROWS\}/);
  assert.doesNotMatch(promptBar, /kk-desktop-composer-primary-input/);
  assert.match(css, /max-height:\s*min\(216px, calc\(100dvh - 120px\)\)/);
  assert.match(css, /padding:\s*6px;[\s\S]*gap:\s*4px;/);
  assert.doesNotMatch(css, /\.kk-desktop-composer-expanded \.input-bar-footer \{[\s\S]*order:/);
  assert.match(promptBar, /<DesktopComposerPromptTools[\s\S]*<PromptBarFooter isMobile=\{isMobile\}>/);
  assert.doesNotMatch(promptBar, /body:has\(/);
  assert.match(projectManager, /kk-project-rail-host fixed left-3 z-50 flex w-\[30px\]/);
  assert.match(projectManager, /h-\[30px\] w-\[30px\] shrink-0/);
  assert.doesNotMatch(projectManager, /tabIndex=\{-1\}/);
  assert.doesNotMatch(projectManager, /setIsCollapsed|w-2 justify-center/);
  assert.doesNotMatch(projectManager, /scale\(\$\{desktopScale\}\)/);
});

test('workspace composer reserves the navigation panel instead of overlapping it', () => {
  assert.deepEqual(resolveWorkspaceLayoutInsets({
    isMobile: false,
    isChatOpen: false,
    chatSidebarWidth: 0,
    navigationPanelWidth: 304,
  }), { left: 72, right: 328 });
  assert.deepEqual(resolveWorkspaceLayoutInsets({
    isMobile: false,
    isChatOpen: true,
    chatSidebarWidth: 420,
    navigationPanelWidth: 304,
  }), { left: 72, right: 760 });
});

test('desktop drawing toolbar stays compact, draggable, persisted, and viewport-clamped', () => {
  const toolbar = fs.readFileSync('apps/web/src/components/canvas/CanvasDrawingToolbar.tsx', 'utf8');
  assert.match(toolbar, /className="kk-drawing-toolbar__control h-9 w-9"/);
  assert.match(toolbar, /className="kk-drawing-toolbar__swatch h-9 w-6"/);
  assert.match(toolbar, /setPointerCapture\(event\.pointerId\)/);
  assert.match(toolbar, /releasePointerCapture\(event\.pointerId\)/);
  assert.match(toolbar, /DRAWING_TOOLBAR_STORAGE_KEY/);
  assert.match(toolbar, /clampFloatingToolbarPosition/);
});

test('touch canvas owns browser gestures and supports two-finger pan and zoom', () => {
  const source = fs.readFileSync('apps/web/src/components/canvas/InfiniteCanvas.tsx', 'utf8');
  assert.match(source, /e\.touches\.length === 2/);
  assert.match(source, /touchGestureRef/);
  assert.match(source, /Math\.min\(3, Math\.max\(0\.1,/);
  assert.match(source, /touchAction: 'none'/);
  assert.match(source, /addEventListener\('touchcancel'/);
});

test('card creation and focus use the viewport left after chrome occlusion', () => {
  const available = getAvailableCanvasViewport(
    { width: 1200, height: 800 },
    { left: 60, top: 70, bottom: 100 },
  );
  assert.deepEqual(available, {
    x: 60,
    y: 70,
    width: 1140,
    height: 630,
    centerX: 630,
    centerY: 385,
  });
  assert.deepEqual(canvasScreenPointToWorld(
    { x: available.centerX, y: available.centerY },
    { x: 30, y: -15, scale: 1.5 },
  ), { x: 400, y: 266.6666666666667 });

  const viewportHook = fs.readFileSync('apps/web/src/hooks/useCanvasViewport.ts', 'utf8');
  assert.match(viewportHook, /getAvailableCanvasViewport/);
  assert.match(viewportHook, /prompt-bar-container/);
  assert.match(viewportHook, /project-manager-container/);
});
