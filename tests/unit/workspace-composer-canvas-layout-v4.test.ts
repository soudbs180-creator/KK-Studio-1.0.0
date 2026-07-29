import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('Copilot expands inside the composer and remains a right-side canvas companion', () => {
  const chrome = readSource('apps/web/src/app/AppDesktopChrome.tsx');
  const promptBar = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const workspace = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const css = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.doesNotMatch(chrome, /data-composer-copilot-toggle="true"/);
  assert.match(promptBar, /onToggleAssistant\?:\s*\(\)\s*=>\s*void/);
  assert.match(promptBar, /data-composer-copilot-toggle="true"/);
  assert.match(workspace, /onToggleAssistant:\s*toggleChatPanel/);
  assert.match(
    css,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar\s*\{[\s\S]*left:\s*auto\s*!important[\s\S]*width:\s*min\(420px/,
  );
  assert.match(
    css,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar\s*>\s*\.w-full\.h-full\s*\{[\s\S]*display:\s*flex\s*!important[\s\S]*flex-direction:\s*column/,
  );
});

test('project popover aligns below the top chrome with a visible gap', () => {
  const projectManager = readSource('apps/web/src/components/settings/ProjectManager.tsx');

  assert.match(projectManager, /fixed left-3 top-\[52px\] w-\[262px\]/);
});

test('workflow requests survive lazy mounting and composer tools expose canvas layout modes', () => {
  const events = readSource('apps/web/src/components/layout/prompt-bar/composerEvents.ts');
  const projectManager = readSource('apps/web/src/components/settings/ProjectManager.tsx');
  const tools = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerPromptTools.tsx');

  assert.match(events, /requestWorkflowBrowser/);
  assert.match(events, /subscribeWorkflowBrowser/);
  assert.match(projectManager, /subscribeWorkflowBrowser/);
  assert.match(tools, /data-canvas-layout-mode="row"/);
  assert.match(tools, /data-canvas-layout-mode="column"/);
  assert.match(tools, /思维导图/);
  assert.match(tools, /瀑布式/);
});

test('normal projects keep stable full cards while canvas pan and zoom are active', () => {
  const performance = readSource('apps/web/src/canvas/performanceProfile.ts');
  const imageRenderer = readSource('apps/web/src/core/canvas/renderers/ImageGenerationGroupRenderer.tsx');
  const videoRenderer = readSource('apps/web/src/core/canvas/renderers/VideoGenerationGroupRenderer.tsx');

  assert.match(
    performance,
    /if\s*\(projectSize\s*!==\s*'normal'\s*&&\s*zoomBand\s*===\s*'tiny'\)/,
  );
  assert.match(imageRenderer, /isCanvasTransforming=\{false\}/);
  assert.match(videoRenderer, /isCanvasTransforming=\{false\}/);
});

test('selection arrange menu names the user-facing waterfall and mind-map modes', () => {
  const selectionMenu = readSource('apps/web/src/components/canvas/SelectionMenu.tsx');
  const presentation = readSource('apps/web/src/context/canvasPresentationMigration.ts');

  assert.match(selectionMenu, /data-canvas-layout-mode="row"/);
  assert.match(selectionMenu, /data-canvas-layout-mode="column"/);
  assert.match(selectionMenu, /思维导图/);
  assert.match(selectionMenu, /瀑布式/);
  assert.match(
    presentation,
    /layoutMode\s*===\s*'row'[\s\S]*source:\s*'right',\s*target:\s*'left'[\s\S]*source:\s*'bottom',\s*target:\s*'top'/,
  );
});

test('Canvas V3 keeps one explicit catalog for every persisted card presentation', () => {
  const catalog = readSource('apps/web/src/canvas/v3/cardCatalog.ts');
  const shell = readSource('apps/web/src/components/canvas/CanvasCardShell.tsx');

  for (const kind of [
    'prompt-result-group',
    'prompt-only',
    'media-only',
    'ecommerce',
    'ppt-deck',
    'audio',
    'text',
    'notebook',
    'multi-image',
    'workflow-panel',
    'unknown',
  ]) {
    assert.match(catalog, new RegExp(`'${kind}'`));
  }
  assert.match(shell, /getCanvasCardDefinition/);
  assert.match(shell, /data-card-family=\{definition\.family\}/);
  assert.match(shell, /data-card-density="stable"/);
});
