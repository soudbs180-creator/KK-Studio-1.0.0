import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce mode is wired into the shared mode entry surfaces', () => {
  const typesSource = readSource('src/types.ts');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const registrySource = readSource('src/components/layout/prompt-bar/composerModeRegistry.ts');
  const mobileTabBarSource = readSource('src/components/mobile/MobileTabBar.tsx');
  const appSource = readSource('src/App.tsx');

  assert.match(typesSource, /ECOMMERCE = 'ecommerce'/);
  assert.match(registrySource, /mode:\s*GenerationMode\.ECOMMERCE/);
  assert.match(registrySource, /PackageOpen/);
  assert.match(promptBarSource, /placeholder=\{[\s\S]*GenerationMode\.ECOMMERCE[\s\S]*运营需求/);
  assert.match(promptBarSource, /mode === GenerationMode\.ECOMMERCE/);
  assert.match(
    registrySource,
    /PROMPT_BAR_MODE_REGISTRY:[\s\S]*GenerationMode\.IMAGE[\s\S]*GenerationMode\.VIDEO[\s\S]*GenerationMode\.ECOMMERCE[\s\S]*GenerationMode\.AUDIO[\s\S]*GenerationMode\.PPT/,
  );
  assert.match(mobileTabBarSource, /\[GenerationMode\.ECOMMERCE\]:/);
  assert.match(appSource, /promptOptimizationSupported=\{config\.mode === GenerationMode\.IMAGE \|\| config\.mode === GenerationMode\.PPT \|\| config\.mode === GenerationMode\.ECOMMERCE\}/);
});
