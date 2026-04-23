import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce confirm flow caches shared upload references and exposes confirming state', () => {
  const appSource = readSource('src/App.tsx');
  const promptBarSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(appSource, /isConfirmingAnalysis: false/);
  assert.match(appSource, /const currentUploadReferences = await buildCurrentEcommerceUploadReferences\(\);/);
  assert.match(appSource, /uploadReferences: currentUploadReferences,/);
  assert.match(appSource, /setEcommerceState\(\(previousState\) => \(\{\s*\.\.\.previousState,\s*isConfirmingAnalysis: true,\s*\}\)\);/);
  assert.match(appSource, /isConfirmingAnalysis: false,/);
  assert.match(promptBarSource, /confirmingAnalysis\?: boolean;/);
  assert.match(promptBarSource, /isConfirming=\{confirmingAnalysis\}/);
});
