import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ChatSidebar does not retain source-proven unused locals', () => {
  const source = readSource('src/components/layout/ChatSidebar.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/chat-sidebar-unused-cleanup-contract\.test\.ts/);
  assert.match(source, /const ChatSidebar: React\.FC<ChatSidebarProps>/);

  assert.doesNotMatch(source, /\bEraser\b/);
  assert.doesNotMatch(source, /\bImageIcon\b/);
  assert.doesNotMatch(source, /\bPaperclip\b/);
  assert.doesNotMatch(source, /\bZap\b/);
  assert.doesNotMatch(source, /\bSparkles\b/);
  assert.doesNotMatch(source, /\bviewportHeight\b/);
  assert.doesNotMatch(source, /\bfilteredSessions\b/);
  assert.doesNotMatch(source, /\bactiveChildren\b/);
  assert.doesNotMatch(source, /\bstartDrag\b/);
  assert.doesNotMatch(source, /\bgetBranchSourcePreview\b/);
  assert.doesNotMatch(source, /\bhandleClear\b/);
  assert.doesNotMatch(source, /\bgetTransformOrigin\b/);
});
