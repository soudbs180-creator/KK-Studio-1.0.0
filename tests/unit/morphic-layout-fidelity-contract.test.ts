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

test('canvas navigation defaults to a compact bottom-right zoom control', () => {
  const navigationSource = readSource(
    'apps/web/src/app/AppCanvasNavigationPanel.tsx',
  );
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(
    navigationSource,
    /savedCollapsedState\s*===\s*null\s*\?\s*true\s*:\s*savedCollapsedState\s*===\s*'true'/,
  );
  assert.match(navigationSource, /canvas-nav-panel--compact/);
  assert.match(
    cssSource,
    /\.desktop-navigation-panel:has\(\.canvas-nav-panel--compact\)\s*\{[\s\S]*bottom:\s*10px\s*!important/,
  );
  assert.match(
    cssSource,
    /\.canvas-nav-panel--compact\s*\{[\s\S]*width:\s*156px\s*!important[\s\S]*height:\s*32px\s*!important/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='canvas'\]\s+\.kk-workspace-edge-toggle[\s\S]*display:\s*none\s*!important/,
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
