import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas selection actions avoid card content and keep a mobile safe-area fallback', () => {
  const overlaySource = readSource('apps/web/src/app/useSelectionMenuOverlay.ts');
  const edgeGeometrySource = readSource('apps/web/src/canvas/v3/edgeGeometry.ts');
  const menuSource = readSource('apps/web/src/components/canvas/SelectionMenu.tsx');
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(overlaySource, /resolveCanvasV3ToolbarPlacement/);
  assert.doesNotMatch(overlaySource, /shiftScreenRectRightPastBlocks/);
  assert.match(edgeGeometrySource, /const shiftRightPastBlockedRects/);
  assert.match(
    edgeGeometrySource,
    /const candidates = \[[\s\S]*card\.right \+ TOOLBAR_GAP,[\s\S]*centerY[\s\S]*card\.top[\s\S]*card\.bottom - toolbar\.height[\s\S]*card\.left - TOOLBAR_GAP - toolbar\.width/,
  );
  assert.match(
    edgeGeometrySource,
    /candidates\.find\(\(\{ rect \}\) => inside\(rect, viewport\) && !blocked\.some/,
  );
  assert.match(
    edgeGeometrySource,
    /Math\.max\(viewport\.left \+ TOOLBAR_GAP,[\s\S]*Math\.min\(card\.right \+ TOOLBAR_GAP/,
  );
  assert.match(overlaySource, /if\s*\(isMobile\)[\s\S]*placement:\s*'bottom'/);
  assert.match(menuSource, /data-placement=\{placement\}/);
  assert.doesNotMatch(menuSource, /translate\(-50%, -100%\)/);
  assert.match(
    cssSource,
    /\.kk-canvas-selection-menu\[data-placement='right'\]\s*\{[\s\S]*translate\(12px,\s*-50%\)/,
  );
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*1023px\)[\s\S]*\.kk-canvas-selection-menu\[data-placement='bottom'\]\s*\{[\s\S]*safe-area-inset-bottom/,
  );
});

test('project rail stays at the leading edge while its content panel opens beside it', () => {
  const projectManagerSource = readSource(
    'apps/web/src/components/settings/ProjectManager.tsx',
  );
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.doesNotMatch(projectManagerSource, /top-\[48px\]\s+bottom-\[10px\]/);
  assert.match(projectManagerSource, /kk-morphic-project-panel__list/);
  assert.match(projectManagerSource, /className="kk-project-rail-host fixed left-3/);
  assert.doesNotMatch(projectManagerSource, /top:\s*'50%'|translateY\(-50%\)/);
  assert.match(
    cssSource,
    /\.kk-morphic-project-panel\[data-desktop-persistent='true'\]\s*\{[\s\S]*left:\s*50px\s*!important[\s\S]*height:\s*max-content[\s\S]*max-height:\s*calc\(100dvh - 58px\)/,
  );
  assert.match(
    cssSource,
    /\.kk-project-rail-host\s*\{[\s\S]*top:\s*calc\(var\(--kk-morphic-topbar-height\) \+ 10px\)[\s\S]*transform:\s*none/,
  );
  assert.match(
    cssSource,
    /#project-manager-container\[data-panel-open='true'\]\s*\{[\s\S]*left:\s*12px\s*!important[\s\S]*opacity:\s*1/,
  );
  const openToolbarRule = cssSource.match(
    /#project-manager-container\[data-panel-open='true'\]\s*\{([^}]*)\}/,
  )?.[1] || '';
  assert.doesNotMatch(openToolbarRule, /pointer-events:\s*none/);
});

test('workspace modes are controlled by the real surface and hidden panels are inert', () => {
  const chromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const workspacePageSource = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const panelsSource = readSource(
    'apps/web/src/components/workspace/WorkspaceSurfacePanels.tsx',
  );

  assert.match(chromeSource, /activeMode:\s*'canvas'\s*\|\s*'copilot'\s*\|\s*'create'/);
  assert.doesNotMatch(chromeSource, /useState<'canvas'\s*\|\s*'copilot'\s*\|\s*'create'>/);
  assert.match(chromeSource, /onOpenCanvasWorkspace\(\)/);
  assert.match(chromeSource, /onOpenCreateWorkspace\(\)/);
  assert.match(
    workspacePageSource,
    /activeMode=\{isChatOpen\s*\?\s*'copilot'\s*:\s*workspaceSurface\s*===\s*'library'\s*\?\s*'create'\s*:\s*'canvas'\}/,
  );
  assert.match(workspacePageSource, /onOpenCreateWorkspace=\{openLibrarySurface\}/);
  assert.match(panelsSource, /aria-hidden=\{!isChatOpen\}/);
  assert.match(panelsSource, /inert=\{!isChatOpen\}/);
  assert.match(panelsSource, /pointerEvents:\s*isChatOpen\s*\?\s*'auto'\s*:\s*'none'/);
});

test('Morphic workspace motion uses the measured short easing contract', () => {
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(cssSource, /--kk-morphic-ease-standard:\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/);
  assert.match(
    cssSource,
    /\.kk-morphic-workspace\s+:where\([\s\S]*transition-duration:\s*var\(--kk-morphic-motion-control\)\s*!important/,
  );
  assert.doesNotMatch(
    cssSource,
    /\.kk-morphic-workspace\s+:where\([\s\S]*transition-duration:\s*280ms/,
  );
});
