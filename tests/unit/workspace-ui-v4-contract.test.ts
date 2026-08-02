import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('desktop workspace chrome is three independent frosted clusters without a full-width backing', () => {
  const bootstrap = readSource('apps/web/src/bootstrap.tsx');
  const main = readSource('apps/web/src/main.tsx');
  const chrome = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(bootstrap, /workspace-ui-v4\.css/);
  assert.match(main, /workspace-ui-v4\.css/);
  assert.match(styles, /\.desktop-left-chrome\s*\{[\s\S]*background:\s*transparent\s*!important/);
  assert.match(styles, /\.kk-workspace-chrome-v3\s*\{[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/);
  assert.match(styles, /\.kk-workspace-chrome-v3__project,[\s\S]*\.kk-workspace-chrome-v3__canvas,[\s\S]*\.kk-workspace-chrome-v3__account[\s\S]*backdrop-filter:/);
  assert.match(styles, /#btn-desktop-recharge[\s\S]*margin-inline-end:/);
  assert.match(chrome, /requestTaskCenterToggle/);
  assert.doesNotMatch(chrome, /<small>项目<\/small>/);
});

test('task center and project menu are anchored floating surfaces that do not reflow the composer', () => {
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(styles, /\.kk-task-center-host:not\(\[data-mobile='true'\]\)[\s\S]*top:\s*52px/);
  assert.match(styles, /\.kk-task-center-morph\[data-state='open'\][\s\S]*transform:\s*translateY\(0\)\s*!important/);
  assert.match(styles, /\.kk-task-center-morph\[data-state='open'\][\s\S]*width:\s*360px[\s\S]*max-height:\s*70vh/);
  assert.match(styles, /\.kk-morphic-project-panel\[data-desktop-persistent='true'\][\s\S]*--kk-project-panel-left[\s\S]*backdrop-filter:/);
  assert.doesNotMatch(styles, /body:has\(\.kk-morphic-project-panel\)\s+#prompt-bar-container/);
});

test('desktop account actions and composer send keep the requested lightweight geometry', () => {
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(styles, /#btn-desktop-settings\s*\{[\s\S]*background:\s*transparent\s*!important[\s\S]*border:\s*0\s*!important/);
  assert.match(styles, /\.kk-composer-compact-footer \.prompt-bar-liquid-send\s*\{[\s\S]*border:\s*1px solid/);
});

test('desktop AI assistant uses the same frosted composer structure without touching canvas navigation', () => {
  const workspacePage = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(styles, /body\[data-kk-workspace-mode='copilot'\]\s+#ai-assistant-sidebar\s*\{[\s\S]*top:\s*48px[\s\S]*right:\s*10px[\s\S]*bottom:\s*10px[\s\S]*left:\s*auto[\s\S]*width:\s*min\(420px,[\s\S]*max-width:\s*calc\(100vw - 24px\)/);
  assert.match(styles, /\.desktop-navigation-panel\s*\{[\s\S]*right:\s*var\(--kk-canvas-navigation-right,\s*10px\)[\s\S]*bottom:\s*10px/);
  assert.match(styles, /#ai-assistant-sidebar \.kk-chat-sidebar-composer\s*\{[\s\S]*border-radius:\s*16px[\s\S]*background:\s*var\(--kk-morphic-control\)/);
  assert.match(workspacePage, /'--kk-canvas-navigation-right':\s*isChatOpen[\s\S]*chatSidebarWidth \+ 24[\s\S]*:\s*'10px'/);
});

test('collapsed and expanded minimap reuse one navigation bar', () => {
  const source = readSource('apps/web/src/app/AppCanvasNavigationPanel.tsx');

  assert.match(source, /const CanvasNavigationBar/);
  assert.equal((source.match(/<CanvasNavigationBar(?:\s|\n)/g) || []).length, 2);
});

test('favorites use an opaque-enough frosted card instead of exposing the canvas grid', () => {
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(styles, /\.workspace-favorites-card\s*\{[\s\S]*backdrop-filter:\s*blur\(28px\)/);
  assert.match(styles, /\.workspace-favorites-card\s*\{[\s\S]*background-image:\s*none/);
});
