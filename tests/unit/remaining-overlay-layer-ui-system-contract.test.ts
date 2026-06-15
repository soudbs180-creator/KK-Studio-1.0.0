import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('remaining floating overlays consume KK layer tokens instead of raw z-index utilities', () => {
  const layersSource = readSource('packages/ui/src/core/layers.ts');
  const adminSource = readSource('apps/web/src/components/admin/AdminRechargeFloatingPanel.tsx');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const modePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const signUpSource = readSource('apps/web/src/components/ui/sign-up.tsx');

  assert.match(layersSource, /floatingPanel:\s*220/);

  assert.match(adminSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui';/);
  assert.match(adminSource, /admin-recharge-floating-panel/);
  assert.match(adminSource, /style=\{\{[\s\S]*zIndex:\s*KK_LAYER\.floatingPanel/);
  assert.doesNotMatch(adminSource, /z-\[210\]|bg-slate-950|text-slate-100|shadow-2xl|backdrop-blur/);
  assert.doesNotMatch(adminSource, /rgba\(251,191,36,0\.55\)|rgba\(148,163,184,0\.18\)|rgba\(245,158,11,0\.16\)|rgba\(15,23,42,0\.78\)/);

  assert.match(promptBarSource, /kk-prompt-send-button-content/);
  assert.match(promptBarSource, /kk-prompt-send-button-icon/);
  assert.doesNotMatch(promptBarSource, /z-\[1\]/);

  assert.match(modePanelSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui';/);
  assert.match(modePanelSource, /kk-desktop-composer-mobile-sheet/);
  assert.match(modePanelSource, /zIndex:\s*KK_LAYER\.modalBackdrop/);
  assert.doesNotMatch(modePanelSource, /z-\[1005\]/);

  assert.match(signUpSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui';/);
  assert.match(signUpSource, /zIndex:\s*KK_LAYER\.modalBackdrop/);
  assert.match(signUpSource, /style=\{\{ zIndex: KK_LAYER\.modalBackdrop \}\}/);
  assert.doesNotMatch(signUpSource, /zIndex:\s*100|z-\[999\]/);
});

test('remaining floating overlays expose tokenized css primitives', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /\.admin-recharge-floating-panel\s*\{[^}]*var\(--frost-card-framework-bg\)/);
  assert.match(cssSource, /\.admin-recharge-floating-panel__row\[data-state="marked"\]\s*\{[^}]*var\(--mobile-clay-active-bg\)/);
  assert.match(cssSource, /\.admin-recharge-floating-panel__primary-action\s*\{[^}]*var\(--clay-brand-coral\)/);
  assert.match(cssSource, /\.kk-prompt-send-button-content\s*\{[^}]*z-index:\s*var\(--kk-z-local-content\)/);
  assert.match(cssSource, /\.kk-prompt-send-button-icon\s*\{[^}]*z-index:\s*var\(--kk-z-local-content\)/);
  assert.match(cssSource, /\.kk-desktop-composer-mobile-sheet\s*\{[^}]*var\(--mobile-clay-shell-bg\)/);
});
