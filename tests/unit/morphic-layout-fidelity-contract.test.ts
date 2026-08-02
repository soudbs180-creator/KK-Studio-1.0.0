import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('desktop project menu opens on demand below the top trigger without a modal backdrop', () => {
  const projectManagerSource = readSource(
    'apps/web/src/components/settings/ProjectManager.tsx',
  );
  assert.match(projectManagerSource, /const \[showDropdown, setShowDropdown\] = useState\(false\);/);
  assert.match(projectManagerSource, /PROJECT_MENU_TOGGLE_EVENT/);
  assert.match(projectManagerSource, /computeProjectPanelLeft\(triggerLeft, 262, window\.innerWidth\)/);
  assert.match(projectManagerSource, /data-desktop-persistent=\{!isMobile\}/);
  assert.match(
    projectManagerSource,
    /\{isMobile\s*\?\s*\([\s\S]*KK_LAYER\.modalBackdrop[\s\S]*\)\s*:\s*null\}/,
  );
  assert.match(
    projectManagerSource,
    /zIndex:\s*isMobile\s*\?\s*KK_LAYER\.modal\s*:\s*KK_LAYER\.floatingPanel/,
  );
  const workspaceOverrideSource = readSource('apps/web/src/styles/workspace-ui-v4.css');
  assert.match(workspaceOverrideSource, /\.kk-morphic-project-panel\[data-desktop-persistent='true'\]/);
  assert.match(workspaceOverrideSource, /--kk-project-panel-left:\s*12px/);
  assert.match(workspaceOverrideSource, /top:\s*56px\s*!important/);
  assert.doesNotMatch(projectManagerSource, /!isMobile\s*\?\s*\([\s\S]*KK_LAYER\.modalBackdrop/);
});

test('desktop chrome publishes the V3 hierarchy while PromptBar owns Copilot expansion', () => {
  const desktopChromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const cssSource = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(desktopChromeSource, /data-chrome-region="project"/);
  assert.match(desktopChromeSource, /data-chrome-region="tasks"/);
  assert.match(desktopChromeSource, /data-chrome-region="account"/);
  assert.doesNotMatch(desktopChromeSource, /data-composer-copilot-toggle="true"/);
  assert.match(promptBarSource, /data-composer-copilot-toggle="true"/);
  assert.match(promptBarSource, /className="kk-composer-assistant-toggle"/);
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

test('Copilot is a right companion panel and keeps the live canvas visible', () => {
  const cssSource = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar\s*\{[\s\S]*right:\s*10px\s*!important[\s\S]*left:\s*auto\s*!important[\s\S]*width:\s*min\(420px,\s*calc\(100vw - 24px\)\)\s*!important/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar\s*>\s*\.w-full\.h-full\s*\{[\s\S]*display:\s*flex\s*!important[\s\S]*flex-direction:\s*column/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar\s*>\s*\.w-full\.h-full\s*>\s*:nth-child\(2\)\s*\{[\s\S]*flex:\s*1 1 auto/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.desktop-navigation-panel\s*\{[\s\S]*display:\s*block\s*!important/,
  );
});
