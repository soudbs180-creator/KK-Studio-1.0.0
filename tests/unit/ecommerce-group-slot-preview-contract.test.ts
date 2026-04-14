import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce group slot runtime state is wired into actionable current-version and history preview entrypoints', () => {
  const appSource = readSource('src/App.tsx');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(appSource, /handlePreviewEcommerceSlotHistory/);
  assert.match(promptBarSource, /onPreviewEcommerceSlotHistory/);
  assert.match(desktopPanelSource, /onPreviewSlotHistory/);
  assert.match(desktopPanelSource, /currentImageId/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-current/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-all/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-panel/);
});
