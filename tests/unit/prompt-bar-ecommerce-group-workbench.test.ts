import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PromptBar ecommerce panel exposes group overview, edit workbench, and slot history entrypoints', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(promptBarSource, /ecommerceActiveGroupSheet/);
  assert.match(promptBarSource, /ecommerceAnalysisConfirmed/);
  assert.match(promptBarSource, /onActivateEcommerceTaskBySourceKey/);
  assert.match(promptBarSource, /onActivateEcommerceGroupSheet/);
  assert.match(promptBarSource, /onPreviewEcommerceSlotHistory/);

  assert.match(desktopPanelSource, /activeGroupSheet/);
  assert.match(desktopPanelSource, /analysisConfirmed/);
  assert.match(desktopPanelSource, /onActivateTaskBySourceKey/);
  assert.match(desktopPanelSource, /onActivateGroupSheet/);
  assert.match(desktopPanelSource, /onPreviewSlotHistory/);
  assert.match(desktopPanelSource, /ecommerce-group-overview-workbench/);
  assert.match(desktopPanelSource, /ecommerce-main-card-edit-workbench/);
  assert.match(desktopPanelSource, /ecommerce-module-edit-workbench/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-panel/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-current/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-all/);
});
