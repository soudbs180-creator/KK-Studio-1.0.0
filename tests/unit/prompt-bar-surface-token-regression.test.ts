import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('PromptBar context menu and model modal use shared theme tokens instead of hard-coded dark surfaces', () => {
  const source = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  assert.doesNotMatch(source, /bg-\[#2a2a2e\]/);
  assert.doesNotMatch(source, /bg-\[#1e1e20\]/);
  assert.doesNotMatch(source, /bg-indigo-600/);
  assert.match(source, /className="kk-prompt-bar-deep-context-menu"/);
  assert.match(source, /className="kk-prompt-bar-deep-modal-panel"/);
  assert.match(source, /var\(--text-primary\)/);
  assert.match(cssSource, /--kk-prompt-bar-deep-popover-bg: var\(--prompt-bar-shell-bg\);/);
  assert.match(cssSource, /--kk-prompt-bar-deep-popover-border: var\(--prompt-bar-shell-border\);/);
  assert.match(cssSource, /--kk-prompt-bar-deep-modal-panel-bg: var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /--kk-prompt-bar-deep-modal-panel-border: var\(--prompt-bar-shell-border\);/);
  assert.match(cssSource, /--kk-prompt-bar-deep-modal-panel-shadow: var\(--frost-card-framework-shadow\);/);
});

