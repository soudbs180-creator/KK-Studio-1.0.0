import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('mobile chrome exposes shared layer and css z-index tokens', () => {
  const layerSource = readSource('packages/ui/src/core/layers.ts');
  const tokenSource = readSource('apps/web/src/styles/kk-ui-tokens.css');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(layerSource, /mobileChrome:\s*940/);
  assert.match(layerSource, /mobileChromeOverlay:\s*964/);
  assert.match(tokenSource, /--kk-z-mobile-chrome:\s*940;/);
  assert.match(tokenSource, /--kk-z-mobile-chrome-overlay:\s*964;/);
  assert.match(cssSource, /\.ios-mobile-project-dropdown\s*\{[^}]*z-index:\s*var\(--kk-z-mobile-chrome-overlay\);/);
});

test('mobile chrome components consume semantic layers instead of raw z-index utilities', () => {
  const tabBarSource = readSource('apps/web/src/components/mobile/MobileTabBar.tsx');
  const quickBarSource = readSource('apps/web/src/components/mobile/MobileWorkspaceQuickBar.tsx');
  const moreMenuSource = readSource('apps/web/src/components/mobile/MobileMoreMenu.tsx');
  const ecommerceSource = readSource('apps/web/src/components/mobile/MobileEcommercePanel.tsx');

  assert.match(tabBarSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui';/);
  assert.match(tabBarSource, /zIndex:\s*KK_LAYER\.mobileChrome/);
  assert.doesNotMatch(tabBarSource, /z-\[940\]|#ffffff|text-white\/80/);

  assert.match(quickBarSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui';/);
  assert.match(quickBarSource, /data-kk-mobile-chrome-overlay="true"/);
  assert.match(quickBarSource, /style=\{\{ zIndex: KK_LAYER\.mobileChromeOverlay \}\}/);
  assert.doesNotMatch(quickBarSource, /z-\[964\]/);

  assert.match(moreMenuSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui';/);
  assert.match(moreMenuSource, /data-kk-mobile-overlay-layer="true"/);
  assert.match(moreMenuSource, /style=\{\{ zIndex: KK_LAYER\.modalBackdrop \}\}/);
  assert.match(moreMenuSource, /kk-mobile-more-menu-sheet/);
  assert.match(moreMenuSource, /kk-mobile-more-menu-action/);
  assert.match(moreMenuSource, /kk-mobile-more-menu-icon/);
  assert.doesNotMatch(moreMenuSource, /z-\[1001\]|text-white|bg-white\/5|border-white\/10|text-zinc/);

  assert.match(ecommerceSource, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui';/);
  assert.match(ecommerceSource, /data-kk-mobile-overlay-layer="true"/);
  assert.match(ecommerceSource, /style=\{\{ zIndex: KK_LAYER\.modal \}\}/);
  assert.match(ecommerceSource, /mobile-ecommerce-panel-root/);
  assert.doesNotMatch(ecommerceSource, /z-\[995\]|bg-\[#0A0A0C\]/);
});

test('mobile chrome visual primitives share clay surfaces and reduced motion behavior', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /\.kk-mobile-more-menu-backdrop\s*\{[^}]*var\(--mobile-clay-overlay-bg\)/);
  assert.match(cssSource, /\.kk-mobile-more-menu-sheet\s*\{[^}]*var\(--mobile-clay-shell-bg\)/);
  assert.match(cssSource, /\.kk-mobile-more-menu-action\s*\{[^}]*var\(--mobile-clay-surface-bg\)/);
  assert.match(cssSource, /\.kk-mobile-more-menu-icon\s*\{[^}]*var\(--frost-card-sub-bg\)/);
  assert.match(cssSource, /\.mobile-ecommerce-panel-root\s*\{[^}]*var\(--mobile-clay-shell-bg\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.kk-mobile-more-menu-sheet/);
});
