import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('mobile workspace removes the persistent four-item navigation and releases its safe area', () => {
  const workspace = readSource('apps/web/src/app/AppMobileWorkspace.tsx');
  const shell = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');

  assert.doesNotMatch(workspace, /MobileTabBar/);
  assert.doesNotMatch(workspace, /mobileNavigation/);
  assert.doesNotMatch(shell, /--mobile-tabbar-height|--mobile-tabbar-total-height/);
  assert.doesNotMatch(shell, /env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*64px/);
  assert.match(shell, /paddingBottom:\s*'env\(safe-area-inset-bottom,\s*0px\)'/);
});

test('mobile result footer reports image count and generation task progress in one compact status surface', () => {
  const resultFeed = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');

  assert.match(resultFeed, /const pendingTaskCount =/);
  assert.match(resultFeed, /const failedTaskCount =/);
  assert.match(resultFeed, /const completedTaskCount =/);
  assert.match(resultFeed, /data-testid="mobile-generation-task-status"/);
  assert.match(resultFeed, /aria-valuenow=\{completedTaskCount\}/);
  assert.match(resultFeed, /--mobile-task-progress/);
});

test('desktop chrome has project, canvas and account regions only and owns the composer Copilot expansion', () => {
  const chrome = readSource('apps/web/src/app/AppDesktopChrome.tsx');

  assert.match(chrome, /data-chrome-region="project"/);
  assert.match(chrome, /data-chrome-region="canvas"/);
  assert.match(chrome, /data-chrome-region="account"/);
  assert.match(chrome, /activeCanvas\?\.name \|\| '项目 1'/);
  assert.match(chrome, /data-composer-copilot-toggle="true"/);
  assert.match(chrome, /onOpenAssistant/);
  assert.match(chrome, /onCloseAssistant/);
  assert.doesNotMatch(chrome, /kk-morphic-mode-switch/);
  assert.doesNotMatch(chrome, />Copilot</);
  assert.doesNotMatch(chrome, />创作</);
});

test('canvas rail owns modes and theme while the bottom navigation owns view actions', () => {
  const projectManager = readSource('apps/web/src/components/settings/ProjectManager.tsx');
  const canvasNavigation = readSource('apps/web/src/app/AppCanvasNavigationPanel.tsx');

  assert.match(projectManager, /data-canvas-interaction-mode="normal"/);
  assert.match(projectManager, /data-canvas-interaction-mode="board"/);
  assert.match(projectManager, /data-canvas-grid-toggle="true"/);
  assert.match(projectManager, /data-canvas-theme-toggle="true"/);
  assert.match(projectManager, /useTheme\(\)/);
  assert.doesNotMatch(projectManager, /PROJECT_MANAGER_ACTIONS\.(fitToAll|resetView|autoArrange)\.uiAction/);
  assert.match(canvasNavigation, /data-canvas-minimap-popover="true"/);
  assert.match(canvasNavigation, /data-canvas-navigation-action="fitToAll"/);
  assert.match(canvasNavigation, /data-canvas-navigation-action="resetView"/);
  assert.match(canvasNavigation, /data-canvas-navigation-action="autoArrange"/);
  assert.doesNotMatch(projectManager, /className="kk-canvas-view-tools/);
});

test('shared UI tokens define five text levels, three icon levels and semantic color roles', () => {
  const tokenSource = readSource('packages/ui/src/core/tokens.ts');
  const workspaceCss = readSource('apps/web/src/styles/workspace-ui-v3.css');

  for (const typographyToken of ['display', 'title', 'body', 'button', 'caption']) {
    assert.match(tokenSource, new RegExp(`${typographyToken}:`));
  }
  for (const iconToken of ['feature', 'button', 'assist']) {
    assert.match(tokenSource, new RegExp(`${iconToken}:`));
  }
  for (const colorToken of ['content', 'accent', 'support', 'success', 'warning', 'danger']) {
    assert.match(tokenSource, new RegExp(`${colorToken}:`));
  }
  assert.match(workspaceCss, /--kk-type-display:/);
  assert.match(workspaceCss, /--kk-icon-feature:/);
});

test('settings V3 uses one responsive spacing system and prevents same-level typography drift', () => {
  const workbench = readSource('apps/web/src/components/settings/SettingsWorkbenchPanel.tsx');
  const settingsCss = readSource('apps/web/src/styles/settings-v3.css');

  assert.match(workbench, /settings-v3\.css/);
  assert.match(settingsCss, /--settings-v3-section-gap:/);
  assert.match(settingsCss, /--settings-v3-card-padding:/);
  assert.match(settingsCss, /\.settings-console-content :where\(/);
  assert.match(settingsCss, /\.settings-console :where\(button, input, textarea, select\)/);
  assert.match(settingsCss, /@media \(max-width: 767px\)/);
  assert.doesNotMatch(settingsCss, /#[0-9a-fA-F]{3,8}|rgba?\(/);
});

test('responsive browser QA verifies the simple mobile surface instead of reopening the removed tab bar', () => {
  const responsiveSmoke = readSource('scripts/test/verify-canvas-responsive-cdp.mjs');

  assert.doesNotMatch(responsiveSmoke, /clickMobileTab|verifyMobileCanvasDrag/);
  assert.match(responsiveSmoke, /mobilePrimaryNavigation/);
  assert.match(responsiveSmoke, /mobileTaskStatusVisible/);
  assert.match(responsiveSmoke, /chromeRegionCount/);
  assert.match(responsiveSmoke, /verifyComposerCopilotToggle/);
  assert.match(responsiveSmoke, /verifyCanvasNavigationExpansion/);
  assert.match(responsiveSmoke, /chatComposerVisible/);
  assert.match(responsiveSmoke, /navigationRightInset/);
  assert.match(responsiveSmoke, /Math\.abs\(metrics\.railWidth - 38\)/);
});
