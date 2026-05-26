import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('model pickers define explicit cached-refresh and bootstrap loading states', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(
    promptBarSource,
    /type ModelMenuLoadingState = 'idle' \| 'refreshing_with_cache' \| 'bootstrapping_without_cache';/,
  );
});

test('model pickers keep cached lists interactive while showing a lightweight sync indicator', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(
    promptBarSource,
    /const isModelMenuBootstrapping = modelMenuLoadingState === 'bootstrapping_without_cache';/,
  );
  assert.match(
    promptBarSource,
    /const isModelMenuRefreshingWithCache = modelMenuLoadingState === 'refreshing_with_cache';/,
  );
  assert.match(
    promptBarSource,
    /isModelMenuRefreshingWithCache && \(\s*<div className="mb-2 flex items-center justify-center gap-2 text-xs text-\[var\(--text-secondary\)\]">/s,
  );
});

test('model pickers reserve three skeleton rows for empty-library bootstrap loading', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(
    promptBarSource,
    /const MODEL_MENU_SKELETON_COUNT = 3;/,
  );
  assert.match(
    promptBarSource,
    /Array\.from\(\{ length: MODEL_MENU_SKELETON_COUNT \}\)/,
  );
});

test('prompt bar initializes available models before model-library effects run on first render', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx').replace(/\r\n/g, '\n');

  const availableModelsIndex = promptBarSource.indexOf('const availableModels = useMemo(() => {');
  const subscriptionEffectIndex = promptBarSource.indexOf('useEffect(() => {\n        refreshModelLibraryDataInBackground();');
  const bootstrapEffectIndex = promptBarSource.indexOf('useEffect(() => {\n        let active = true;\n\n        if (!canBrowseSystemCreditModels || availableModels.length > 0) {');

  assert.notEqual(availableModelsIndex, -1, 'expected PromptBar to declare availableModels');
  assert.notEqual(subscriptionEffectIndex, -1, 'expected PromptBar to subscribe to model library refresh');
  assert.notEqual(bootstrapEffectIndex, -1, 'expected PromptBar to include the empty-library bootstrap effect');
  assert.ok(
    availableModelsIndex < subscriptionEffectIndex,
    'expected availableModels to be initialized before model-library effects are declared',
  );
  assert.ok(
    availableModelsIndex < bootstrapEffectIndex,
    'expected availableModels to be initialized before the bootstrap effect references it',
  );
});
