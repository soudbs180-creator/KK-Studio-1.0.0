import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('desktop workspace chrome exposes the three approved product modes', () => {
  const source = readSource('apps/web/src/app/AppDesktopChrome.tsx');

  assert.match(source, /className="kk-morphic-mode-switch"/);
  assert.match(source, />\s*画布\s*</);
  assert.match(source, />\s*Copilot\s*</);
  assert.match(source, />\s*创作\s*</);
  assert.match(source, /onCloseAssistant:\s*\(\) => void/);
  assert.match(source, /activeMode:\s*'canvas'\s*\|\s*'copilot'\s*\|\s*'create'/);
  assert.match(source, /onOpenCanvasWorkspace\(\);[\s\S]*focusWorkspaceCanvas\(\)/);
  assert.match(source, /onOpenCreateWorkspace\(\);[\s\S]*focusWorkspaceComposer/);
  assert.match(source, /document\.body\.dataset\.kkWorkspaceMode = activeMode/);
  assert.match(source, /input\[placeholder="搜索历史记录\.\.\."\]/);
  assert.match(
    source,
    /id="desktop-user-menu-panel"[\s\S]*className="[^"]*fixed right-3 top-\[52px\]/,
  );
  assert.doesNotMatch(
    source,
    /id="desktop-user-menu-panel"[\s\S]*className="[^"]*fixed left-4/,
  );
  assert.doesNotMatch(source, /frost|clay/i);
});

test('desktop project and workflow panels escape the scroll rail clipping boundary', () => {
  const source = readSource('apps/web/src/components/settings/ProjectManager.tsx');

  assert.match(source, /ReactDOM\.createPortal\(\s*projectDropdown/);
  assert.match(source, /ReactDOM\.createPortal\(\s*workflowDropdown/);
  assert.match(source, /kk-morphic-project-panel[\s\S]*top-\[48px\]/);
  assert.match(source, /kk-morphic-workflow-panel/);
  assert.match(source, /aria-label="关闭工作流"/);
});

test('workspace and mobile shells opt into the shared dark system', () => {
  const workspaceSource = readSource('apps/web/src/components/workspace/WorkspaceShell.tsx');
  const mobileShellSource = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');
  const mobileHeaderSource = readSource('apps/web/src/components/mobile/MobileHeader.tsx');
  const mobileTabsSource = readSource('apps/web/src/components/mobile/MobileTabBar.tsx');
  const mobileWorkspaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');

  assert.match(workspaceSource, /kk-morphic-workspace/);
  assert.match(mobileShellSource, /mobile-app-shell/);
  assert.match(mobileHeaderSource, /kk-mobile-header-surface/);
  assert.match(mobileTabsSource, /mobile-tab-bar/);
  assert.match(mobileWorkspaceSource, /kk-mobile-more-sheet__panel/);
  assert.doesNotMatch(mobileHeaderSource, /mobile-clay/i);
  assert.doesNotMatch(mobileWorkspaceSource, /mobile-clay|linear-gradient/i);
});

test('landing does not render decorative CSS-art placeholders', () => {
  const source = readSource('apps/web/src/landing/KkLandingPage.tsx');

  assert.doesNotMatch(source, /kk-landing-continuous-stage|kk-landing-noise/);
  assert.doesNotMatch(source, /kk-landing-work-card__image/);
  assert.doesNotMatch(source, /kk-landing-footer__flower/);
});

test('responsive stylesheet explicitly guards every required QA viewport', () => {
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  for (const viewport of [375, 390, 430, 768]) {
    assert.match(
      cssSource,
      new RegExp(`@media\\s*\\(max-width:\\s*${viewport}px\\)`),
      `missing ${viewport}px responsive guard`,
    );
  }

  assert.match(cssSource, /\.auth-modal-content\s*\{[\s\S]*--kk-morphic-dialog-width/);
  assert.match(cssSource, /width:\s*min\(88vw,\s*320px\)/);
  assert.match(cssSource, /width:\s*calc\(100vw - 16px\)/);
  assert.match(
    cssSource,
    /\.kk-task-center-host:not\(\[data-mobile='true'\]\)\s*\{[\s\S]*--kk-morphic-topbar-height/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar[\s\S]*left:\s*12px/,
  );
  assert.match(
    cssSource,
    /\.kk-morphic-project-panel\s*\{[\s\S]*--toolbar-active:\s*var\(--kk-morphic-control-hover\)/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar\s*\{[\s\S]*--primary-light:\s*var\(--kk-morphic-control-hover\)/,
  );
  assert.match(
    cssSource,
    /#prompt-bar-container\s+\.input-bar-inner\s*\{[\s\S]*overflow-y:\s*auto\s*!important/,
  );
  assert.match(
    cssSource,
    /\.settings-panel\s+\.settings-hero-flat-header[\s\S]*box-shadow:\s*none\s*!important/,
  );
  assert.match(
    cssSource,
    /\.kk-landing-work-pill\s*\{[\s\S]*position:\s*static\s*!important/,
  );
});
