import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('desktop composer keeps references before model and voice immediately before send', () => {
  const promptBar = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const footer = readSource('apps/web/src/components/layout/prompt-bar/PromptBarFooter.tsx');

  assert.doesNotMatch(footer, /<PromptVoiceInputButton/);
  assert.match(
    promptBar,
    /<ComposerReferenceButton[\s\S]{0,900}data-mobile-footer-control="model-library"/,
  );
  assert.match(
    promptBar,
    /data-composer-control="voice"[\s\S]{0,500}data-mobile-footer-control="send"/,
  );
});

test('composer prompt uses the concise placeholder and scrolls after ten lines', () => {
  const promptBar = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.match(promptBar, /PROMPT_TEXTAREA_MAX_ROWS = 10/);
  assert.match(promptBar, /placeholder="随心输入"/);
  assert.doesNotMatch(promptBar, /shouldRenderStandaloneUploadRow/);
});

test('desktop composer layout is controlled by explicit workspace insets', () => {
  const style = readSource('apps/web/src/styles/workspace-ui-v4.css');

  assert.doesNotMatch(style, /body:has\(/);
  assert.match(style, /--kk-workspace-left-inset/);
  assert.match(style, /--kk-workspace-right-inset/);
  assert.match(style, /\.prompt-bar-liquid-send[\s\S]{0,420}border-radius:\s*999px/);
});
