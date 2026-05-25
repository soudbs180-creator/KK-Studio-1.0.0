import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce prompt bar and desktop workbench share the same 主图/A+ sheet literals', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const workbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(promptBarSource, /ecommerceActiveGroupSheet\?: (?:EcommerceGroupSheet|'主图' \| 'A\+') \| null;/);
  assert.match(promptBarSource, /onActivateEcommerceGroupSheet\?: \(sheet: (?:EcommerceGroupSheet|'主图' \| 'A\+')\) => void;/);
  assert.match(workbenchSource, /type EcommerceGroupSheet,/);
  assert.match(workbenchSource, /activeGroupSheet\?: EcommerceGroupSheet \| null;/);
  assert.match(
    workbenchSource,
    /import EcommerceAnalysisReviewPanel from '\.\.\/\.\.\/ecommerce\/EcommerceAnalysisReviewPanel(?:\.tsx)?';/,
  );
});
