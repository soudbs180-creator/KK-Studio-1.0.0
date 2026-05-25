import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce group slot runtime state is wired into actionable current-version and history preview entrypoints', () => {
  const appSource = readSource('src/App.tsx');
  const hookSource = readSource('src/app/useEcommerceSlotHistoryRuntime.ts');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(hookSource, /handlePreviewEcommerceSlotHistory/);
  assert.match(appSource, /onPreviewEcommerceSlotHistory/);
  assert.match(promptBarSource, /onPreviewEcommerceSlotHistory/);
  assert.match(desktopPanelSource, /onPreviewSlotHistory/);
  assert.match(desktopPanelSource, /currentImageId/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-current/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-open-all/);
  assert.match(desktopPanelSource, /ecommerce-slot-history-panel/);
});
