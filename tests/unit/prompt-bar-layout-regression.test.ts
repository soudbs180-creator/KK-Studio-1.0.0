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
  const topRowSource = readSource('src/components/layout/prompt-bar/PromptBarTopRow.tsx');
  const topRowDesktopSource = readSource('src/components/layout/prompt-bar/PromptBarTopRowDesktop.tsx');
  const footerShellSource = readSource('src/components/layout/prompt-bar/PromptBarFooter.tsx');
  const footerSource = readSource('src/components/layout/prompt-bar/PromptBarFooterDesktop.tsx');
  const modePanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');

  assert.match(
    footerSource,
    /className="input-bar-footer flex w-full min-w-0 flex-wrap items-center gap-1\.5 px-1 pb-1 pt-0\.5 min-h-\[42px\]"/,
  );
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
  assert.match(promptBarSource, /className="relative h-full w-\[58px\]"/);
  assert.match(promptBarSource, /className=\{`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md transition-all text-\[11px\] font-medium \$\{config\.enableGrounding/);
  assert.match(promptBarSource, /className=\{`flex min-w-0 max-w-full items-center justify-center gap-1 overflow-hidden px-2 h-full rounded-md transition-all text-\[11px\] font-medium \$\{config\.enableImageSearch/);
  assert.match(promptBarSource, /enableGrounding[\s\S]*<span className="min-w-0 truncate whitespace-nowrap">/);
  assert.match(promptBarSource, /enableImageSearch[\s\S]*<span className="min-w-0 truncate whitespace-nowrap">/);
  assert.match(promptBarSource, /className="group relative flex h-10 max-w-full min-w-0 shrink items-center gap-2 rounded-full pl-3\.5 pr-1/);
  assert.match(promptBarSource, /group relative flex h-10 max-w-full min-w-0 shrink flex-row items-center whitespace-nowrap rounded-full px-1 py-1 overflow-hidden/);
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
