import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('result surfaces consume shared KK result tokens and 44px interaction primitives', () => {
  const tokenSource = readSource('apps/web/src/styles/kk-ui-tokens.css');
  const lightboxSource = readSource('apps/web/src/components/image/GlobalLightbox.tsx');
  const feedSource = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const tileSource = readSource('apps/web/src/components/mobile/MobileResultTile.tsx');
  const rootSwitchSource = readSource('apps/web/src/app/AppRootContentSwitch.tsx');
  const stressLabSource = readSource('apps/web/src/dev/StressLab.tsx');

  assert.match(tokenSource, /--kk-result-overlay-rgb:/);
  assert.match(tokenSource, /--kk-result-panel-bg:/);
  assert.match(tokenSource, /--kk-result-control-bg:/);
  assert.match(tokenSource, /--kk-result-control-primary-bg:/);
  assert.match(tokenSource, /--kk-result-bottom-scrim-bg:/);
  assert.match(tokenSource, /\.kk-result-surface/);
  assert.match(tokenSource, /\.kk-lightbox-backdrop\s*\{[\s\S]*rgb\(var\(--kk-result-overlay-rgb\) \/ var\(--kk-lightbox-backdrop-opacity/);
  assert.match(tokenSource, /\.kk-result-control\s*\{[\s\S]*min-height:\s*var\(--kk-touch-target-min\)/);
  assert.match(tokenSource, /\.kk-result-icon-control\s*\{[\s\S]*min-width:\s*var\(--kk-touch-target-min\)/);
  assert.match(tokenSource, /prefers-reduced-motion:\s*reduce[\s\S]*\.kk-result-surface/);

  assert.match(lightboxSource, /className="kk-result-surface kk-lightbox-backdrop/);
  assert.match(lightboxSource, /const actionButtonClass = 'kk-result-control/);
  assert.match(lightboxSource, /const downloadButtonClass = 'kk-result-control kk-result-primary-action/);
  assert.match(lightboxSource, /'--kk-lightbox-backdrop-opacity':\s*getOpacity\(\)/);
  assert.match(lightboxSource, /var\(--kk-motion-standard\) var\(--kk-motion-ease-standard\)/);
  assert.doesNotMatch(lightboxSource, /bg-indigo-600|hover:bg-indigo-500|hover:border-purple-500|hover:border-amber-400|hover:border-sky-500|hover:border-cyan-500|hover:bg-red-600/);

  assert.match(feedSource, /kk-result-history-header/);
  assert.match(feedSource, /kk-result-bottom-bar/);
  assert.match(feedSource, /var\(--kk-result-bottom-scrim-bg\)/);
  assert.match(feedSource, /transform var\(--kk-motion-panel\) var\(--kk-motion-ease-standard\)/);
  assert.doesNotMatch(feedSource, /rgba\(20,\s*20,\s*22|rgba\(10,\s*10,\s*12|border-red-500\/20|text-red-400/);

  assert.match(tileSource, /kk-result-tile/);
  assert.match(tileSource, /kk-result-media/);
  assert.match(tileSource, /var\(--kk-result-selected-shadow\)/);
  assert.doesNotMatch(tileSource, /rounded-\[20px\]|bg-\[#fb7185\]|border-\[#fb7185\]|duration-300/);

  assert.match(rootSwitchSource, /import\.meta\.env\.DEV && window\.location\.pathname === '\/stress-lab'/);
  assert.match(rootSwitchSource, /<StressLabSuspended \/>/);
  assert.match(stressLabSource, /<MobileResultFeed/);
  assert.match(stressLabSource, /<GlobalLightbox/);
});
