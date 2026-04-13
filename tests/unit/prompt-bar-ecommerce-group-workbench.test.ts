import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PromptBar ecommerce panel supports group overview, main-card edit, and module edit workbench modes', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const panelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(promptBarSource, /analysisConfirmed/);
  assert.match(promptBarSource, /activeGroupSheet/);
  assert.match(promptBarSource, /onActivateEcommerceGroupSheet/);
  assert.match(promptBarSource, /onActivateEcommerceTaskBySourceKey/);

  assert.match(panelSource, /data-ecommerce-workbench-mode/);
  assert.match(panelSource, /group-overview/);
  assert.match(panelSource, /main-card-edit/);
  assert.match(panelSource, /module-edit/);
  assert.match(panelSource, /主图组/);
  assert.match(panelSource, /A\+组/);
  assert.match(panelSource, /组总览/);
  assert.match(panelSource, /主卡编辑/);
  assert.match(panelSource, /模块编辑/);
});
