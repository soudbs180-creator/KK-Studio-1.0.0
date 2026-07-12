import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('prompt bar keeps footer wrapping while allowing full desktop control labels', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const ecommercePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const topRowSource = readSource('apps/web/src/components/layout/prompt-bar/PromptBarTopRow.tsx');
  const topRowDesktopSource = readSource('apps/web/src/components/layout/prompt-bar/PromptBarTopRowDesktop.tsx');
  const footerShellSource = readSource('apps/web/src/components/layout/prompt-bar/PromptBarFooter.tsx');
  const footerSource = readSource('apps/web/src/components/layout/prompt-bar/PromptBarFooterDesktop.tsx');
  const modePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const cssSource = readSource('apps/web/src/index.css');
  const desktopLiquidSources = [promptBarSource, modePanelSource, footerSource, cssSource].join('\n');

  assert.match(
    footerSource,
    /className="input-bar-footer flex w-full min-w-0 flex-wrap items-center gap-1\.5 px-1 pb-1 pt-0\.5 min-h-\[42px\]"/,
  );
  assert.match(promptBarSource, /DesktopComposerEcommercePanel = (lazyWithRetry|React\.lazy|lazy)/);
  assert.match(ecommercePanelSource, /const DesktopComposerEcommercePanel: React\.FC/);
  assert.match(promptBarSource, /import PromptBarTopRow from '\.\/prompt-bar\/PromptBarTopRow';/);
  assert.match(promptBarSource, /import PromptBarFooter from '\.\/prompt-bar\/PromptBarFooter';/);
  assert.match(topRowSource, /if \(isMobile\) \{\s*return <PromptBarTopRowMobile>\{children\}<\/PromptBarTopRowMobile>;\s*\}/);
  assert.match(topRowSource, /return <PromptBarTopRowDesktop>\{children\}<\/PromptBarTopRowDesktop>;/);
  assert.match(topRowDesktopSource, /className="flex items-center justify-between gap-1\.5"/);
  assert.match(footerShellSource, /if \(isMobile\) \{\s*return <PromptBarFooterMobile>\{children\}<\/PromptBarFooterMobile>;\s*\}/);
  assert.match(footerShellSource, /return <PromptBarFooterDesktop>\{children\}<\/PromptBarFooterDesktop>;/);
  assert.match(modePanelSource, /className=\{`relative inline-flex \$\{isMobile \? 'min-w-0 shrink-0' : 'min-w-fit flex-shrink-0'\}`\}/);
  assert.match(
    modePanelSource,
    /<span className="whitespace-nowrap">[\s\S]*\{config\.aspectRatio === AspectRatio\.AUTO \? [^:]+ : config\.aspectRatio\}[\s\S]*\{config\.imageSize\}[\s\S]*<\/span>/,
  );
  assert.match(
    modePanelSource,
    /!isMobile && networkControls \? \(\s*<div className="flex min-w-0 max-w-full items-center gap-1\.5">\{networkControls\}<\/div>\s*\) : null/,
  );
  assert.match(desktopLiquidSources, /prompt-bar-liquid-button/);
  assert.match(desktopLiquidSources, /prompt-bar-liquid-group/);
  assert.match(desktopLiquidSources, /prompt-bar-liquid-send/);
  assert.match(promptBarSource, /className="relative h-full w-\[58px\]"/);
  assert.match(promptBarSource, /enableGrounding[\s\S]*<span className="min-w-0 truncate whitespace-nowrap">/);
  assert.match(promptBarSource, /enableImageSearch[\s\S]*<span className="min-w-0 truncate whitespace-nowrap">/);
  assert.match(promptBarSource, /className=\{`\$\{className\} group relative flex h-10 max-w-full min-w-0 shrink items-center gap-2 rounded-full pl-3\.5 pr-1 transition-colors duration-200`\}/);
  assert.match(promptBarSource, /\$\{className\} group relative flex h-10 max-w-full min-w-0 shrink flex-row items-center whitespace-nowrap rounded-full px-1 py-1 overflow-hidden/);
});

test('prompt bar tones down send button and mode switcher motion flourishes on desktop', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const modeSwitcherSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx');

  assert.doesNotMatch(promptBarSource, /const ModeSwitcherStyles =/);
  assert.doesNotMatch(promptBarSource, /<ModeSwitcherStyles \/>/);
  assert.doesNotMatch(promptBarSource, /send-button-glow/);
  assert.doesNotMatch(promptBarSource, /<Sparkles size=\{14\} className="animate-pulse"/);
  assert.doesNotMatch(promptBarSource, /group-hover:scale-105 backdrop-blur-sm overflow-hidden/);
  assert.doesNotMatch(promptBarSource, /hover:scale-\[1\.025\] active:scale-\[0\.985\]/);
  assert.doesNotMatch(modeSwitcherSource, /animate-pulse-once/);
  assert.doesNotMatch(modeSwitcherSource, /scale-105/);
  assert.doesNotMatch(modeSwitcherSource, /active:scale-95/);
  assert.doesNotMatch(modeSwitcherSource, /cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
});

test('desktop mode switcher animates the active pill with transform instead of layout-driven left changes', () => {
  const modeSwitcherSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx');

  assert.match(modeSwitcherSource, /const sliderOffset =/);
  assert.match(modeSwitcherSource, /transition-\[transform,background-color,border-color,box-shadow\]/);
  assert.match(modeSwitcherSource, /transform:\s*`translate3d\(\$\{sliderOffset\}px, 0, 0\)`/);
  assert.doesNotMatch(modeSwitcherSource, /const sliderLeft =/);
  assert.doesNotMatch(modeSwitcherSource, /left:\s*`\$\{sliderLeft\}px`/);
});

test('mobile embedded composer keeps the upload affordance inside the input area instead of spending a dedicated row when empty', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.match(
    promptBarSource,
    /const shouldRenderInlineMobileUploadButton = isMobile && config\.mode !== GenerationMode\.ECOMMERCE && config\.referenceImages\.length === 0 && uploadingCount === 0;/,
  );
  assert.match(
    promptBarSource,
    /const shouldRenderStandaloneUploadRow = !isMobile && config\.mode !== GenerationMode\.ECOMMERCE && config\.referenceImages\.length === 0 && uploadingCount === 0;/,
  );
  assert.match(promptBarSource, /shouldRenderInlineMobileUploadButton && \(/);
});

test('prompt bar keeps the textarea transparent while reserving the frosted footer layer for mobile only', () => {
  const desktopFooterSource = readSource('apps/web/src/components/layout/prompt-bar/PromptBarFooterDesktop.tsx');
  const mobileFooterSource = readSource('apps/web/src/components/layout/prompt-bar/PromptBarFooterMobile.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.doesNotMatch(desktopFooterSource, /prompt-bar-footer-frost/);
  assert.match(mobileFooterSource, /data-mobile-action-overflow-policy="single-row-primary-secondary-drawer"/);
  assert.match(mobileFooterSource, /className="input-bar-footer prompt-bar-footer-frost flex w-full flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible px-1 pb-1 pt-0\.5 min-h-\[44px\]"/);
  assert.match(cssSource, /\.prompt-bar-footer-frost\s*\{/);
  assert.match(cssSource, /\.prompt-bar-footer-frost::before\s*\{/);
  assert.match(cssSource, /border-top: [12]px solid var\(--prompt-bar-footer-frost-border\);/);
  assert.doesNotMatch(cssSource, /\.prompt-bar-footer-frost\s*\{[\s\S]*border: 1px solid var\(--prompt-bar-footer-frost-border\);/);
  assert.match(cssSource, /\.input-bar-textarea\s*\{[\s\S]*background: transparent;/);
});

test('prompt bar keeps a real frosted shell while desktop options stay inside the composer surface', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const modePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const imageOptionsSource = readSource('apps/web/src/components/image/ImageOptionsPanel.tsx');
  const videoOptionsSource = readSource('apps/web/src/components/video/VideoOptionsPanel.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /\.input-bar\s*\{[\s\S]*backdrop-filter: blur\(22px\) saturate\(160%\);/);
  assert.match(cssSource, /\.input-bar\s*\{[\s\S]*-webkit-backdrop-filter: blur\(22px\) saturate\(160%\);/);
  assert.match(promptBarSource, /config\.mode === GenerationMode\.IMAGE \|\| config\.mode === GenerationMode\.PPT \|\| config\.mode === GenerationMode\.ECOMMERCE/);
  assert.match(promptBarSource, /<ImageOptionsPanel[\s\S]*<VideoOptionsPanel/);
  assert.match(modePanelSource, /const DESKTOP_PANEL_EXIT_MS = 180;/);
  assert.match(modePanelSource, /const \[isDesktopPanelVisible, setIsDesktopPanelVisible\] = useState\(showOptionsPanel\);/);
  assert.match(modePanelSource, /const \[isDesktopPanelClosing, setIsDesktopPanelClosing\] = useState\(false\);/);
  assert.match(modePanelSource, /bottom:\s*'calc\(100% - 4px\)'/);
  assert.match(modePanelSource, /animate-fadeOut/);
  assert.match(modePanelSource, /<div ref=\{optionsPanelRef\}>\s*\{optionsPanelContent\}\s*<\/div>/);
  assert.doesNotMatch(modePanelSource, /className="rounded-\[26px\] border p-2 shadow-2xl"/);
  assert.doesNotMatch(imageOptionsSource, /const SECTION_STYLE/);
  assert.doesNotMatch(imageOptionsSource, /rounded-2xl border p-3/);
  assert.match(videoOptionsSource, /className="mb-4 last:mb-0"/);
  assert.doesNotMatch(videoOptionsSource, /rounded-2xl border p-3/);
  assert.doesNotMatch(modePanelSource, /createPortal/);
});

test('prompt bar centers the desktop model dropdown on the trigger instead of left-aligning the menu shell', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.doesNotMatch(promptBarSource, /className="absolute left-0 bottom-full mb-3 z-50 animate-fadeIn origin-bottom"/);
  assert.match(
    promptBarSource,
    /className="kk-prompt-bar-deep-popover-host animate-fadeIn origin-bottom"/,
  );
  assert.match(promptBarSource, /zIndex:\s*KK_LAYER\.dropdown/);
  assert.doesNotMatch(promptBarSource, /className="fixed z-\[10000\] animate-fadeIn origin-bottom"/);
});

test('prompt bar normal action buttons share a flat shadow while the send button keeps model-color emphasis without heavy shadows', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');

  assert.match(cssSource, /--prompt-bar-liquid-shadow: none;/);
  assert.match(cssSource, /--prompt-bar-liquid-send-shadow: none;/);
  assert.match(cssSource, /\.prompt-bar-liquid-button \{\s*background: var\(--prompt-bar-liquid-bg\);\s*border-color: var\(--prompt-bar-liquid-border\);\s*box-shadow: var\(--prompt-bar-liquid-shadow\);/);
  assert.match(cssSource, /\.prompt-bar-liquid-group \{\s*background: var\(--prompt-bar-liquid-group-bg\);\s*border-color: var\(--prompt-bar-liquid-border\);\s*box-shadow: var\(--prompt-bar-liquid-shadow\);/);
  assert.match(cssSource, /\.prompt-bar-liquid-send \{\s*box-shadow: var\(--prompt-bar-liquid-send-shadow\);/);
  assert.doesNotMatch(promptBarSource, /getCreditModelSurfaceStyle/);
  assert.doesNotMatch(promptBarSource, /boxShadow:\s*`0 2px 8px/);
  assert.doesNotMatch(promptBarSource, /boxShadow:\s*'var\(--frost-card-main-shadow\)'/);
  assert.doesNotMatch(promptBarSource, /shadow-\[var\(--frost-card-sub-shadow\)\]/);
  assert.doesNotMatch(
    cssSource,
    /\.input-bar-option,[\s\S]{0,240}box-shadow:\s*var\(--frost-card-sub-shadow\);/,
    'final material bindings must not re-add heavy shadows to normal prompt footer buttons',
  );
});

test('prompt bar model library and footer controls use frosted flat defaults with hover-only gradients and bright enabled toggles', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const uiTokenSource = readSource('apps/web/src/styles/kk-ui-tokens.css');
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const imageOptionsSource = readSource('apps/web/src/components/image/ImageOptionsPanel.tsx');
  const footerFrostRule = cssSource.match(/\.prompt-bar-footer-frost::before\s*\{[\s\S]*?\}/)?.[0] || '';

  assert.match(cssSource, /--prompt-bar-liquid-bg:\s*rgba\(/);
  assert.match(cssSource, /--prompt-bar-liquid-bg-hover:\s*linear-gradient\(/);
  assert.match(cssSource, /--prompt-bar-liquid-group-bg:\s*rgba\(/);
  assert.match(cssSource, /--prompt-bar-liquid-group-bg-hover:\s*linear-gradient\(/);
  assert.match(cssSource, /\.prompt-bar-liquid-button:hover\s*\{[\s\S]*background:\s*var\(--prompt-bar-liquid-bg-hover\);/);
  assert.match(cssSource, /\.prompt-bar-liquid-group:hover\s*\{[\s\S]*background:\s*var\(--prompt-bar-liquid-group-bg-hover\);/);
  assert.match(cssSource, /\.prompt-bar-footer-frost::before\s*\{[\s\S]*inset:\s*0;/);
  assert.doesNotMatch(footerFrostRule, /inset:\s*-\d/);
  assert.doesNotMatch(footerFrostRule, /transform:/);
  assert.doesNotMatch(cssSource, /--prompt-bar-liquid-bg:\s*linear-gradient\(/);
  assert.doesNotMatch(cssSource, /--prompt-bar-liquid-group-bg:\s*linear-gradient\(/);

  assert.match(promptBarSource, /const modelLibrarySurfaceStyle: React\.CSSProperties = \{/);
  assert.match(promptBarSource, /const modelLibrarySearchSurfaceStyle: React\.CSSProperties = \{/);
  assert.match(promptBarSource, /background:\s*'var\(--frost-card-framework-bg\)'/);
  assert.match(promptBarSource, /className="kk-prompt-bar-deep-count-sheet"/);
  assert.match(uiTokenSource, /\.kk-prompt-bar-deep-count-sheet\s*\{[\s\S]*backdrop-filter: blur\(var\(--frost-card-framework-blur\)\) saturate\(1\.18\);/);
  assert.match(uiTokenSource, /\.kk-prompt-bar-deep-count-sheet\s*\{[\s\S]*-webkit-backdrop-filter: blur\(var\(--frost-card-framework-blur\)\) saturate\(1\.18\);/);
  assert.match(promptBarSource, /style=\{\{ \.\.\.modelLibrarySearchSurfaceStyle, width: 'min\(22rem, calc\(100vw - 24px\)\)' \}\}/);
  assert.match(promptBarSource, /style=\{\{ \.\.\.modelLibrarySurfaceStyle, borderRadius: '1rem' \}\}/);
  assert.doesNotMatch(promptBarSource, /background:\s*'color-mix\(in srgb, var\(--bg-overlay\) 96%, transparent\)'/);
  assert.match(promptBarSource, /rounded-md border transition-all text-\[11px\] font-medium \$\{config\.enableGrounding/);
  assert.match(promptBarSource, /rounded-md border transition-all text-\[11px\] font-medium \$\{config\.enableImageSearch/);
  assert.match(promptBarSource, /bg-\[image:var\(--prompt-bar-toggle-active-bg\)\]/);
  assert.doesNotMatch(promptBarSource, /bg-\[var\(--prompt-bar-toggle-active-bg\)\]/);
  assert.match(promptBarSource, /border-transparent text-\[var\(--text-secondary\)\]/);

  assert.match(imageOptionsSource, /const ACTIVE_TOGGLE_STYLE: React\.CSSProperties = \{/);
  assert.match(imageOptionsSource, /background:\s*'var\(--prompt-bar-toggle-active-bg\)'/);
  assert.match(imageOptionsSource, /color:\s*'var\(--prompt-bar-toggle-active-text\)'/);
  assert.match(imageOptionsSource, /boxShadow:\s*'var\(--prompt-bar-toggle-active-shadow\)'/);
});

test('mobile prompt footer stays single-row and lets controls overflow horizontally instead of wrapping', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const modePanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const footerSource = readSource('apps/web/src/components/layout/prompt-bar/PromptBarFooterMobile.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(footerSource, /data-mobile-action-overflow-policy="single-row-primary-secondary-drawer"/);
  assert.match(footerSource, /flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible/);
  assert.doesNotMatch(promptBarSource, /isMobile \? 'grid w-full grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.doesNotMatch(promptBarSource, /isMobile \? \(isEmbeddedMobileComposer \? '' : 'col-span-2'\)/);
  assert.doesNotMatch(modePanelSource, /isMobile \? 'row-start-2 min-w-0'/);
  assert.match(cssSource, /\.input-bar-footer\[data-mobile-action-overflow-policy="single-row-primary-secondary-drawer"\]/);
  assert.match(cssSource, /flex-wrap: nowrap;/);
  assert.match(cssSource, /overflow-x: auto;/);
  assert.match(cssSource, /overflow-y: visible;/);
  assert.match(cssSource, /\.input-bar-footer\[data-mobile-action-overflow-policy="single-row-primary-secondary-drawer"\] \* \{/);
  assert.doesNotMatch(promptBarSource, /min-w-\[9rem\] max-w-none justify-start flex-shrink-0/);
  assert.doesNotMatch(promptBarSource, /isMobile \? 'w-\[clamp\(6\.75rem,38vw,8\.5rem\)\] max-w-\[42vw\] flex-none justify-start'/);
  assert.match(promptBarSource, /isMobile \? 'w-full min-w-0 justify-start'/);
  assert.doesNotMatch(modePanelSource, /isEmbeddedMobileDrawer \? 'px-3 justify-between max-w-none' : 'px-2\.5 max-w-none'/);
  assert.match(modePanelSource, /isMobile \? 'min-w-0 shrink-0'/);
  assert.match(modePanelSource, /isMobile \? \(isEmbeddedMobileDrawer \? 'px-3 justify-between max-w-\[42vw\] min-w-0 overflow-hidden' : 'px-2\.5 max-w-\[40vw\] min-w-0 overflow-hidden'\)/);
});

test('ecommerce main-image ratio choices stay in one equal three-column row', () => {
  const imageOptionsSource = readSource('apps/web/src/components/image/ImageOptionsPanel.tsx');

  assert.match(
    imageOptionsSource,
    /const totalRatioCount = gridRatios\.length \+ \(hasAuto \? 1 : 0\);/,
  );
  assert.match(
    imageOptionsSource,
    /const shouldUseSingleEqualRow = totalRatioCount <= 3;/,
  );
  assert.match(
    imageOptionsSource,
    /const autoInGrid = hasAuto && \(shouldUseSingleEqualRow \|\| isOddCount\);/,
  );
  assert.match(
    imageOptionsSource,
    /const useDoubleRow = !shouldUseSingleEqualRow && \(totalGridItems > 3 \|\| \(hasAuto && !autoInGrid\)\);/,
  );
  assert.match(
    imageOptionsSource,
    /const columns = shouldUseSingleEqualRow\s*\?\s*totalGridItems\s*:\s*\(useDoubleRow \? Math\.ceil\(totalGridItems \/ 2\) : Math\.max\(1, totalGridItems\)\);/,
  );
  assert.doesNotMatch(imageOptionsSource, /const autoInGrid = hasAuto && isOddCount;/);
});
