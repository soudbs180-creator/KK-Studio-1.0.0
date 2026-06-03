import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// Clay global UI source contract.
const ROOT_DIR = process.cwd();



test('canonical design manuals define the Clay-first global UI system', () => {
  assert.equal(existsSync(path.join(ROOT_DIR, 'docs/architecture/DESIGN.md')), true);

  const rootManual = readSource('docs/architecture/DESIGN.md');
  const docsManual = readSource('docs/architecture/DESIGN.md');
  const agentRules = readSource('docs/architecture/DESIGN.md'); // 用 docs/architecture/DESIGN.md 替代已下线的 .agent/rules/skills/SKILL.md

  for (const source of [rootManual, docsManual, agentRules]) {
    assert.match(source, /Clay/i);
    assert.match(source, /#fffaf0/i);
    assert.match(source, /#0a0a0a/i);
    assert.match(source, /#3a3a3a/i);
    assert.match(source, /#6a6a6a/i);
    assert.match(source, /#ff4d8b/i);
    assert.match(source, /#1a3a3a/i);
    assert.match(source, /#b8a4ed/i);
    assert.match(source, /#ffb084/i);
    assert.match(source, /#e8b94a/i);
    assert.match(source, /#ff6b5a/i);
    assert.match(source, /Plain Black|Inter/i);
    assert.match(source, /color block|color-block|色块|饱和/i);
    assert.match(source, /no heavy shadows|flat|无重阴影|低阴影/i);
    assert.match(source, /mobile|desktop|响应式|手机|桌面/i);
    assert.doesNotMatch(source, /Airtable-first|Airtable 风|Airtable-inspired/i);
    assert.doesNotMatch(source, /#181d26|#1b61c9|#e0e2e6/i);
  }
});

test('global tokens use Clay light and dark palettes with bold color-block hierarchy', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /Clay Global UI Refit/i);
  assert.match(cssSource, /--clay-canvas:\s*#fffaf0;/);
  assert.match(cssSource, /--clay-ink:\s*#0a0a0a;/);
  assert.match(cssSource, /--clay-body:\s*#3a3a3a;/);
  assert.match(cssSource, /--clay-muted:\s*#6a6a6a;/);
  assert.match(cssSource, /--clay-paper:\s*#ffffff;/);
  assert.match(cssSource, /--clay-brand-pink:\s*#ff4d8b;/);
  assert.match(cssSource, /--clay-brand-teal:\s*#1a3a3a;/);
  assert.match(cssSource, /--clay-brand-lavender:\s*#b8a4ed;/);
  assert.match(cssSource, /--clay-brand-peach:\s*#ffb084;/);
  assert.match(cssSource, /--clay-brand-ochre:\s*#e8b94a;/);
  assert.match(cssSource, /--clay-brand-coral:\s*#ff6b5a;/);
  assert.match(cssSource, /--clay-brand-pink-ink:\s*#8a123f;/);
  assert.match(cssSource, /--clay-brand-coral-ink:\s*#7a1f16;/);
  assert.match(cssSource, /--font-display:\s*'Plain Black',\s*'Inter'/);
  assert.match(cssSource, /--font-sans:\s*'Inter'/);
  assert.match(cssSource, /--bg-canvas:\s*var\(--clay-canvas\);/);
  assert.match(cssSource, /--text-primary:\s*var\(--clay-ink\);/);
  assert.match(cssSource, /--accent-color:\s*var\(--clay-brand-coral\);/);
  assert.match(cssSource, /--settings-accent-rgb:\s*255 107 90;/);
  assert.match(cssSource, /--search-palette-accent:\s*var\(--clay-brand-pink-ink\);/);
  assert.match(cssSource, /--search-palette-overlay-bg:\s*rgb\(10 10 10 \/ 0\.18\);/);
  assert.match(cssSource, /--search-palette-shadow:\s*var\(--frost-card-framework-shadow\);/);
  assert.match(cssSource, /--clay-shadow-card:\s*none;/);
  assert.match(cssSource, /--settings-card-shadow:\s*var\(--clay-shadow-card\);/);
  assert.match(cssSource, /--motion-duration-standard:\s*160ms;/);
  assert.match(cssSource, /--motion-ease-standard:\s*cubic-bezier\(0\.16, 1, 0\.3, 1\);/);
  assert.match(cssSource, /--tutorial-overlay-bg:\s*rgb\(10 10 10 \/ 0\.24\);/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--search-palette-overlay-bg:\s*rgb\(0 0 0 \/ 0\.38\);/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--search-palette-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--tutorial-overlay-bg:\s*rgb\(0 0 0 \/ 0\.44\);/);
  assert.doesNotMatch(cssSource, /--search-palette-overlay-bg:\s*rgb\(10 26 26 \/ 0\.38\);/);
  assert.doesNotMatch(cssSource, /--search-palette-bg:\s*#1a2a2a;/);
  assert.doesNotMatch(cssSource, /--tutorial-overlay-bg:\s*rgb\(10 26 26 \/ 0\.44\);/);
  assert.doesNotMatch(cssSource, /--airtable-/i);
  assert.doesNotMatch(cssSource, /Airtable-Inspired Global UI Refit/i);
  assert.doesNotMatch(cssSource, /--ui-glass-(?:shell|card)-shadow:\s*0 (?:16|18|20|22|24|34)px/);
  assert.doesNotMatch(cssSource, /--settings-card-shadow:\s*0 (?:10|16|18|20|22|34)px/);
});

test('Clay theme does not animate the whole document tree during theme changes', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const themeTransitionStart = cssSource.indexOf('Global Theme Transition');
  const themeTransitionEnd = cssSource.indexOf('.custom-scrollbar::-webkit-scrollbar', themeTransitionStart);
  const themeTransitionBlock = cssSource.slice(themeTransitionStart, themeTransitionEnd);

  assert.match(themeTransitionBlock, /--theme-transition-duration:\s*0ms;/);
  assert.doesNotMatch(themeTransitionBlock, /body\s*,\s*body \*/);
  assert.doesNotMatch(themeTransitionBlock, /body \*::before|body \*::after/);
  assert.doesNotMatch(themeTransitionBlock, /transition-property:\s*background-color,\s*border-color,\s*color,\s*fill,\s*stroke,\s*box-shadow,\s*opacity;/);
  assert.doesNotMatch(themeTransitionBlock, /transition-property:\s*background-color,\s*border-color,\s*color,\s*fill,\s*stroke,\s*box-shadow;/);
  assert.doesNotMatch(themeTransitionBlock, /transition-duration:\s*0\.3s;/);
  assert.doesNotMatch(cssSource, /Global Theme Transition Fallback[\s\S]*transition-property:\s*background-color,\s*border-color,\s*color,\s*fill,\s*stroke,\s*box-shadow;/);
  assert.match(cssSource, /\.theme-transitioning,[\s\S]*transition:\s*none !important;/);
});

test('dark canvas keeps neutral Clay depth instead of blue-tinted workspace chrome', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const darkModeBlock = cssSource.slice(
    cssSource.indexOf('body.dark-mode {', cssSource.indexOf('Clay Global UI Refit')),
    cssSource.indexOf('}', cssSource.indexOf('body.dark-mode {', cssSource.indexOf('Clay Global UI Refit'))),
  );

  assert.match(darkModeBlock, /--bg-canvas:\s*var\(--clay-dark-canvas\);/);
  assert.match(cssSource, /--clay-dark-canvas:\s*#0b0b0c;/);
  assert.match(cssSource, /--clay-dark-surface:\s*#141414;/);
  assert.match(cssSource, /--clay-dark-elevated:\s*#1f1f1f;/);
  assert.match(darkModeBlock, /--text-primary:\s*#fffaf0;/);
  assert.doesNotMatch(darkModeBlock, /--bg-canvas:\s*#0a1a1a;/);
  assert.doesNotMatch(darkModeBlock, /--bg-canvas:\s*#0b1220;/);
  assert.doesNotMatch(darkModeBlock, /--settings-page-bg:\s*#0b1220;/);
  assert.match(cssSource, /\.canvas-container\s*\{[\s\S]*background-color:\s*var\(--bg-canvas\);/);
});

test('canvas card shadows follow Clay flat-card depth instead of cinematic shadows', () => {
  const shadowSource = readSource('apps/web/src/utils/canvasCardShadow.ts');

  assert.match(shadowSource, /Clay canvas card shadow/i);
  assert.match(shadowSource, /return 'none';/);
  assert.doesNotMatch(shadowSource, /Apple Cinematic/i);
  assert.doesNotMatch(shadowSource, /rgba\(/);
  assert.doesNotMatch(shadowSource, /shadowBoost/);
});

test('search palette uses Clay tokens without heavy shadows or inline focus mutation', () => {
  const source = readSource('apps/web/src/components/layout/SearchPalette.tsx');

  assert.doesNotMatch(source, /shadow-2xl|shadow-xl|shadow-lg/);
  assert.doesNotMatch(source, /bg-indigo|text-indigo|border-indigo/);
  assert.doesNotMatch(source, /bg-black\/45|backdrop-blur-sm/);
  assert.doesNotMatch(source, /ios-mobile-sheet/);
  assert.doesNotMatch(source, /parentElement!\.style\.boxShadow|style\.boxShadow/);
  assert.doesNotMatch(source, /animate-bounce-in/);
  assert.match(source, /var\(--search-palette-overlay-bg\)/);
  assert.match(source, /var\(--frost-card-framework-shadow\)/);
  assert.match(source, /var\(--search-palette-selected-bg\)/);
  assert.match(source, /var\(--search-palette-focus-ring\)/);
  assert.match(source, /var\(--clay-brand-pink\)|var\(--accent-color\)/);
});

test('tutorial overlay uses Clay spotlight and flat action treatment', () => {
  const source = readSource('apps/web/src/components/common/TutorialOverlay.tsx');

  assert.match(source, /DESKTOP_TUTORIAL_STEPS/);
  assert.match(source, /MOBILE_TUTORIAL_STEPS/);
  assert.match(source, /var\(--tutorial-spotlight-border\)/);
  assert.match(source, /var\(--tutorial-spotlight-bg\)/);
  assert.match(source, /var\(--tutorial-dot-bg\)/);
  assert.doesNotMatch(source, /bg-indigo|text-indigo|border-indigo/);
  assert.doesNotMatch(source, /99,\s*102,\s*241|129,\s*140,\s*248/);
  assert.doesNotMatch(source, /shadow-lg|shadow-\[0_32px_64px/);
});

test('mobile workspace shell uses Clay theme tokens instead of hard-coded dark glass', () => {
  const mobileHeader = readSource('apps/web/src/components/mobile/MobileHeader.tsx');
  const mobileWorkspaceSurface = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
  const mobileMoreMenu = readSource('apps/web/src/components/mobile/MobileMoreMenu.tsx');
  const mobileResultFeed = readSource('apps/web/src/components/mobile/MobileResultFeed.tsx');
  const mobileResultTile = readSource('apps/web/src/components/mobile/MobileResultTile.tsx');
  const mobileResultDetail = readSource('apps/web/src/components/mobile/MobileResultDetailScreen.tsx');
  const appPromptComposer = readSource('apps/web/src/app/AppPromptComposer.tsx');
  const combined = [
    mobileHeader,
    mobileWorkspaceSurface,
    mobileMoreMenu,
    mobileResultFeed,
    mobileResultTile,
    mobileResultDetail,
    appPromptComposer,
  ].join('\n');

  assert.match(combined, /var\(--mobile-clay-shell-bg\)/);
  assert.match(combined, /var\(--mobile-clay-surface-bg\)/);
  assert.match(combined, /var\(--mobile-clay-shadow\)/);
  assert.match(mobileResultTile, /var\(--mobile-clay-active-border\)/);
  assert.match(mobileResultDetail, /var\(--mobile-clay-stage-info-bg\)/);
  assert.match(mobileResultDetail, /var\(--mobile-clay-bottom-bar-bg\)/);
  assert.doesNotMatch(combined, /bg-\[#1c1c1e\]|bg-\[rgba\(15,18,28,0\.88\)\]/);
  assert.doesNotMatch(combined, /shadow-2xl|shadow-\[0_18px_44px|shadow-\[0_18px_48px|shadow-\[0_24px_56px|shadow-\[0_16px_36px/);
  assert.doesNotMatch(combined, /backdrop-blur-(?:xl|2xl|md)|backdrop-blur\s/);
  assert.doesNotMatch(combined, /border-blue|ring-blue|text-sky/);
  assert.doesNotMatch(mobileResultDetail, /blue:\s*'border-blue|bg-blue|text-blue/);
});

test('settings controls share motion and overflow-safe Clay sizing primitives', () => {
  const scaffoldSource = readSource('apps/web/src/components/settings/SettingsScaffold.tsx');
  const primitiveSource = readSource('apps/web/src/components/settings/ui/index.tsx');

  assert.match(scaffoldSource, /SETTINGS_CONTROL_MOTION_CLASSNAME/);
  assert.doesNotMatch(scaffoldSource, /transition-opacity duration-150 hover:opacity-70 active:opacity-50/);
  assert.doesNotMatch(scaffoldSource, /borderRadius:\s*tone === 'primary' \? '980px'/);
  assert.match(scaffoldSource, /boxShadow:\s*'var\(--settings-button-primary-shadow\)'/);

  assert.match(primitiveSource, /SETTINGS_CONTROL_MOTION_CLASSNAME/);
  assert.match(primitiveSource, /settings-control-toggle/);
  assert.match(primitiveSource, /translateX\(20px\)/);
  assert.doesNotMatch(primitiveSource, /duration-200 active:scale-95/);
  assert.match(primitiveSource, /var\(--settings-input-shadow\)/);
});

test('API settings default view gives action modules more weight than repeated info modules', () => {
  const viewSource = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(viewSource, /<ApiWorkbenchModelCenterSection/);
  assert.match(viewSource, /\{renderAdvancedPanels\(\)\}/);
  assert.match(cssSource, /settings-model-center-layout[\s\S]*grid-template-columns:\s*minmax\(0, 842px\) minmax\(270px, 1fr\);/);
  assert.match(cssSource, /settings-model-center-route-grid[\s\S]*grid-template-columns:\s*repeat\(auto-fit, minmax\(270px, 1fr\)\);/);
  assert.match(cssSource, /settings-model-center-preset-row/);
  assert.match(viewSource, /if \(!showAdvancedWorkbench\) return null;/);
});
