import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('Clay manuals define the controlled frosted material override', () => {
  const manuals = [
    readSource('DESIGN.md'),
    readSource('docs/DESIGN.md'),
    readSource('.agent/rules/skills/SKILL.md'),
  ].join('\n');

  assert.match(manuals, /controlled frosted|受控磨砂/i);
  assert.match(manuals, /input|输入框/i);
  assert.match(manuals, /main card|主卡/i);
  assert.match(manuals, /sub card|副卡/i);
  assert.match(manuals, /framework card|框架卡/i);
  assert.match(manuals, /neutral black|neutral gray|中性黑灰/i);
  assert.doesNotMatch(manuals, /true dark teal-black theme|teal-black canvas|暗色画布使用 `#0a1a1a`/i);
});

test('Clay CSS exposes shared frosted tokens and neutral black-gray dark surfaces', () => {
  const cssSource = readSource('src/index.css');

  assert.match(cssSource, /--clay-dark-canvas:\s*#0b0b0c;/);
  assert.match(cssSource, /--clay-dark-surface:\s*#141414;/);
  assert.match(cssSource, /--clay-dark-elevated:\s*#1f1f1f;/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--bg-canvas:\s*var\(--clay-dark-canvas\);/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--bg-surface:\s*var\(--clay-dark-surface\);/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--bg-elevated:\s*var\(--clay-dark-elevated\);/);
  assert.doesNotMatch(cssSource, /body\.dark-mode\s*\{[\s\S]*--bg-canvas:\s*#0a1a1a;/);

  for (const token of [
    '--frost-input-bg-solid',
    '--frost-input-bg',
    '--frost-input-border',
    '--frost-input-shadow',
    '--frost-input-blur',
    '--frost-card-main-bg-solid',
    '--frost-card-main-bg',
    '--frost-card-main-border',
    '--frost-card-main-shadow',
    '--frost-card-main-blur',
    '--frost-card-sub-bg-solid',
    '--frost-card-sub-bg',
    '--frost-card-sub-border',
    '--frost-card-sub-shadow',
    '--frost-card-sub-blur',
    '--frost-card-framework-bg-solid',
    '--frost-card-framework-bg',
    '--frost-card-framework-border',
    '--frost-card-framework-shadow',
    '--frost-card-framework-blur',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`));
  }

  assert.match(cssSource, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{[\s\S]*--frost-input-bg:\s*var\(--frost-input-bg-solid\);/);
  assert.match(cssSource, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{[\s\S]*--frost-card-main-bg:\s*var\(--frost-card-main-bg-solid\);/);
  assert.match(cssSource, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{[\s\S]*--frost-card-sub-bg:\s*var\(--frost-card-sub-bg-solid\);/);
  assert.match(cssSource, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{[\s\S]*--frost-card-framework-bg:\s*var\(--frost-card-framework-bg-solid\);/);
});

test('Core UI surfaces consume the shared frosted material tokens', () => {
  const cssSource = readSource('src/index.css');
  const searchPaletteSource = readSource('src/components/layout/SearchPalette.tsx');
  const sidebarSource = readSource('src/components/layout/Sidebar.tsx');
  const composerSource = readSource('src/app/AppPromptComposer.tsx');

  assert.match(cssSource, /\.input-bar\s*\{[\s\S]*background:\s*var\(--frost-input-bg\);/);
  assert.match(cssSource, /\.input-bar\s*\{[\s\S]*border:\s*1px solid var\(--frost-input-border\);[\s\S]*box-shadow:\s*var\(--frost-input-shadow\);[\s\S]*backdrop-filter:\s*blur\(var\(--frost-input-blur\)\)/);
  assert.match(cssSource, /\.settings-panel \.api-settings-view input:not\(\[type="color"\]\):not\(\[type="checkbox"\]\),[\s\S]*background:\s*var\(--frost-input-bg\);/);
  assert.match(cssSource, /\.settings-panel \.settings-reference-card,[\s\S]*background:\s*var\(--frost-card-main-bg\);/);
  assert.match(cssSource, /\.settings-panel \.settings-reference-card,[\s\S]*border-color:\s*var\(--frost-card-main-border\)[\s\S]*box-shadow:\s*var\(--frost-card-main-shadow\)[\s\S]*backdrop-filter:\s*blur\(var\(--frost-card-main-blur\)\)/);
  assert.match(cssSource, /\.settings-panel \.settings-provider-card__metric,[\s\S]*background:\s*var\(--frost-card-sub-bg\);/);
  assert.match(cssSource, /\.settings-panel \.settings-provider-card__metric,[\s\S]*border-color:\s*var\(--frost-card-sub-border\)[\s\S]*box-shadow:\s*var\(--frost-card-sub-shadow\)[\s\S]*backdrop-filter:\s*blur\(var\(--frost-card-sub-blur\)\)/);
  assert.match(cssSource, /\.settings-panel \.settings-shell,[\s\S]*background:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /\.settings-panel \.settings-shell,[\s\S]*border-color:\s*var\(--frost-card-framework-border\)[\s\S]*box-shadow:\s*var\(--frost-card-framework-shadow\)[\s\S]*backdrop-filter:\s*blur\(var\(--frost-card-framework-blur\)\)/);
  assert.match(cssSource, /--settings-nav-glass-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.doesNotMatch(cssSource, /--settings-nav-glass-bg:\s*var\(--clay-brand-teal\);/);

  assert.match(searchPaletteSource, /var\(--frost-card-framework-bg\)/);
  assert.match(searchPaletteSource, /var\(--frost-card-framework-border\)/);
  assert.match(searchPaletteSource, /var\(--frost-card-framework-shadow\)/);
  assert.match(searchPaletteSource, /var\(--frost-input-bg\)/);
  assert.match(sidebarSource, /var\(--frost-card-framework-bg\)/);
  assert.match(composerSource, /var\(--frost-card-framework-bg\)/);
});

test('Prompt bar surfaces avoid stale blue-glass shells and heavy shadows', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const cssSource = readSource('src/index.css');

  assert.match(promptBarSource, /var\(--frost-card-framework-bg\)/);
  assert.match(promptBarSource, /var\(--frost-card-sub-bg\)/);
  assert.match(promptBarSource, /var\(--frost-input-bg\)/);
  assert.match(promptBarSource, /var\(--accent-coral\)/);
  assert.match(cssSource, /--prompt-bar-liquid-send-shadow:\s*var\(--frost-card-main-shadow\);/);
  assert.doesNotMatch(promptBarSource, /#3B82F6|#2563EB|rgba\(96, 165, 250|rgba\(59, 130, 246/);
  assert.doesNotMatch(promptBarSource, /#60a5fa|rgba\(37, 99, 235|ring-white\/20|dark:ring-white|dark:border-white/);
  assert.doesNotMatch(promptBarSource, /focus-visible:ring-blue|focus:border-indigo|bg-sky|border-sky|text-sky/);
  assert.doesNotMatch(promptBarSource, /shadow-2xl|shadow-xl|shadow-lg|hover:shadow-lg/);
  assert.doesNotMatch(promptBarSource, /drop-shadow-\[0_1px_10px|ring-white\/80|shadow-\[0_0_36px|drop-shadow-\[0_1px_8px|shadow-\[0_10px_30px/);
  assert.doesNotMatch(promptBarSource, /dark:bg-zinc|text-slate/);
  assert.doesNotMatch(promptBarSource, /rgba\(56,189,248|rgba\(14,165,233/);
  assert.doesNotMatch(promptBarSource, /style=\{\{ backgroundColor: 'var\(--bg-tertiary\)', borderColor: 'var\(--border-light\)'/);
  assert.doesNotMatch(promptBarSource, /hover:bg-white\/5" onClick=\{\(\) => appendPptTemplateSlide/);
});

test('Image canvas cards use Clay accents and frosted canvas tokens', () => {
  const imageCardSource = readSource('src/components/image/ImageCard2.tsx');

  assert.match(imageCardSource, /var\(--frost-card-main-bg\)/);
  assert.match(imageCardSource, /var\(--frost-card-sub-bg\)/);
  assert.match(imageCardSource, /var\(--accent-coral\)/);
  assert.doesNotMatch(imageCardSource, /rgba\(59, 130, 246|showSelectionBorder \? 'blue'|text-blue-400/);
  assert.doesNotMatch(imageCardSource, /hover:bg-indigo|from-indigo|to-indigo|text-indigo|bg-blue|border-blue/);
  assert.doesNotMatch(imageCardSource, /shadow-2xl|shadow-xl|shadow-lg/);
  assert.doesNotMatch(imageCardSource, /hover:text-\[var\(--accent-blue\)\]/);
});

test('secondary framework surfaces from audit findings use frosted tokens instead of blue glass fallbacks', () => {
  const sidebarSource = readSource('src/components/layout/Sidebar.tsx');
  const projectManagerSource = readSource('src/components/settings/ProjectManager.tsx');
  const pendingNodeSource = readSource('src/components/canvas/PendingNode.tsx');
  const cssSource = readSource('src/index.css');

  assert.match(sidebarSource, /frostedSidebarSubSurfaceStyle/);
  assert.doesNotMatch(sidebarSource, /backgroundColor: 'var\(--bg-tertiary\)'|backgroundColor: 'var\(--bg-secondary\)'/);
  assert.match(cssSource, /\.sidebar-nav-item\.active\s*\{[\s\S]*background:\s*var\(--frost-card-sub-bg\);[\s\S]*color:\s*var\(--accent-coral\);/);

  assert.match(pendingNodeSource, /var\(--frost-card-main-bg\)/);
  assert.match(pendingNodeSource, /var\(--frost-card-sub-bg\)/);
  assert.doesNotMatch(pendingNodeSource, /var\(--bg-secondary\)|var\(--bg-tertiary\)|rgba\(99,102,241|rgba\(56,189,248|shadow-xl/);

  assert.match(projectManagerSource, /var\(--frost-card-framework-bg\)/);
  assert.match(projectManagerSource, /var\(--frost-card-sub-bg\)/);
  assert.match(projectManagerSource, /var\(--frost-input-bg\)/);
  assert.match(projectManagerSource, /var\(--accent-coral\)/);
  assert.doesNotMatch(projectManagerSource, /var\(--accent-indigo\)|text-sky|bg-indigo|#27272a|shadow-2xl/);

  assert.match(cssSource, /\.ios-mobile-project-pill,[\s\S]*\.mobile-card-group\s*\{[\s\S]*background:\s*var\(--mobile-clay-shell-bg\) !important;/);
  assert.match(cssSource, /\.mobile-card-stream__empty,[\s\S]*background:\s*var\(--mobile-clay-shell-bg\) !important;/);
  assert.match(cssSource, /--settings-option-bg:\s*var\(--frost-card-sub-bg\);/);
  assert.match(cssSource, /--settings-surface-muted:\s*var\(--frost-card-sub-bg\);/);
});
