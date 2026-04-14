import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt bar routes embedded mobile UI through a dedicated advanced drawer component', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const drawerSource = readSource('src/components/layout/prompt-bar/MobileEmbeddedAdvancedDrawer.tsx');

  assert.match(promptBarSource, /import MobileEmbeddedAdvancedDrawer from '\.\/prompt-bar\/MobileEmbeddedAdvancedDrawer';/);
  assert.match(promptBarSource, /isEmbeddedMobileComposer \? \(/);
  assert.match(promptBarSource, /<MobileEmbeddedAdvancedDrawer/);
  assert.match(promptBarSource, /data-mobile-composer-section="primary-input"/);
  assert.match(drawerSource, /data-mobile-composer-section="advanced-drawer"/);
});
