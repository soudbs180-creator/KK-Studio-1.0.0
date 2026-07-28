import test from 'node:test';
import assert from 'node:assert/strict';
import { PROMPT_COMPOSER_ACTIONS } from '../../apps/web/src/features/ai-assistant-runtime/runtime/promptComposerActions.ts';
import { readSource } from '../support/workspacePaths.js';

test('Prompt composer controls expose one stable action catalog', () => {
  const runtimeIndexSource = readSource('apps/web/src/features/ai-assistant-runtime/index.ts');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const modeSwitcherSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx');
  const modePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const promptToolsSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerPromptTools.tsx');

  assert.match(runtimeIndexSource, /PROMPT_COMPOSER_ACTIONS/);
  for (const source of [promptBarSource, modeSwitcherSource, modePanelSource, promptToolsSource]) {
    assert.match(source, /PROMPT_COMPOSER_ACTIONS/);
  }

  const actionValues = Object.values(PROMPT_COMPOSER_ACTIONS).map((action) => action.uiAction);
  assert.equal(new Set(actionValues).size, actionValues.length);

  for (const key of [
    'expandMobileComposer',
    'collapseMobileComposer',
    'openModelLibrary',
    'selectModel',
    'toggleModelPin',
    'openModelCustomization',
    'closeModelCustomization',
    'cancelModelCustomization',
    'saveModelCustomization',
    'clearModelSearch',
    'openProviderModels',
    'closeProviderModels',
    'toggleMode',
    'openWorkflowBrowser',
    'toggleComposerTools',
    'selectMobileMode',
    'toggleAdvancedOptions',
    'toggleGrounding',
    'toggleImageSearch',
    'selectAudioDuration',
    'selectParallelCount',
    'toggleParallelCountMenu',
    'togglePromptOptimization',
    'selectPromptOptimizerArchetype',
    'togglePptOutline',
    'togglePptStyleLock',
    'appendPptTemplateSlide',
    'movePptSlide',
    'removePptSlide',
    'insertPptSlide',
    'importPptOutline',
    'generatePptOutline',
    'exportPptOutline',
    'clearPptOutline',
    'applyPptOutline',
    'refinePptOutline',
    'clearSource',
    'removeReferenceImage',
    'addReferenceImage',
    'submitGeneration',
  ] as const) {
    assert.ok(PROMPT_COMPOSER_ACTIONS[key], `missing prompt composer action ${key}`);
  }

  for (const [key, action] of Object.entries(PROMPT_COMPOSER_ACTIONS)) {
    if (key === 'submitGeneration') {
      assert.equal(action.toolName, 'generation.submitComposer');
    } else {
      assert.equal(action.toolName, undefined, `${key} should remain a local prompt composer action`);
    }
  }
});

test('PromptBar and extracted prompt-bar controls use prompt composer action markers', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const modeSwitcherSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx');
  const modePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const promptToolsSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerPromptTools.tsx');

  assert.match(promptBarSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.expandMobileComposer\.uiAction\}/);
  assert.match(promptBarSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.openModelLibrary\.uiAction\}/);
  assert.match(promptBarSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.selectModel\.uiAction\}/);
  assert.match(promptBarSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.submitGeneration\.uiAction\}/);
  assert.match(promptBarSource, /data-agent-tool=\{PROMPT_COMPOSER_ACTIONS\.submitGeneration\.toolName\}/);

  assert.match(modeSwitcherSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.toggleMode\.uiAction\}/);
  assert.match(modePanelSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.toggleAdvancedOptions\.uiAction\}/);
  assert.match(promptToolsSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.togglePptOutline\.uiAction\}/);
  assert.match(promptToolsSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.togglePromptOptimization\.uiAction\}/);
  assert.match(promptToolsSource, /data-prompt-composer-action=\{PROMPT_COMPOSER_ACTIONS\.selectPromptOptimizerArchetype\.uiAction\}/);
});

const getJsxOpeningTag = (source: string, start: number): string => {
  let quote: string | null = null;
  let braceDepth = 0;

  for (let index = start + '<button'.length; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      braceDepth += 1;
      continue;
    }

    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === '>' && braceDepth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error('Could not read JSX opening tag');
};

test('PromptBar buttons are fully covered by prompt composer action markers', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const missingMarkers: number[] = [];
  let index = 0;

  while ((index = promptBarSource.indexOf('<button', index)) !== -1) {
    const openingTag = getJsxOpeningTag(promptBarSource, index);
    if (!/data-prompt-composer-action=/.test(openingTag)) {
      missingMarkers.push(promptBarSource.slice(0, index).split(/\r?\n/).length);
    }
    index += openingTag.length;
  }

  assert.deepEqual(missingMarkers, [], `PromptBar buttons missing prompt composer markers: ${missingMarkers.join(', ')}`);
});
