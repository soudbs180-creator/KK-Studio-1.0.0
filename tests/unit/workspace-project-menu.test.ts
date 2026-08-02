import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeProjectPanelLeft } from '../../apps/web/src/components/settings/projectPanelPosition.ts';
import { readSource } from '../support/workspacePaths.js';

test('project menu follows the top project control while staying inside the viewport', () => {
  assert.equal(computeProjectPanelLeft(24, 262, 1099), 24);
  assert.equal(computeProjectPanelLeft(1020, 262, 1099), 825);
  assert.equal(computeProjectPanelLeft(-30, 262, 1099), 12);
});

test('desktop project menu opens through one shared event without a backdrop or a duplicate rail trigger', () => {
  const chrome = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const manager = readSource('apps/web/src/components/settings/ProjectManager.tsx');

  assert.match(chrome, /requestProjectMenuToggle/);
  assert.match(manager, /PROJECT_MENU_TOGGLE_EVENT/);
  assert.equal((manager.match(/id="project-manager-trigger"/g) ?? []).length, 1);
  assert.doesNotMatch(manager, /title=\{activeProjectName\}/);
  assert.doesNotMatch(manager, /document\.body\.dataset\.kkCanvasGrid/);
});

test('canvas and board are represented by one stateful mode switch', () => {
  const manager = readSource('apps/web/src/components/settings/ProjectManager.tsx');
  const interactionModeControls = manager.match(/data-canvas-interaction-mode=/g) ?? [];

  assert.equal(interactionModeControls.length, 1);
  assert.match(manager, /canvasMode === 'board' \? <PenTool[\s\S]*: <MousePointer2/);
});
