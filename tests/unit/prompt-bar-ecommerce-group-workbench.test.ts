import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PromptBar ecommerce panel keeps group context and exposes group overview, main-card edit, and module edit workbench states', () => {
  const appSource = readSource('src/App.tsx');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(promptBarSource, /ecommerceActiveGroupSheet/);
  assert.match(promptBarSource, /onActivateEcommerceTaskBySourceKey/);
  assert.match(promptBarSource, /onSetEcommerceActiveGroupSheet/);

  assert.match(desktopPanelSource, /activeGroupSheet/);
  assert.match(desktopPanelSource, /onActivateTaskBySourceKey/);
  assert.match(desktopPanelSource, /onSetActiveGroupSheet/);
  assert.match(desktopPanelSource, /data-testid="ecommerce-group-overview-workbench"/);
  assert.match(desktopPanelSource, /data-testid="ecommerce-main-card-edit-workbench"/);
  assert.match(desktopPanelSource, /data-testid="ecommerce-module-edit-workbench"/);
  assert.match(desktopPanelSource, /组总览/);
  assert.match(desktopPanelSource, /主卡编辑/);
  assert.match(desktopPanelSource, /模块编辑/);
  assert.match(desktopPanelSource, /主图组/);
  assert.match(desktopPanelSource, /A\+组/);

  assert.match(appSource, /activeGroupSheet/);
  assert.match(appSource, /handleActivateEcommerceTaskBySourceKey/);
  assert.match(appSource, /handleSetEcommerceActiveGroupSheet/);
  assert.doesNotMatch(appSource, /selectedItems:\s*\{\}/);
  assert.doesNotMatch(appSource, /taskStates:\s*\{\}/);
});
