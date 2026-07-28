import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas selection actions avoid card content and keep a mobile safe-area fallback', () => {
  const overlaySource = readSource('apps/web/src/app/useSelectionMenuOverlay.ts');
  const menuSource = readSource('apps/web/src/components/canvas/SelectionMenu.tsx');
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(overlaySource, /shiftScreenRectRightPastBlocks/);
  assert.match(overlaySource, /rightCandidates[\s\S]*elevatedCenterY[\s\S]*loweredCenterY/);
  assert.match(overlaySource, /resolvedRightCandidate/);
  assert.match(overlaySource, /if\s*\(canUseLeft\)/);
  assert.match(overlaySource, /clampedRightCandidateLeft/);
  assert.match(overlaySource, /if\s*\(isMobile\)[\s\S]*placement:\s*'bottom'/);
  assert.match(menuSource, /data-placement=\{placement\}/);
  assert.doesNotMatch(menuSource, /translate\(-50%, -100%\)/);
  assert.match(
    cssSource,
    /\.kk-canvas-selection-menu\[data-placement='right'\]\s*\{[\s\S]*translate\(12px,\s*-50%\)/,
  );
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*768px\)[\s\S]*\.kk-canvas-selection-menu\[data-placement='bottom'\]\s*\{[\s\S]*safe-area-inset-bottom/,
  );
});

test('project utility panel fits its content while its toolbar moves beside the panel', () => {
  const projectManagerSource = readSource(
    'apps/web/src/components/settings/ProjectManager.tsx',
  );
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.doesNotMatch(projectManagerSource, /top-\[48px\]\s+bottom-\[10px\]/);
  assert.match(projectManagerSource, /kk-morphic-project-panel__list/);
  assert.match(
    cssSource,
    /\.kk-morphic-project-panel\[data-desktop-persistent='true'\]\s*\{[\s\S]*height:\s*max-content[\s\S]*max-height:\s*calc\(100dvh - 58px\)/,
  );
  assert.match(
    cssSource,
    /#project-manager-container\[data-panel-open='true'\]\s*\{[\s\S]*left:\s*282px\s*!important[\s\S]*opacity:\s*1/,
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
