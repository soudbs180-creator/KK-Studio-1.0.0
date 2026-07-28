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
  assert.match(source, /setActiveMode\('canvas'\);[\s\S]*onCloseAssistant\(\)/);
  assert.match(source, /setActiveMode\('create'\);[\s\S]*onCloseAssistant\(\)/);
  assert.doesNotMatch(source, /frost|clay/i);
});

test('workspace and mobile shells opt into the shared dark system', () => {
  const workspaceSource = readSource('apps/web/src/components/workspace/WorkspaceShell.tsx');
  const mobileShellSource = readSource('apps/web/src/components/mobile/MobileAppShell.tsx');
  const mobileHeaderSource = readSource('apps/web/src/components/mobile/MobileHeader.tsx');
  const mobileTabsSource = readSource('apps/web/src/components/mobile/MobileTabBar.tsx');

  assert.match(workspaceSource, /kk-morphic-workspace/);
  assert.match(mobileShellSource, /mobile-app-shell/);
  assert.match(mobileHeaderSource, /kk-mobile-header-surface/);
  assert.match(mobileTabsSource, /mobile-tab-bar/);
  assert.doesNotMatch(mobileHeaderSource, /mobile-clay/i);
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
});
