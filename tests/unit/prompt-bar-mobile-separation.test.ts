import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt bar routes embedded mobile UI through a dedicated shell component', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const mobileShellSource = readSource('src/components/layout/prompt-bar/MobileEmbeddedComposerShell.tsx');

  assert.match(promptBarSource, /import MobileEmbeddedComposerShell from '\.\/prompt-bar\/MobileEmbeddedComposerShell';/);
  assert.match(promptBarSource, /isEmbeddedMobileComposer \? \(/);
  assert.match(promptBarSource, /<MobileEmbeddedComposerShell/);
  assert.match(mobileShellSource, /data-mobile-composer-shell="embedded"/);
  assert.match(mobileShellSource, /data-mobile-composer-section="mode-strip"/);
  assert.match(mobileShellSource, /data-mobile-composer-section="primary-input"/);
  assert.match(mobileShellSource, /data-mobile-composer-section="advanced-drawer"/);
});
