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

test('ecommerce confirm flow builds one visible framework card that contains the whole requirement summary', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const buildEcommerceFrameworkNode = useCallback\(\(\s*analysis: EcommerceAnalysisResult,/);
  assert.match(appSource, /const summary = \[/);
  assert.match(appSource, /analysis\.mainImageItems\.map/);
  assert.match(appSource, /analysis\.aPlusGroup\.modules\.map/);
  assert.match(appSource, /prompt: summary/);
  assert.match(appSource, /originalPrompt: summary/);
  assert.match(appSource, /const frameworkNode = buildEcommerceFrameworkNode\(analysis,/);
});
