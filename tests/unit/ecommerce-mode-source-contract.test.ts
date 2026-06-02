import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce mode is wired into the shared mode entry surfaces', () => {
  const typesSource = readSource('apps/web/src/types.ts');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const registrySource = readSource('apps/web/src/components/layout/prompt-bar/composerModeRegistry.ts');
  const mobileTabBarSource = readSource('apps/web/src/components/mobile/MobileTabBar.tsx');

  assert.match(typesSource, /ECOMMERCE\s*[:=]\s*'ecommerce'/);
  assert.match(registrySource, /mode:\s*GenerationMode\.ECOMMERCE/);
  assert.match(registrySource, /PackageOpen/);
  assert.match(
    promptBarSource,
    /placeholder=\{[\s\S]*GenerationMode\.ECOMMERCE[\s\S]*上传运营需求文件后，在这里补充额外的电商要求/,
  );
  assert.match(promptBarSource, /mode === GenerationMode\.ECOMMERCE/);
  assert.match(
    registrySource,
    /PROMPT_BAR_MODE_REGISTRY:[\s\S]*GenerationMode\.IMAGE[\s\S]*GenerationMode\.VIDEO[\s\S]*GenerationMode\.ECOMMERCE[\s\S]*GenerationMode\.AUDIO[\s\S]*GenerationMode\.PPT/,
  );
  assert.match(mobileTabBarSource, /\[GenerationMode\.ECOMMERCE\]:/);
  assert.match(
    promptBarSource,
    /\(config\.mode === GenerationMode\.IMAGE \|\| config\.mode === GenerationMode\.PPT \|\| config\.mode === GenerationMode\.ECOMMERCE\) \? \(\s*<ImageOptionsPanel/,
  );
});
