import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('settings system exposes shared modal backdrop and panel primitives', () => {
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');
  const tokenSource = readSource('apps/web/src/styles/kk-ui-tokens.css');
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');

  assert.match(scaffoldSource, /SETTINGS_MODAL_BACKDROP_CLASSNAME/);
  assert.match(scaffoldSource, /SETTINGS_MODAL_PANEL_CLASSNAME/);

  assert.match(tokenSource, /^\.settings-system-modal-backdrop/m);
  assert.match(tokenSource, /^\.settings-system-modal-panel/m);
  assert.match(tokenSource, /--kk-settings-modal-backdrop-bg:\s*var\(--kk-overlay-backdrop-bg\);/);
  assert.match(tokenSource, /--kk-settings-modal-panel-bg:\s*var\(--settings-surface-elevated, var\(--kk-glass-surface-bg\)\);/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-system-modal-backdrop/);
  assert.match(settingsStylesSource, /background:\s*var\(--settings-modal-backdrop-bg\)/);
  assert.match(settingsStylesSource, /backdrop-filter:\s*blur\(var\(--kk-ui-glass-blur\)\)/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-system-modal-panel/);
  assert.match(settingsStylesSource, /background:\s*var\(--settings-surface-elevated\)/);
  assert.match(settingsStylesSource, /box-shadow:\s*var\(--settings-card-shadow\)/);
});

test('advanced OCR settings modal uses system modal primitives and layer tokens', () => {
  const source = readSource('apps/web/src/components/settings/ApiAdvancedSettingsView.tsx');

  assert.match(source, /import \{ KK_LAYER \} from '@kk\/ui';/);
  assert.match(source, /SETTINGS_MODAL_BACKDROP_CLASSNAME/);
  assert.match(source, /SETTINGS_MODAL_PANEL_CLASSNAME/);
  assert.match(source, /style=\{\{ zIndex: KK_LAYER\.modalBackdrop \}\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);

  assert.doesNotMatch(source, /z-\[3000\]/);
  assert.doesNotMatch(source, /bg-black\/60/);
  assert.doesNotMatch(source, /shadow-2xl/);
});

test('advanced settings shadow harness uses settings primitive and bounded layer token', () => {
  const source = readSource('apps/web/src/components/settings/ApiAdvancedSettingsView.tsx');
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');

  assert.match(source, /className="settings-system-shadow-harness"/);
  assert.match(source, /style=\{\{ zIndex: KK_LAYER\.toolbar \}\}/);
  assert.match(source, /data-testid="api-workbench-diagnostics-toggle"/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-system-shadow-harness/);
  assert.match(settingsStylesSource, /opacity:\s*0\.005/);
  assert.match(settingsStylesSource, /pointer-events:\s*none/);
  assert.match(settingsStylesSource, /\.settings-panel \.settings-system-shadow-harness button/);
  assert.match(settingsStylesSource, /pointer-events:\s*auto/);

  assert.doesNotMatch(source, /zIndex:\s*99999/);
  assert.doesNotMatch(source, /position:\s*'fixed'[\s\S]*opacity:\s*0\.005/);
});

test('settings highlight rings use a named layer token instead of raw maximum z-index', () => {
  const settingsStylesSource = readSource('apps/web/src/styles/settings.css');

  assert.match(settingsStylesSource, /--settings-highlight-layer:\s*var\(--kk-z-dropdown\);/);
  assert.match(settingsStylesSource, /\.highlight-glow-ring\s*\{[\s\S]*z-index:\s*var\(--settings-highlight-layer\) !important;/);
  assert.doesNotMatch(settingsStylesSource, /z-index:\s*99999\s*!important/);
});

test('project manager destructive modals consume settings modal primitives and bounded layers', () => {
  const source = readSource('apps/web/src/components/settings/ProjectManager.tsx');

  assert.match(source, /import \{ KK_LAYER \} from '@kk\/ui';/);
  assert.match(source, /SETTINGS_MODAL_BACKDROP_CLASSNAME/);
  assert.match(source, /SETTINGS_MODAL_PANEL_CLASSNAME/);
  assert.match(source, /className=\{`fixed inset-0 flex items-center justify-center .*?\$\{SETTINGS_MODAL_BACKDROP_CLASSNAME\}`\}/);
  assert.match(source, /style=\{\{ zIndex: KK_LAYER\.modalBackdrop \}\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /className=\{`mx-4 .*?\$\{SETTINGS_MODAL_PANEL_CLASSNAME\}`\}/);

  assert.doesNotMatch(source, /z-\[100\]|z-\[101\]/);
  assert.doesNotMatch(source, /bg-black\/60/);
  assert.doesNotMatch(source, /backdrop-blur-md/);
});

test('AI management skill modal consumes settings modal primitives and bounded layers', () => {
  const source = readSource('apps/web/src/components/settings/views/AiManagementView.tsx');

  assert.match(source, /import \{ KK_LAYER \} from '@kk\/ui';/);
  assert.match(source, /SETTINGS_MODAL_BACKDROP_CLASSNAME/);
  assert.match(source, /SETTINGS_MODAL_PANEL_CLASSNAME/);
  assert.match(source, /className=\{`fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-200 \$\{SETTINGS_MODAL_BACKDROP_CLASSNAME\}`\}/);
  assert.match(source, /style=\{\{ zIndex: KK_LAYER\.modalBackdrop \}\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="settings-ai-skill-modal-title"/);
  assert.match(source, /id="settings-ai-skill-modal-title"/);
  assert.match(source, /className=\{`w-full max-w-lg[\s\S]*\$\{SETTINGS_MODAL_PANEL_CLASSNAME\}`\}/);

  assert.doesNotMatch(source, /z-\[3000\]/);
  assert.doesNotMatch(source, /bg-black\/60/);
  assert.doesNotMatch(source, /backdrop-blur-md/);
  assert.doesNotMatch(source, /shadow-2xl/);
});
