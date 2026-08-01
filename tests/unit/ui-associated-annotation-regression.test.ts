import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('mobile settings uses four discrete metrics and one explicit language action', () => {
  const dashboardSource = readSource('apps/web/src/components/settings/SettingsMobileDashboard.tsx');
  const settingsStyles = readSource('apps/web/src/styles/settings-v3.css');

  assert.match(dashboardSource, /data-metric-card=\{metric\.id\}/);
  assert.doesNotMatch(
    dashboardSource,
    /settings-mobile-quick-control__label[\s\S]{0,220}<strong>\{routeOptions/,
  );
  assert.match(dashboardSource, /aria-label=\{pick\('切换 EN', '切换中文'\)\}/);
  assert.match(dashboardSource, /\{pick\('切换 EN', '切换中文'\)\}/);
  assert.match(settingsStyles, /\.settings-mobile-metric-grid[\s\S]*gap:\s*8px/);
  assert.match(settingsStyles, /\.settings-mobile-metric[\s\S]*border:\s*1px solid var\(--console-border\)/);
});

test('settings shared selections expose separators, selected highlight, and one switch geometry', () => {
  const uiSource = readSource('apps/web/src/components/settings/ui/index.tsx');
  const settingsStyles = readSource('apps/web/src/styles/settings-v3.css');

  assert.match(uiSource, /SETTINGS_CONTROL_MENU_OPTION_CLASSNAME/);
  assert.match(settingsStyles, /settings-system-control-menu-option\s*\+\s*\.settings-system-control-menu-option/);
  assert.match(settingsStyles, /settings-system-control-menu-option\[data-state='selected'\][\s\S]*var\(--kk-morphic-action\)/);
  assert.match(settingsStyles, /settings-mobile-segment button\s*\+\s*button[\s\S]*border-left/);
  assert.match(settingsStyles, /settings-mobile-segment button\[data-state='selected'\][\s\S]*var\(--kk-morphic-action\)/);
  assert.match(settingsStyles, /settings-browser-tab\s*\+\s*\.settings-browser-tab[\s\S]*border-left/);
  assert.match(settingsStyles, /settings-system-switch[\s\S]*width:\s*44px !important/);
});

test('mobile settings restores the dashboard scroll position when returning from a nested view', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');

  assert.match(shellSource, /dashboardScrollTopRef/);
  assert.match(shellSource, /scrollContainer\.scrollTop/);
  assert.match(shellSource, /requestAnimationFrame/);
});

test('mobile more sheet orders project theme and settings before content destinations', () => {
  const surfaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');

  assert.doesNotMatch(surfaceSource, /Languages/);
  assert.match(surfaceSource, /当前项目[\s\S]*主题切换[\s\S]*mobile-more-menu-settings/);
  assert.match(surfaceSource, /mobile-more-menu-favorites[\s\S]*定位项目内容[\s\S]*电商生图[\s\S]*聊天/);
});

test('mobile result dock has one-line task status plus density and two locate actions', () => {
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const workspaceStyles = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(feedSource, /onOpenSearch\?: \(\) => void/);
  assert.match(feedSource, /aria-label=\{pick\('定位项目卡片', 'Locate project cards'\)\}/);
  assert.match(feedSource, /aria-label=\{pick\('回到底部', 'Scroll to Bottom'\)\}/);
  assert.match(feedSource, /kk-mobile-generation-status__line/);
  assert.doesNotMatch(feedSource, /kk-mobile-generation-status__meta/);
  assert.match(workspaceStyles, /\.kk-result-command-row[\s\S]*grid-template-columns/);
});

test('composer count is a shared 1 to 10 slider and ratio options stay equal-sized', () => {
  const countSource = readSource('apps/web/src/components/layout/prompt-bar/ComposerGenerationCountField.tsx');
  const imageOptionsSource = readSource('apps/web/src/components/image/ImageOptionsPanel.tsx');

  assert.match(countSource, /type="range"/);
  assert.match(countSource, /min=\{1\}/);
  assert.match(countSource, /max=\{10\}/);
  assert.match(countSource, /aria-valuetext=\{`\$\{normalizedCount\} 张`\}/);
  assert.doesNotMatch(countSource, /\[1, 2, 3, 4\]/);
  assert.doesNotMatch(imageOptionsSource, /width:\s*'58px'/);
  assert.match(imageOptionsSource, /grid-auto-fit/);
});

test('copilot condenses context into the header and keeps collaboration mode in parameter config', () => {
  const chatSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const workspaceStyles = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(chatSource, /kk-chat-context-ring/);
  assert.match(chatSource, /kk-chat-composer-parameters/);
  assert.match(chatSource, /参数配置/);
  assert.match(chatSource, /<AITakeoverToggle/);
  assert.match(workspaceStyles, /\.kk-chat-context-ring/);
  assert.match(workspaceStyles, /\.kk-chat-history-panel/);
});

test('mobile ecommerce is product-first with a compact platform profile and existing AI analysis action', () => {
  const ecommerceSource = readSource('apps/web/src/components/mobile/MobileEcommercePanel.tsx');

  assert.match(ecommerceSource, /pick\('电商生成', 'E-commerce Generation'\)/);
  assert.match(ecommerceSource, /mobile-ecommerce-product-brief/);
  assert.match(ecommerceSource, /mobile-ecommerce-commerce-profile/);
  assert.match(ecommerceSource, /AI 自动优化/);
  assert.match(ecommerceSource, /handleGenerateSubmit/);
  assert.doesNotMatch(ecommerceSource, /AI 智能电商极速看板/);
});
