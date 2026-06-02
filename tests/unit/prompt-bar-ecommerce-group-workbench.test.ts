import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('PromptBar ecommerce panel keeps review controls before confirmation and leaves post-build editing on canvas', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const canvasWorkbenchSource = readSource('apps/web/src/components/ecommerce/EcommerceCanvasWorkbenchCard.tsx');

  assert.match(promptBarSource, /ecommerceActiveGroupSheet/);
  assert.match(promptBarSource, /ecommerceAnalysisConfirmed/);
  assert.match(promptBarSource, /onActivateEcommerceTaskBySourceKey/);
  assert.match(promptBarSource, /onActivateEcommerceGroupSheet/);
  assert.match(promptBarSource, /onPreviewEcommerceSlotHistory/);

  assert.match(desktopPanelSource, /activeGroupSheet/);
  assert.match(desktopPanelSource, /analysisConfirmed/);
  assert.match(desktopPanelSource, /if \(analysisConfirmed\) \{\s*return null;\s*\}/);
  assert.match(desktopPanelSource, /onActivateTaskBySourceKey/);
  assert.match(desktopPanelSource, /onActivateGroupSheet/);
  assert.match(desktopPanelSource, /onPreviewSlotHistory/);
  assert.doesNotMatch(desktopPanelSource, /ecommerce-group-overview-workbench/);
  assert.doesNotMatch(desktopPanelSource, /ecommerce-main-card-edit-workbench/);
  assert.doesNotMatch(desktopPanelSource, /ecommerce-module-edit-workbench/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-panel/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-current/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-all/);
  assert.match(canvasWorkbenchSource, /data-testid="ecommerce-canvas-framework-task-list"/);
  assert.match(canvasWorkbenchSource, /data-testid="ecommerce-canvas-framework-task-editor"/);
});
