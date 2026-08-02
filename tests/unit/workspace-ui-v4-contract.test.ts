import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('desktop workspace chrome is three independent frosted clusters without a full-width backing', () => {
  const bootstrap = readSource('apps/web/src/bootstrap.tsx');
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(bootstrap, /workspace-ui-v4\.css/);
  assert.match(styles, /\.kk-workspace-chrome-v3\s*\{[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/);
  assert.match(styles, /\.kk-workspace-chrome-v3__project,[\s\S]*\.kk-workspace-chrome-v3__canvas,[\s\S]*\.kk-workspace-chrome-v3__account[\s\S]*backdrop-filter:/);
  assert.match(styles, /#btn-desktop-recharge[\s\S]*margin-inline-end:/);
});

test('task center and project menu are anchored floating surfaces that do not reflow the composer', () => {
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(styles, /\.kk-task-center-host:not\(\[data-mobile='true'\]\)[\s\S]*top:\s*56px/);
  assert.match(styles, /\.kk-task-center-morph\[data-state='open'\][\s\S]*width:\s*360px[\s\S]*max-height:\s*70vh/);
  assert.match(styles, /\.kk-morphic-project-panel\[data-desktop-persistent='true'\][\s\S]*--kk-project-panel-left[\s\S]*backdrop-filter:/);
  assert.doesNotMatch(styles, /body:has\(\.kk-morphic-project-panel\)\s+#prompt-bar-container/);
});

test('desktop AI assistant uses the same frosted composer structure without touching canvas navigation', () => {
  const workspacePage = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.match(styles, /#ai-assistant-sidebar\s*\{[\s\S]*top:\s*12px[\s\S]*right:\s*12px[\s\S]*bottom:\s*12px[\s\S]*border-radius:\s*20px/);
  assert.match(styles, /#ai-assistant-sidebar \.kk-chat-sidebar-composer\s*\{[\s\S]*border-radius:\s*16px[\s\S]*background:\s*var\(--kk-morphic-control\)/);
  assert.match(workspacePage, /'--kk-canvas-navigation-right':\s*isChatOpen[\s\S]*chatSidebarWidth \+ 24/);
});
