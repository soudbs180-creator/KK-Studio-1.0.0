import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('model pickers force a refresh before redirecting from an empty library', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');

  assert.match(
    promptBarSource,
    /await refreshModelLibraryData\(\{ force: availableModels\.length === 0 \}\);/,
  );
  assert.match(
    promptBarSource,
    /if \(refreshedAvailableModels\.length === 0\) \{\s*setIsModelMenuLoading\(false\);\s*setActiveMenu\(null\);\s*onOpenSettings\?\.\('api-management'\);/,
  );
  assert.match(
    chatSidebarSource,
    /await refreshModelLibraryData\(\{ force: nextAvailableModels\.length === 0 \}\);/,
  );
  assert.match(
    chatSidebarSource,
    /if \(nextAvailableModels\.length === 0\) \{\s*setIsModelMenuLoading\(false\);\s*setShowModelMenu\(false\);\s*onOpenSettings\?\.\('api-management'\);/,
  );
});
