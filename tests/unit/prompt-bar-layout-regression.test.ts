import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt bar keeps footer wrapping while allowing full desktop control labels', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const ecommercePanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const topRowSource = readSource('src/components/layout/prompt-bar/PromptBarTopRow.tsx');
  const topRowDesktopSource = readSource('src/components/layout/prompt-bar/PromptBarTopRowDesktop.tsx');
  const footerShellSource = readSource('src/components/layout/prompt-bar/PromptBarFooter.tsx');
  const footerSource = readSource('src/components/layout/prompt-bar/PromptBarFooterDesktop.tsx');
  const modePanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const cssSource = readSource('src/index.css');
  const desktopLiquidSources = [promptBarSource, modePanelSource, footerSource, cssSource].join('\n');

  assert.match(
    footerSource,
    /className="input-bar-footer flex w-full min-w-0 flex-wrap items-center gap-1\.5 px-1 pb-1 pt-0\.5 min-h-\[42px\]"/,
  );
  assert.match(promptBarSource, /import DesktopComposerEcommercePanel from '\.\/prompt-bar\/DesktopComposerEcommercePanel';/);
  assert.match(ecommercePanelSource, /const DesktopComposerEcommercePanel: React\.FC/);
  assert.match(promptBarSource, /import PromptBarTopRow from '\.\/prompt-bar\/PromptBarTopRow';/);
  assert.match(promptBarSource, /import PromptBarFooter from '\.\/prompt-bar\/PromptBarFooter';/);
  assert.match(topRowSource, /if \(isMobile\) \{\s*return <PromptBarTopRowMobile>\{children\}<\/PromptBarTopRowMobile>;\s*\}/);
  assert.match(topRowSource, /return <PromptBarTopRowDesktop>\{children\}<\/PromptBarTopRowDesktop>;/);
  assert.match(topRowDesktopSource, /className="flex items-center justify-between mb-2 gap-2"/);
  assert.match(footerShellSource, /if \(isMobile\) \{\s*return <PromptBarFooterMobile>\{children\}<\/PromptBarFooterMobile>;\s*\}/);
  assert.match(footerShellSource, /return <PromptBarFooterDesktop>\{children\}<\/PromptBarFooterDesktop>;/);
  assert.match(modePanelSource, /className=\{`relative inline-flex \$\{isMobile \? 'row-start-2 min-w-0' : 'min-w-fit flex-shrink-0'\}`\}/);
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
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const modeSwitcherSource = readSource('src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx');

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
  const modeSwitcherSource = readSource('src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx');

  assert.match(modeSwitcherSource, /const sliderOffset =/);
  assert.match(modeSwitcherSource, /transition-\[transform,background-color,border-color,box-shadow\]/);
  assert.match(modeSwitcherSource, /transform:\s*`translate3d\(\$\{sliderOffset\}px, 0, 0\)`/);
  assert.doesNotMatch(modeSwitcherSource, /const sliderLeft =/);
  assert.doesNotMatch(modeSwitcherSource, /left:\s*`\$\{sliderLeft\}px`/);
});

test('mobile embedded composer keeps the upload affordance inside the input area instead of spending a dedicated row when empty', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

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
  const desktopFooterSource = readSource('src/components/layout/prompt-bar/PromptBarFooterDesktop.tsx');
  const mobileFooterSource = readSource('src/components/layout/prompt-bar/PromptBarFooterMobile.tsx');
  const cssSource = readSource('src/index.css');

  assert.doesNotMatch(desktopFooterSource, /prompt-bar-footer-frost/);
  assert.match(mobileFooterSource, /data-mobile-action-overflow-policy="single-row-primary-secondary-drawer"/);
  assert.match(mobileFooterSource, /className="input-bar-footer prompt-bar-footer-frost flex w-full flex-nowrap items-center gap-2 overflow-hidden px-1 pb-1 pt-0\.5 min-h-\[44px\]"/);
  assert.match(cssSource, /\.prompt-bar-footer-frost\s*\{/);
  assert.match(cssSource, /\.prompt-bar-footer-frost::before\s*\{/);
  assert.match(cssSource, /border-top: 1px solid var\(--prompt-bar-footer-frost-border\);/);
  assert.doesNotMatch(cssSource, /\.prompt-bar-footer-frost\s*\{[\s\S]*border: 1px solid var\(--prompt-bar-footer-frost-border\);/);
  assert.match(cssSource, /\.input-bar-textarea\s*\{[\s\S]*background: transparent;/);
});

test('prompt bar keeps a real frosted shell while desktop options stay inside the composer surface', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const modePanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const imageOptionsSource = readSource('src/components/image/ImageOptionsPanel.tsx');
  const videoOptionsSource = readSource('src/components/video/VideoOptionsPanel.tsx');
  const cssSource = readSource('src/index.css');

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
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.doesNotMatch(promptBarSource, /className="absolute left-0 bottom-full mb-3 z-50 animate-fadeIn origin-bottom"/);
  assert.match(
    promptBarSource,
    /className="absolute left-1\/2 bottom-full mb-3 z-50 -translate-x-1\/2 animate-fadeIn origin-bottom"/,
  );
});
