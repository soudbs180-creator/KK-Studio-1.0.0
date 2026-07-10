import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getCanvasViewportSurfaceKey,
  isCanvasWorkspaceResultFlow,
  resolveCanvasWorkspaceSurface,
} from '../../apps/web/src/utils/responsiveSurface.ts';
import {
  canvasScreenPointToWorld,
  getAvailableCanvasViewport,
} from '../../apps/web/src/canvas/canvasAvailableViewport.ts';

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

test('workspace persists canvas views per responsive surface', () => {
  const source = fs.readFileSync('apps/web/src/pages/Workspace/WorkspacePage.tsx', 'utf8');
  assert.match(source, /resolveCanvasWorkspaceSurface/);
  assert.match(source, /getCanvasViewportSurfaceKey\(canvasWorkspaceSurface\)/);
  assert.match(source, /isCanvasWorkspaceResultFlow\(canvasWorkspaceSurface\)/);
  assert.doesNotMatch(source, /getCanvasViewportStorageKey\([^)]*,\s*'desktop'\)/);
});

test('desktop canvas chrome uses a stable compact composer and 44px rail', () => {
  const promptBar = fs.readFileSync('apps/web/src/components/layout/PromptBar.tsx', 'utf8');
  const projectManager = fs.readFileSync('apps/web/src/components/settings/ProjectManager.tsx', 'utf8');
  const css = fs.readFileSync('apps/web/src/styles/canvas.css', 'utf8');

  assert.match(promptBar, /data-desktop-composer-state="compact"/);
  assert.match(promptBar, /h-\[68px\]/);
  assert.match(promptBar, /data-desktop-composer-state="expanded"/);
  assert.match(css, /max-height:\s*min\(320px, 30dvh\)/);
  assert.match(projectManager, /fixed left-3 z-50 flex w-11/);
  assert.match(projectManager, /h-10 w-10 shrink-0/);
  assert.doesNotMatch(projectManager, /scale\(\$\{desktopScale\}\)/);
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
