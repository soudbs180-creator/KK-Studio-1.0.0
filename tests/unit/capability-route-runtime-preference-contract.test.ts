import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('generation mode key preference reads capability route assignments before falling back to per-mode local memory', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /m === GenerationMode\.PPT[\s\S]*'ppt_generation'/);
  assert.match(appSource, /m === GenerationMode\.ECOMMERCE[\s\S]*'ecommerce_generation'/);
  assert.match(appSource, /m === GenerationMode\.IMAGE[\s\S]*'image_generation'/);
  assert.match(appSource, /resolveCapabilityRouteAssignment\(capabilityRole\)\?\.primaryRouteId/);
  assert.match(appSource, /return capabilityKeyId \|\| modePreferredKeyMap\[m\];/);
});

test('chat sidebar prefers the assistant capability route as its default model and preferred key source without removing manual model choice', () => {
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');

  assert.match(chatSidebarSource, /resolveCapabilityRouteAssignment\('assistant'\)/);
  assert.match(chatSidebarSource, /const resolveAssistantPreferredModel = useCallback/);
  assert.match(chatSidebarSource, /const resolveAssistantPreferredKeyId = useCallback/);
  assert.match(chatSidebarSource, /preferredKeyId: resolveAssistantPreferredKeyId\(\)/);
  assert.match(chatSidebarSource, /const assistantPreferredModel = resolveAssistantPreferredModel\(models\);/);
  assert.match(chatSidebarSource, /setSelectedModel\(assistantPreferredModel\);/);
  assert.match(chatSidebarSource, /onClick=\{\(\) => onSelect\(model\)\}/);
});
