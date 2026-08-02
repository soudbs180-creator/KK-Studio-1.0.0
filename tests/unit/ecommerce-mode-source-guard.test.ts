import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce mode is wired into the mode rail and prompt bar guards', () => {
  const typesSource = readSource('apps/web/src/types.ts');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const registrySource = readSource('apps/web/src/components/layout/prompt-bar/composerModeRegistry.ts');
  const mobileTabBarSource = readSource('apps/web/src/components/mobile/MobileTabBar.tsx');

  assert.match(typesSource, /ECOMMERCE\s*[:=]\s*'ecommerce'/);
  assert.match(registrySource, /mode:\s*GenerationMode\.ECOMMERCE/);
  assert.match(registrySource, /label:\s*'电商'/);
  assert.match(promptBarSource, /if \(mode === GenerationMode\.ECOMMERCE\)/);
  assert.match(promptBarSource, /config\.mode === GenerationMode\.ECOMMERCE/);
  assert.match(promptBarSource, /placeholder="随心输入"/);
  assert.match(mobileTabBarSource, /\[GenerationMode\.ECOMMERCE\]:\s*(?:pick\('电商',\s*'E-commerce'\)|'电商')/);
});
