import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('PromptBar delegates ecommerce-specific composer UI to a dedicated panel component', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const ecommercePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(promptBarSource, /import DesktopComposerEcommercePanel from '\.\/prompt-bar\/DesktopComposerEcommercePanel';/);
  assert.match(promptBarSource, /<DesktopComposerEcommercePanel/);
  assert.doesNotMatch(promptBarSource, /<EcommerceImportPanel/);
  assert.doesNotMatch(promptBarSource, /<EcommerceAnalysisReviewPanel/);

  assert.match(ecommercePanelSource, /import EcommerceImportPanel from '\.\.\/\.\.\/ecommerce\/EcommerceImportPanel';/);
  assert.match(ecommercePanelSource, /import EcommerceAnalysisReviewPanel from '\.\.\/\.\.\/ecommerce\/EcommerceAnalysisReviewPanel';/);
  assert.match(ecommercePanelSource, /GenerationMode\.ECOMMERCE/);
});
