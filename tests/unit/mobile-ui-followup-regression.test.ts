import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('mobile composer only collapses explicitly and lifts result controls above its measured height', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const resultFeedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const workspaceStyles = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.doesNotMatch(promptBarSource, /document\.addEventListener\('click', handleOutsideClick/);
  assert.match(promptBarSource, /收起创作提示词输入框/);
  assert.match(promptBarSource, /--kk-mobile-composer-dock-height/);
  assert.match(promptBarSource, /new ResizeObserver\(updateComposerDockHeight\)/);
  assert.match(promptBarSource, /window\.setTimeout\(updateComposerDockHeight,\s*200\)/);
  assert.match(
    workspaceStyles,
    /\[data-mobile-composer-section='mode-strip'\][\s\S]*:last-child[\s\S]*::before/,
  );
  assert.match(
    workspaceStyles,
    /:has\(\.kk-prompt-bar-mobile-expanded\)[\s\S]*\.kk-result-bottom-bar[\s\S]*--kk-mobile-composer-dock-height[\s\S]*24px/,
  );
  assert.doesNotMatch(resultFeedSource, /isInputActive\s*\?\s*'opacity-0 pointer-events-none translate-y-6'/);
});

test('mobile composer send is one accessible ArrowUp action without a hidden count gesture', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.match(
    promptBarSource,
    /if \(isMobile\)[\s\S]*aria-label=\{ecommerceConfirmedMode \? '补充修改' : '发送'\}[\s\S]*<ArrowUp/,
  );
  assert.doesNotMatch(promptBarSource, /kk-prompt-bar-count-bubble/);
  assert.doesNotMatch(promptBarSource, /sendTouchStart|isLongPressing/);
});

test('mobile action sheet gives every action a stable icon and copy column', () => {
  const workspaceStyles = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(workspaceStyles, /\.kk-mobile-more-action\s*>\s*svg[\s\S]*grid-row:\s*1\s*\/\s*3/);
  assert.match(workspaceStyles, /\.kk-mobile-more-action\s*>\s*div[\s\S]*min-width:\s*0/);
});

test('mobile settings reset scroll before rendering a new route and expose direct destinations', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const dashboardSource = readSource('apps/web/src/components/settings/SettingsMobileDashboard.tsx');

  assert.match(shellSource, /useLayoutEffect/);
  assert.match(shellSource, /scrollContainer\.scrollTop = 0/);
  assert.match(dashboardSource, /getSettingsNavItems/);
  assert.doesNotMatch(dashboardSource, /getSettingsModules/);
});

test('mobile chat, favorites, billing, and ecommerce use compact full-screen overrides', () => {
  const workspaceStyles = readSource('apps/web/src/styles/workspace-ui-v3.css');
  const settingsStyles = readSource('apps/web/src/styles/settings-v3.css');
  const ecommerceSource = readSource('apps/web/src/components/mobile/MobileEcommercePanel.tsx');

  assert.match(workspaceStyles, /\.kk-chat-sidebar-header/);
  assert.match(workspaceStyles, /\.kk-chat-sidebar-message-avatar[\s\S]*display:\s*none/);
  assert.match(workspaceStyles, /\.workspace-favorites-panel\.is-mobile[\s\S]*\.workspace-sheet-actions/);
  assert.match(workspaceStyles, /\.mobile-ecommerce-chip\s*>\s*span:last-child[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(settingsStyles, /\.console-table-empty[\s\S]*min-height:\s*112px/);
  assert.match(settingsStyles, /\.settings-console--desktop[\s\S]*\.settings-hero-flat-header[\s\S]*display:\s*none/);
  assert.match(settingsStyles, /\.settings-console--desktop[\s\S]*\.dashboard-console-header[\s\S]*display:\s*none/);
  assert.match(ecommerceSource, /关闭电商生图/);
});
