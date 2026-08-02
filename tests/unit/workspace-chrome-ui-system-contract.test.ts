import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('workspace chrome exposes shared tokens and reusable surface/control classes', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-workspace-chrome-bg',
    '--kk-workspace-chrome-border',
    '--kk-workspace-chrome-shadow',
    '--kk-workspace-control-bg',
    '--kk-workspace-control-hover-bg',
    '--kk-workspace-primary-bg',
    '--kk-workspace-danger-bg',
    '--kk-workspace-minimap-node-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-workspace-chrome-surface',
    '.kk-workspace-menu-surface',
    '.kk-workspace-control',
    '.kk-workspace-icon-control',
    '.kk-workspace-primary-action',
    '.kk-workspace-danger-action',
    '.kk-workspace-canvas-minimap',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }

  assert.match(cssSource, /\.kk-workspace-control\s*\{[\s\S]*min-height:\s*var\(--kk-touch-target-min\)/);
  assert.match(cssSource, /\.kk-workspace-icon-control\s*\{[\s\S]*min-width:\s*var\(--kk-touch-target-min\)/);
  assert.match(cssSource, /prefers-reduced-motion[\s\S]*\.kk-workspace-chrome-surface/);
});

test('desktop workspace chrome and minimap consume the shared chrome system', () => {
  const desktopChromeSource = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const minimapSource = readSource('apps/web/src/app/AppCanvasNavigationPanel.tsx');

  assert.match(desktopChromeSource, /className="kk-workspace-chrome-surface/);
  assert.match(desktopChromeSource, /className="kk-workspace-menu-surface/);
  assert.match(desktopChromeSource, /className="kk-workspace-control/);
  assert.match(desktopChromeSource, /className="kk-workspace-icon-control/);
  assert.match(desktopChromeSource, /className="kk-workspace-danger-action/);
  assert.match(desktopChromeSource, /data-chrome-region="project"/);
  assert.match(desktopChromeSource, /data-chrome-region="tasks"/);
  assert.match(desktopChromeSource, /data-chrome-region="account"/);
  assert.match(desktopChromeSource, /requestTaskCenterOpen/);
  assert.doesNotMatch(desktopChromeSource, /data-composer-copilot-toggle="true"/);
  assert.match(promptBarSource, /data-composer-copilot-toggle="true"/);
  assert.match(promptBarSource, /className="kk-composer-assistant-toggle"/);
  assert.doesNotMatch(desktopChromeSource, /bg-red-500\/10|text-red-400|hover:bg-red-500\/10/);
  assert.doesNotMatch(desktopChromeSource, /0 4px 12px rgba\(255, 107, 90, 0\.35\)|#ff5240/);

  assert.match(minimapSource, /className="kk-workspace-chrome-surface canvas-nav-panel/);
  assert.match(minimapSource, /className="kk-workspace-canvas-minimap/);
  assert.match(minimapSource, /className="kk-workspace-icon-control/);
  assert.doesNotMatch(minimapSource, /hover:bg-\[rgba\(255,255,255,0\.06\)\]/);
  assert.doesNotMatch(minimapSource, /background:\s*'rgba\(0, 0, 0, 0\.12\)'/);
});

test('chat sidebar joins the workspace chrome shell instead of defining a parallel floating surface', () => {
  const source = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(source, /className=\{`fixed kk-workspace-sidebar kk-workspace-chrome-surface/);
  assert.match(source, /className="kk-workspace-edge-toggle/);
  assert.match(source, /className="kk-workspace-icon-control/);
  assert.match(source, /zIndex:\s*KK_LAYER\.drawer/);
  assert.doesNotMatch(source, /z-\[200000\]/);
});
