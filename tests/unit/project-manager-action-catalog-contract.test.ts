import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PROJECT_MANAGER_ACTIONS } from '../../apps/web/src/components/settings/settingsModuleActions.ts';
import { readSource } from '../support/workspacePaths.js';

const projectManagerSource = readSource('apps/web/src/components/settings/ProjectManager.tsx');
const canvasNavigationSource = readSource('apps/web/src/app/AppCanvasNavigationPanel.tsx');

test('Project Manager exposes its own settings action namespace', () => {
  const values = Object.values(PROJECT_MANAGER_ACTIONS).map((action) => action.uiAction);

  assert.deepEqual(values, Array.from(new Set(values)), 'Project Manager action names must be unique');

  for (const action of Object.values(PROJECT_MANAGER_ACTIONS)) {
    assert.ok(action.uiAction.startsWith('project-manager.'), `${action.uiAction} must stay Project Manager scoped`);
  }
});

test('Project Manager project-list and danger-zone controls expose project action metadata', () => {
  assert.match(projectManagerSource, /PROJECT_MANAGER_ACTIONS/);
  assert.doesNotMatch(projectManagerSource, /STORAGE_SETTINGS_ACTIONS/);
  assert.doesNotMatch(projectManagerSource, /API_MANAGEMENT_ACTIONS/);

  for (const key of [
    'openProjectMenu',
    'selectProject',
    'renameProject',
    'requestDeleteProject',
    'createProject',
    'downloadProjectOriginals',
    'openMergeModal',
    'cleanupInvalidCards',
    'clearCurrentProjectData',
    'cancelDeleteProject',
    'confirmDeleteProject',
    'closeMergeModal',
    'mergeIntoCurrentProject',
  ] as const) {
    assert.match(
      projectManagerSource,
      new RegExp(`data-project-manager-action=\\{PROJECT_MANAGER_ACTIONS\\.${key}\\.uiAction\\}`),
      `Project Manager should mark ${key}`
    );
  }
});

test('Project Manager shell and canvas controls expose project action metadata', () => {
  for (const key of [
    'openSearch',
    'openFavorites',
    'toggleCanvasMode',
    'toggleTheme',
    'addWorkflowPreviewCard',
    'addWorkflowSaveCard',
    'addWorkflowAgentCard',
    'applyWorkflowTemplate',
  ] as const) {
    assert.match(
      projectManagerSource,
      new RegExp(`data-project-manager-action=\\{PROJECT_MANAGER_ACTIONS\\.${key}\\.uiAction\\}`),
      `Project Manager should mark ${key}`
    );
  }

  for (const key of ['fitToAll', 'resetView'] as const) {
    assert.doesNotMatch(
      projectManagerSource,
      new RegExp(`data-project-manager-action=\\{PROJECT_MANAGER_ACTIONS\\.${key}\\.uiAction\\}`),
      `Project Manager rail should not duplicate ${key}`,
    );
    assert.doesNotMatch(canvasNavigationSource, new RegExp(`data-canvas-navigation-action="${key}"`));
  }

  assert.doesNotMatch(projectManagerSource, /PROJECT_MANAGER_ACTIONS\.autoArrange\.uiAction/);
  assert.match(canvasNavigationSource, /data-canvas-navigation-action="autoArrange"/);
  assert.match(canvasNavigationSource, /data-project-manager-action=\{PROJECT_MANAGER_ACTIONS\.autoArrange\.uiAction\}/);

  assert.doesNotMatch(
    projectManagerSource,
    /PROJECT_MANAGER_ACTIONS\.toggleWorkflowMenu\.uiAction/,
  );
});
