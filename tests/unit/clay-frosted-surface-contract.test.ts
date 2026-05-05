import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function extractCssBlock(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'g'))];
  assert.ok(matches.length > 0, `Missing CSS block for ${selector}`);
  return matches[matches.length - 1][1];
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
  assert.match(cssSource, /--selected-bg:\s*rgb\(255 77 139 \/ 0\.1[24]\);/);
  assert.match(cssSource, /--selected-border:\s*rgb\(255 (?:77 139|176 132) \/ 0\.[34][02]\);/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--selected-bg:\s*rgb\(255 77 139 \/ 0\.18\);/);
  assert.match(cssSource, /body\.dark-mode\s*\{[\s\S]*--selected-border:\s*rgb\(255 176 132 \/ 0\.38\);/);
  assert.doesNotMatch(cssSource, /--selected-bg:\s*rgba\(59, 130, 246/);
  assert.doesNotMatch(cssSource, /--selected-border:\s*rgba\(59, 130, 246/);

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
  assert.match(cssSource, /\.settings-panel \.settings-shell-desktop,[\s\S]*\.settings-panel \.settings-shell-mobile \{[\s\S]*background:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /\.settings-panel \.settings-shell-desktop,[\s\S]*\.settings-panel \.settings-shell-mobile \{[\s\S]*border:\s*0 !important;[\s\S]*box-shadow:\s*var\(--frost-card-framework-shadow\) !important;[\s\S]*backdrop-filter:\s*blur\(var\(--frost-card-framework-blur\)\)/);
  assert.match(cssSource, /\.settings-panel \.settings-api-action-stage\s*\{[\s\S]*background:\s*transparent !important;[\s\S]*box-shadow:\s*none !important;[\s\S]*backdrop-filter:\s*none;/);
  assert.match(cssSource, /\.settings-panel \.settings-api-quick-add\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*transparent !important;[\s\S]*box-shadow:\s*none !important;/);
  assert.match(cssSource, /\.settings-panel \.settings-api-info-stage\s*\{[\s\S]*border-top:\s*1px solid var\(--frost-card-sub-border\) !important;[\s\S]*background:\s*transparent !important;[\s\S]*box-shadow:\s*none !important;/);
  assert.match(cssSource, /--settings-nav-glass-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.doesNotMatch(cssSource, /--settings-nav-glass-bg:\s*var\(--clay-brand-teal\);/);

  assert.match(searchPaletteSource, /var\(--frost-card-framework-bg\)/);
  assert.match(searchPaletteSource, /var\(--frost-card-framework-border\)/);
  assert.match(searchPaletteSource, /var\(--frost-card-framework-shadow\)/);
  assert.match(searchPaletteSource, /var\(--frost-input-bg\)/);
  assert.match(searchPaletteSource, /var\(--frost-card-sub-bg\)/);
  assert.match(searchPaletteSource, /var\(--frost-card-sub-border\)/);
  assert.doesNotMatch(searchPaletteSource, /var\(--settings-button-secondary-bg\)|var\(--settings-button-secondary-border\)/);
  assert.match(sidebarSource, /var\(--frost-card-framework-bg\)/);
  assert.match(composerSource, /var\(--frost-card-framework-bg\)/);
});

test('Prompt bar surfaces avoid stale blue-glass shells and heavy shadows', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const mobileAdvancedDrawerSource = readSource('src/components/layout/prompt-bar/MobileEmbeddedAdvancedDrawer.tsx');
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
  assert.doesNotMatch(promptBarSource, /#38bdf8/);
  assert.doesNotMatch(promptBarSource, /style=\{\{ backgroundColor: 'var\(--bg-tertiary\)', borderColor: 'var\(--border-light\)'/);
  assert.doesNotMatch(promptBarSource, /hover:bg-white\/5" onClick=\{\(\) => appendPptTemplateSlide/);
  assert.doesNotMatch(promptBarSource, /bg-white\/5 border border-white\/5|border-white\/10|bg-white\/20|bg-white\/12|border-white\/60/);
  assert.doesNotMatch(promptBarSource, /--mobile-glass-(?:bg|border|shadow)/);
  assert.doesNotMatch(promptBarSource, /border border-white\/8 bg-black\/15/);
  assert.match(cssSource, /--mobile-glass-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /--mobile-glass-border:\s*var\(--frost-card-framework-border\);/);
  assert.match(cssSource, /--mobile-glass-shadow:\s*var\(--frost-card-framework-shadow\);/);

  assert.match(mobileAdvancedDrawerSource, /var\(--frost-card-sub-bg\)/);
  assert.match(mobileAdvancedDrawerSource, /var\(--frost-card-sub-border\)/);
  assert.match(mobileAdvancedDrawerSource, /var\(--toolbar-hover\)/);
  assert.doesNotMatch(mobileAdvancedDrawerSource, /hover:bg-white\/5|border-white\/|bg-white\/|border-t border-white/);
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
  assert.doesNotMatch(projectManagerSource, /var\(--accent-indigo\)|text-sky|bg-indigo|#27272a|shadow-2xl|bg-white\/5|border-white\/10|backgroundColor: 'var\(--bg-tertiary\)'|backgroundColor: 'var\(--bg-secondary\)'/);

  assert.match(cssSource, /\.ios-mobile-project-pill,[\s\S]*\.mobile-card-group\s*\{[\s\S]*background:\s*var\(--mobile-clay-shell-bg\) !important;/);
  assert.match(cssSource, /\.mobile-card-stream__empty,[\s\S]*background:\s*var\(--mobile-clay-shell-bg\) !important;/);
  assert.match(cssSource, /\.mobile-card-main__index\s*\{[\s\S]*color:\s*var\(--mobile-clay-stage-info-text\);[\s\S]*background:\s*var\(--mobile-clay-stage-info-bg\);/);
  assert.match(cssSource, /\.mobile-card-sub__badge\s*\{[\s\S]*color:\s*var\(--mobile-clay-stage-info-text\);[\s\S]*background:\s*var\(--mobile-clay-stage-info-bg\);/);
  for (const selector of [
    '.ios-mobile-project-dropdown__create',
    '.mobile-card-stream__eyebrow',
    '.mobile-card-stream__empty',
    '.mobile-card-stream__empty-badge',
    '.mobile-card-main__index',
    '.mobile-card-sub__badge',
  ]) {
    assert.doesNotMatch(extractCssBlock(cssSource, selector), /rgba\(59,\s*130,\s*246|\#38bdf8|\#3b82f6|rgba\(56,\s*189,\s*248|linear-gradient\(90deg/);
  }
  assert.match(cssSource, /--settings-option-bg:\s*var\(--frost-card-sub-bg\);/);
  assert.match(cssSource, /--settings-surface-muted:\s*var\(--frost-card-sub-bg\);/);
});

test('remaining active chrome and fallback surfaces consume Clay frosted tokens', () => {
  const desktopChromeSource = readSource('src/app/AppDesktopChrome.tsx');
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');
  const ecommerceImportPanelSource = readSource('src/components/ecommerce/EcommerceImportPanel.tsx');
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const workflowUtilitySource = readSource('src/workflow/nodes/WorkflowUtilityCard.tsx');
  const lazyBoundarySource = readSource('src/components/common/LazyModuleBoundary.tsx');
  const errorBoundarySource = readSource('src/components/common/ErrorBoundary.tsx');
  const mainSource = readSource('src/main.tsx');
  const userProfileSource = readSource('src/components/modals/UserProfileModal.tsx');
  const rechargeModalSource = readSource('src/components/modals/RechargeModal.tsx');
  const cssSource = readSource('src/index.css');

  for (const source of [
    desktopChromeSource,
    chatSidebarSource,
    workflowUtilitySource,
    lazyBoundarySource,
    errorBoundarySource,
    mainSource,
    userProfileSource,
  ]) {
    assert.match(source, /var\(--frost-card-framework-bg(?:,|\))|var\(--frost-card-main-bg\)|var\(--frost-card-sub-bg(?:,|\))/);
    assert.doesNotMatch(source, /from-blue|to-cyan|bg-blue|border-blue|text-blue|focus:border-indigo|bg-indigo|from-indigo|via-purple|hover:shadow-blue/);
    assert.doesNotMatch(source, /shadow-2xl|shadow-xl|#111217|#18181b|#09090b|#27272a|#2a2a2e/);
  }

  assert.match(desktopChromeSource, /var\(--frost-card-framework-bg\)/);
  assert.match(desktopChromeSource, /var\(--accent-coral\)/);
  assert.match(chatSidebarSource, /var\(--frost-input-bg\)/);
  assert.match(chatSidebarSource, /var\(--clay-brand-lavender\)/);
  assert.doesNotMatch(chatSidebarSource, /bg-violet-500\/15|border-violet-400\/30|text-violet-300|hover:bg-violet-500\/25/);
  assert.doesNotMatch(chatSidebarSource, /text-purple-400|text-green-400/);
  assert.doesNotMatch(chatSidebarSource, /bg-\[var\(--bg-tertiary\)\] text-\[var\(--text-primary\)\] rounded-tr-md border border-\[var\(--border-light\)\]/);
  assert.doesNotMatch(chatSidebarSource, /bg-\[var\(--bg-tertiary\)\] border border-\[var\(--border-light\)\]/);
  assert.doesNotMatch(chatSidebarSource, /object-cover bg-\[var\(--bg-secondary\)\]|bg-\[var\(--bg-tertiary\)\] cursor-default|border border-\[var\(--border-light\)\] bg-\[var\(--bg-tertiary\)\]/);
  assert.match(ecommerceImportPanelSource, /var\(--toolbar-hover\)/);
  assert.doesNotMatch(ecommerceImportPanelSource, /hover:bg-white\/5/);
  assert.match(promptNodeSource, /var\(--clay-brand-lavender\)|var\(--state-info-text\)/);
  assert.doesNotMatch(promptNodeSource, /text-violet-|rgba\(59, 130, 246/);
  assert.match(workflowUtilitySource, /var\(--frost-card-main-bg\)/);
  assert.match(workflowUtilitySource, /var\(--frost-card-sub-bg\)/);
  assert.match(lazyBoundarySource, /var\(--frost-card-framework-blur\)/);
  assert.match(errorBoundarySource, /var\(--bg-canvas\)/);
  assert.match(mainSource, /var\(--bg-canvas, #0b0b0c\)/);
  assert.match(userProfileSource, /kk-user-profile-modal/);
  assert.match(userProfileSource, /var\(--frost-card-framework-bg\)/);
  assert.match(userProfileSource, /var\(--frost-card-main-border\)/);
  assert.match(userProfileSource, /var\(--frost-input-bg\)/);
  assert.match(rechargeModalSource, /background:\s*'var\(--clay-brand-peach\)'/);
  assert.match(rechargeModalSource, /color:\s*'var\(--clay-ink\)'/);
  assert.doesNotMatch(rechargeModalSource, /background:\s*'var\(--settings-button-primary-bg\)'[\s\S]*color:\s*'var\(--text-inverse\)'/);
  assert.match(cssSource, /\.kk-user-profile-modal__action-list\s*\{[\s\S]*background:\s*var\(--frost-card-sub-bg\);/);
  assert.match(cssSource, /\.kk-user-profile-modal__action-list > button,[\s\S]*border-width:\s*0 !important;[\s\S]*box-shadow:\s*none !important;/);
  assert.match(cssSource, /\.kk-user-profile-modal__sub-card\s*\{[\s\S]*background:\s*var\(--frost-card-sub-bg\) !important;[\s\S]*border-color:\s*var\(--frost-card-sub-border\) !important;/);
  assert.match(userProfileSource, /kk-user-profile-modal__notice--warning/);
  assert.match(cssSource, /\.kk-user-profile-modal \[class\*="text-amber-200"\][\s\S]*color:\s*var\(--state-warning-text\) !important;/);

  const tagInputSource = readSource('src/components/modals/TagInputModal.tsx');
  assert.match(tagInputSource, /tag-input-modal/);
  assert.match(tagInputSource, /var\(--frost-card-framework-bg\)/);
  assert.match(tagInputSource, /var\(--frost-card-sub-bg\)/);
  assert.match(tagInputSource, /var\(--frost-input-bg\)/);
  assert.doesNotMatch(tagInputSource, /var\(--accent-blue\)|var\(--glow-blue\)|rgba\(37, 99, 235|shadow-2xl|boxShadow: 'var\(--shadow-xl\)'|backgroundColor: 'var\(--bg-input\)'|backgroundColor: 'var\(--bg-secondary\)'/);

  assert.doesNotMatch(cssSource, /--circle-color:\s*(?:67,\s*56,\s*202|29,\s*78,\s*216|126,\s*34,\s*206|109,\s*40,\s*217)/);
  assert.doesNotMatch(cssSource, /--circle-color-alt:\s*(?:37,\s*99,\s*235|20,\s*60,\s*180|109,\s*40,\s*217)/);
});
