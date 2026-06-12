import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('prompt bar mobile chrome exposes shared layer tokens and primitives', () => {
  const layerSource = readSource('packages/ui/src/core/layers.ts');
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  assert.match(layerSource, /promptComposer:\s*960/);

  for (const token of [
    '--kk-prompt-bar-mobile-collapse-handle-bg',
    '--kk-prompt-bar-mobile-collapse-handle-bg-hover',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  assert.match(cssSource, /\.kk-prompt-bar-mobile-collapse-handle\s*\{/);
  assert.match(cssSource, /\.kk-prompt-bar-mobile-collapse-handle:hover\s*\{/);
  assert.match(cssSource, /\.dark \.kk-prompt-bar-mobile-collapse-handle\s*\{/);
});

test('prompt bar mobile chrome consumes semantic layer selectors instead of raw z-index values', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const detailSource = readSource('apps/web/src/components/mobile/MobileResultDetailScreen.tsx');
  const workspaceSurfaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');

  assert.match(promptBarSource, /const PROMPT_BAR_MOBILE_EXTERNAL_LAYER_SELECTOR = '\[data-kk-mobile-overlay-layer="true"\], \[data-prompt-bar-mobile-model-layer="true"\]';/);
  assert.match(promptBarSource, /target\.closest\(PROMPT_BAR_MOBILE_EXTERNAL_LAYER_SELECTOR\)/);
  assert.match(promptBarSource, /className="kk-prompt-bar-mobile-collapse-handle"/);
  assert.match(promptBarSource, /style=\{\{ zIndex: KK_LAYER\.promptComposer \}\}/);
  assert.match(promptBarSource, /style=\{\{[\s\S]*zIndex: KK_LAYER\.promptComposer,/);
  assert.match(detailSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(detailSource, /style=\{\{ zIndex: KK_LAYER\.modal \}\}/);
  assert.match(detailSource, /data-kk-mobile-overlay-layer="true"/);
  assert.match(workspaceSurfaceSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
  assert.match(workspaceSurfaceSource, /zIndex: KK_LAYER\.modal/);
  assert.match(workspaceSurfaceSource, /data-kk-mobile-overlay-layer="true"/);

  assert.doesNotMatch(promptBarSource, /\[class\*="z-\[990\]"\]|\[class\*="z-\[985\]"\]/);
  assert.doesNotMatch(promptBarSource, /z-\[800\]|zIndex:\s*960/);
  assert.doesNotMatch(detailSource, /z-\[990\]/);
  assert.doesNotMatch(workspaceSurfaceSource, /z-\[985\]/);
});
