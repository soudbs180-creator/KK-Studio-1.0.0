import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('model pickers force a refresh before redirecting from an empty library', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');

  assert.match(
    promptBarSource,
    /await refreshModelLibraryData\(\{ force: availableModels\.length === 0 \}\);/,
  );
  assert.match(
    promptBarSource,
    /if \(refreshedAvailableModels\.length === 0\) \{\s*setModelMenuLoadingState\('idle'\);\s*setActiveMenu\(null\);\s*onOpenSettings\?\.\('api-management'\);/,
  );
  assert.match(
    chatSidebarSource,
    /await refreshModelLibraryData\(\{ force: nextAvailableModels\.length === 0 \}\);/,
  );
  assert.match(
    chatSidebarSource,
    /if \(nextAvailableModels\.length === 0\) \{\s*setModelMenuLoadingState\('idle'\);\s*setShowModelMenu\(false\);\s*onOpenSettings\?\.\('api-management'\);/,
  );
});

test('model pickers open immediately from cache and refresh in the background', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');

  assert.match(
    promptBarSource,
    /const hasCachedModels = availableModels\.length > 0;/,
  );
  assert.match(
    promptBarSource,
    /setModelMenuLoadingState\(hasCachedModels \? 'refreshing_with_cache' : 'bootstrapping_without_cache'\);/,
  );
  assert.match(
    promptBarSource,
    /if \(hasCachedModels\) \{\s*void refreshModelLibraryData\(\{ force: false \}\)/,
  );
  assert.doesNotMatch(
    promptBarSource,
    /setModelMenuLoadingState\('bootstrapping_without_cache'\);\s*try \{\s*await refreshModelLibraryData\(\{ force: availableModels\.length === 0 \}\);/s,
  );

  assert.match(
    chatSidebarSource,
    /const hasCachedModels = nextAvailableModels\.length > 0;/,
  );
  assert.match(
    chatSidebarSource,
    /setModelMenuLoadingState\(hasCachedModels \? 'refreshing_with_cache' : 'bootstrapping_without_cache'\);/,
  );
  assert.match(
    chatSidebarSource,
    /if \(hasCachedModels\) \{\s*void refreshModelLibraryData\(\{ force: false \}\)/,
  );
  assert.doesNotMatch(
    chatSidebarSource,
    /setModelMenuLoadingState\('bootstrapping_without_cache'\);\s*let nextAvailableModels = availableModels;\s*try \{\s*await refreshModelLibraryData\(\{ force: nextAvailableModels\.length === 0 \}\);/s,
  );
});
