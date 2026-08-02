import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('narrow desktop controls stay compact while mobile keeps touch sizing', () => {
  const geometrySource = readSource('apps/web/src/styles/morphic-button-geometry.css');
  const workspaceShellSource = readSource('apps/web/src/components/workspace/WorkspaceShell.tsx');

  assert.match(
    geometrySource,
    /\.kk-morphic-workspace:not\(\.ios-mobile-shell\) \.kk-workspace-icon-control\s*\{[\s\S]*width:\s*30px\s*!important[\s\S]*height:\s*30px\s*!important/,
  );
  assert.match(
    geometrySource,
    /\.kk-morphic-workspace:not\(\.ios-mobile-shell\) \.kk-morphic-function-button\s*\{[\s\S]*min-height:\s*30px/,
  );
  assert.doesNotMatch(workspaceShellSource, /kk-canvas-dot-grid/);
});

test('canvas navigation keeps the zoom rail and map compact', () => {
  const navigationSource = readSource('apps/web/src/app/AppCanvasNavigationPanel.tsx');
  const workspaceStyleSource = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(navigationSource, /const miniWidth = 248;/);
  assert.match(navigationSource, /const miniHeight = 138;/);
  assert.match(workspaceStyleSource, /\[data-canvas-navigation-bar='true'\] \.kk-workspace-icon-control\s*\{[\s\S]*width:\s*26px\s*!important/);
});
