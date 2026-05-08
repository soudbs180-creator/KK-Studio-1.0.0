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
  const buildRuntimeSource = readSource('src/app/useEcommerceBuildRuntime.ts');
  const promptBarSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(appSource, /isConfirmingAnalysis: false/);
  assert.match(appSource, /useEcommerceBuildRuntime\(\{/);
  assert.match(buildRuntimeSource, /const currentUploadReferences = await buildCurrentEcommerceUploadReferences\(\);/);
  assert.match(buildRuntimeSource, /uploadReferences: currentUploadReferences,/);
  assert.match(buildRuntimeSource, /setEcommerceBuildRuntimeState\(\(\) => \(\{\s*isConfirmingAnalysis: true,\s*\}\)\);/);
  assert.match(buildRuntimeSource, /isConfirmingAnalysis: false,/);
  assert.match(promptBarSource, /confirmingAnalysis\?: boolean;/);
  assert.match(promptBarSource, /isConfirming=\{confirmingAnalysis\}/);
});

test('ecommerce confirm flow builds one visible framework card that contains the whole requirement summary', () => {
  const appSource = readSource('src/App.tsx');
  const buildRuntimeSource = readSource('src/app/useEcommerceBuildRuntime.ts');

  assert.match(appSource, /useEcommerceBuildRuntime\(\{/);
  assert.match(buildRuntimeSource, /const buildEcommerceFrameworkNode = useCallback\(\(\s*analysis: EcommerceAnalysisResult,/);
  assert.match(buildRuntimeSource, /const summary = \[/);
  assert.match(buildRuntimeSource, /\.\.\.\(analysis\.mainImageItems \|\| \[\]\)\.map/);
  assert.match(buildRuntimeSource, /\.\.\.\(analysis\.aPlusGroup\?\.modules \|\| \[\]\)\.map/);
  assert.match(buildRuntimeSource, /prompt: summary/);
  assert.match(buildRuntimeSource, /originalPrompt: summary/);
  assert.match(buildRuntimeSource, /const frameworkNode = buildEcommerceFrameworkNode\(analysis,/);
});
