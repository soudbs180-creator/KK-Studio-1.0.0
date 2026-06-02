import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('public admin models stay browseable while execution remains login-guarded', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const chatSidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

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
