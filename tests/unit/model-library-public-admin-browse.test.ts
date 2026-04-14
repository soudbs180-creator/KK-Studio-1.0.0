import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('public admin models stay browseable while execution remains login-guarded', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');

  assert.match(promptBarSource, /const canBrowseSystemCreditModels = billingUiEnabled;/);
  assert.match(chatSidebarSource, /const canBrowseSystemCreditModels = billingUiEnabled;/);

  assert.match(
    promptBarSource,
    /if \(isSystemCreditModel && !canAccessSystemCreditModels\) \{\s*notify\.error\(/,
  );
  assert.match(
    chatSidebarSource,
    /if \(!canAccessSystemCreditModels\) \{\s*notify\.error\(/,
  );
});
