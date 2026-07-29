import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('desktop canvas keeps the 262px workspace panel persistent without a modal backdrop', () => {
  const projectManagerSource = readSource(
    'apps/web/src/components/settings/ProjectManager.tsx',
  );
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(projectManagerSource, /useState\(\(\) => !isMobile\)/);
  assert.match(projectManagerSource, /setShowDropdown\(!isMobile\)/);
  assert.match(projectManagerSource, /data-desktop-persistent=\{!isMobile\}/);
  assert.match(
    projectManagerSource,
    /\{isMobile\s*\?\s*\([\s\S]*KK_LAYER\.modalBackdrop[\s\S]*\)\s*:\s*null\}/,
  );
  assert.match(
    projectManagerSource,
    /zIndex:\s*isMobile\s*\?\s*KK_LAYER\.modal\s*:\s*KK_LAYER\.floatingPanel/,
  );
  assert.match(
    cssSource,
    /\.kk-morphic-project-panel\[data-desktop-persistent='true'\]\s*\{[\s\S]*width:\s*var\(--kk-morphic-left-panel-width\)/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-morphic-project-panel\s*\{[\s\S]*display:\s*none\s*!important/,
  );
});

test('desktop chrome publishes the V3 project, canvas and account hierarchy', () => {
  const desktopChromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const cssSource = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(desktopChromeSource, /data-chrome-region="project"/);
  assert.match(desktopChromeSource, /data-chrome-region="canvas"/);
  assert.match(desktopChromeSource, /data-chrome-region="account"/);
  assert.match(desktopChromeSource, /data-composer-copilot-toggle="true"/);
  assert.match(
    cssSource,
    /\.kk-workspace-chrome-v3\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px,\s*1fr\)\s*auto\s*minmax\(180px,\s*1fr\)/,
  );
  assert.match(
    cssSource,
    /\.kk-workspace-chrome-v3__project,[\s\S]*font-size:\s*var\(--kk-type-button\)/,
  );
});

test('canvas navigation uses one bottom-right dock and keeps its minimap bottom-anchored', () => {
  const navigationSource = readSource(
    'apps/web/src/app/AppCanvasNavigationPanel.tsx',
  );
  const workspaceSource = readSource(
    'apps/web/src/pages/Workspace/WorkspacePage.tsx',
  );
  const cssSource = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(
    navigationSource,
    /savedCollapsedState\s*===\s*null\s*\?\s*true\s*:\s*savedCollapsedState\s*===\s*'true'/,
  );
  assert.match(navigationSource, /data-canvas-navigation-dock="true"/);
  assert.match(navigationSource, /data-canvas-minimap-popover="true"/);
  assert.match(navigationSource, /onFitToAll:\s*\(\)\s*=>\s*void/);
  assert.match(navigationSource, /onResetView:\s*\(\)\s*=>\s*void/);
  assert.match(navigationSource, /onAutoArrange:\s*\(\)\s*=>\s*void/);
  assert.match(
    cssSource,
    /\.desktop-navigation-panel\s*\{[\s\S]*top:\s*auto\s*!important[\s\S]*bottom:\s*10px\s*!important/,
  );
  assert.match(
    cssSource,
    /\.kk-canvas-navigation-stack\s*\{[\s\S]*align-items:\s*flex-end/,
  );
  assert.match(
    workspaceSource,
    /<AppCanvasNavigationPanel[\s\S]*onFitToAll=\{handleFitToAll\}[\s\S]*onResetView=\{resetViewFn\}[\s\S]*onAutoArrange=\{handleAutoArrange\}/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.desktop-navigation-panel\s*\{[\s\S]*display:\s*block\s*!important/,
  );
});

test('Copilot rail removes the extra context row and matches the 46px plus 28px reference rhythm', () => {
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\][\s\S]*:nth-child\(1\)\s*>\s*:nth-child\(1\)\s*\{[\s\S]*height:\s*46px/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\][\s\S]*:nth-child\(1\)\s*>\s*:nth-child\(2\)\s*\{[\s\S]*display:\s*none/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\][\s\S]*:nth-child\(3\)\s*>\s*:first-child\s*\{[\s\S]*height:\s*28px/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\][\s\S]*:nth-child\(3\)\s*>\s*:first-child\s*>\s*:last-child\s*\{[\s\S]*display:\s*none/,
  );
});
